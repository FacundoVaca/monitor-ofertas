/* Súper cerca tuyo — compara precios y promos de supermercados cercanos (datos SEPA / Precios Claros). */
(function () {
  "use strict";
  var qs = new URLSearchParams(location.search);
  var BASE = qs.get("datos") === "prueba" ? "datos-prueba/super/" : "https://raw.githubusercontent.com/FacundoVaca/monitor-ofertas/datos/super/";
  var LS = "mo:ubic";
  var S = { indice: null, ciudades: [], centro: null, radio: 5, tiendas: [], productos: [], q: "", cadena: "", min: -1, orden: "desc", mostrar: 48 };

  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function km(a, b) {
    var r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var x = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.pow(Math.sin(dLon / 2), 2);
    return 12742 * Math.asin(Math.sqrt(x));
  }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function status(t, err) { var e = $("#st"); e.textContent = t; e.className = "status" + (err ? " err" : ""); }

  function getJSON(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function getGz(u) {
    return fetch(u).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      if (!("DecompressionStream" in window)) throw new Error("Tu navegador es muy viejo para cargar los precios.");
      return new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).json();
    });
  }

  function celdasCerca(c, radio) {
    var dLat = radio / 111, dLon = radio / (111 * Math.cos(c.lat * Math.PI / 180)), out = [];
    for (var a = Math.floor((c.lat - dLat) * 10); a <= Math.floor((c.lat + dLat) * 10); a++)
      for (var b = Math.floor((c.lon - dLon) * 10); b <= Math.floor((c.lon + dLon) * 10); b++) {
        var k = a + "_" + b; if (S.indice.celdas[k]) out.push(k);
      }
    return out;
  }

  function cargar() {
    if (!S.centro || !S.indice) return;
    var ks = celdasCerca(S.centro, S.radio);
    if (!ks.length) { S.tiendas = []; S.productos = []; status("No tenemos supermercados informados cerca de esa ubicación. Probá con un radio mayor u otra ciudad."); render(); return; }
    status("Cargando precios de " + ks.length + (ks.length > 1 ? " zonas" : " zona") + "…");
    Promise.all(ks.map(function (k) { return getGz(BASE + "celdas/" + k + ".json.gz"); })).then(function (cs) {
      var tiendas = [], prods = {};
      cs.forEach(function (c) {
        var tmap = c.t.map(function (t) {
          var o = { cadena: t[0], nombre: t[1], dir: t[2], loc: t[3], lat: t[4], lon: t[5] };
          o.km = km(S.centro, o);
          if (o.km > S.radio) return null;
          tiendas.push(o); return o;
        });
        c.x.forEach(function (x) {
          var t = tmap[x[1]]; if (!t) return;
          var info = c.p[x[0]], p = prods[info[0]];
          if (!p) p = prods[info[0]] = { ean: info[0], nombre: info[1], marca: info[2], pres: info[3], key: norm(info[1] + " " + info[2]), e: [] };
          var precio = x[3] || x[2];
          p.e.push({ t: t, lista: x[2], promo: x[3], ley: x[4] >= 0 ? c.l[x[4]] : "", precio: precio, d: x[3] ? Math.round((1 - x[3] / x[2]) * 100) : 0 });
        });
      });
      S.tiendas = tiendas; S.productos = Object.keys(prods).map(function (k) { return prods[k]; });
      var fecha = (cs[0] && cs[0].f || "").split("-").reverse().join("/");
      status(tiendas.length + " sucursales a menos de " + S.radio + " km · precios informados el " + fecha);
      opcionesCadena(); S.mostrar = 48; render();
    }).catch(function (e) { status("No pudimos cargar los precios (" + e.message + "). Probá de nuevo en un rato.", true); });
  }

  function opcionesCadena() {
    var n = {}; S.tiendas.forEach(function (t) { n[t.cadena] = (n[t.cadena] || 0) + 1; });
    var sel = $("#cadena"), cur = S.cadena;
    sel.innerHTML = '<option value="">Todas las cadenas</option>' + Object.keys(n).sort().map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === cur ? " selected" : "") + ">" + esc(c) + " (" + n[c] + ")</option>"; }).join("");
    if (cur && !n[cur]) S.cadena = "";
  }

  function vista(p) {
    var e = S.cadena ? p.e.filter(function (x) { return x.t.cadena === S.cadena; }) : p.e;
    if (!e.length) return null;
    e = e.slice().sort(function (a, b) { return a.precio - b.precio || a.t.km - b.t.km; });
    var maxD = 0; e.forEach(function (x) { if (x.d > maxD) maxD = x.d; });
    return { p: p, e: e, best: e[0], max: e[e.length - 1].precio, d: maxD };
  }

  function render() {
    var box = $("#res");
    if (!S.productos.length) { box.innerHTML = S.centro ? "" : '<p class="empty">Elegí tu ciudad o tocá “Usar mi ubicación” para ver precios cerca tuyo.</p>'; $("#count").textContent = ""; actualizarMin([]); return; }
    var q = norm(S.q).split(/\s+/).filter(Boolean);
    var base = S.productos.map(vista).filter(function (v) { return v && q.every(function (w) { return v.p.key.indexOf(w) > -1; }); });
    actualizarMin(base);
    var list = base.filter(function (v) { return S.min < 0 || (S.min === 0 ? v.d > 0 : v.d >= S.min); });
    list.sort(function (a, b) {
      if (S.orden === "precio") return a.best.precio - b.best.precio;
      if (S.orden === "suc") return b.e.length - a.e.length;
      return b.d - a.d || b.e.length - a.e.length;
    });
    $("#count").textContent = list.length + " productos";
    box.innerHTML = list.length ? list.slice(0, S.mostrar).map(card).join("") : '<p class="empty">No encontramos productos con esos filtros.</p>';
    $("#mas").hidden = list.length <= S.mostrar;
  }

  function actualizarMin(base) {
    var sel = $("#min"), opts = [[-1, "Todos los precios"], [0, "Solo con promo"], [10, "10% o más"], [20, "20% o más"], [30, "30% o más"], [40, "40% o más"], [50, "50% o más"]];
    sel.innerHTML = opts.map(function (o) {
      var n = base.filter(function (v) { return o[0] < 0 || (o[0] === 0 ? v.d > 0 : v.d >= o[0]); }).length;
      return '<option value="' + o[0] + '"' + (o[0] === S.min ? " selected" : "") + ">" + o[1] + " (" + n + ")</option>";
    }).join("");
  }

  function lugar(t) { return esc(t.cadena) + " · " + esc(t.nombre || t.dir) + " <small>(" + t.km.toFixed(1).replace(".", ",") + " km)</small>"; }
  function card(v) {
    var b = v.best, p = v.p;
    var filas = v.e.slice(0, 12).map(function (x) {
      return "<tr><td>" + lugar(x.t) + (x.t.dir ? "<br><small>" + esc(x.t.dir) + "</small>" : "") + '</td><td class="num">' + money(x.precio) + (x.promo ? '<br><small class="old">' + money(x.lista) + "</small>" : "") + (x.ley ? "<br><small>" + esc(x.ley) + "</small>" : "") + "</td></tr>";
    }).join("");
    return '<article class="deal"><div class="body"><div class="badges">' +
      (b.d ? '<span class="badge">-' + b.d + "%</span>" : "") + (v.d > b.d ? '<span class="badge low">Promos hasta -' + v.d + "%</span>" : "") +
      "</div><h3>" + esc(p.nombre) + "</h3><div class=\"meta\">" + esc([p.marca, p.pres].filter(Boolean).join(" · ")) + "</div>" +
      '<div class="price">' + money(b.precio) + (b.promo ? '<span class="old">' + money(b.lista) + "</span>" : "") + "</div>" +
      (b.ley ? "<div><small>" + esc(b.ley) + "</small></div>" : "") +
      '<div class="meta">Más barato en ' + lugar(b.t) + "</div>" +
      (v.e.length > 1 ? '<div class="meta">En ' + v.e.length + " sucursales cerca: " + money(b.precio) + " a " + money(v.max) + "</div>" : "") +
      "<details><summary>Ver sucursales</summary><table>" + filas + "</table></details>" +
      "</div></article>";
  }

  function setCentro(c, nombre) {
    S.centro = c; try { localStorage.setItem(LS, JSON.stringify({ c: c, n: nombre })); } catch (e) {}
    cargar();
  }

  function init() {
    Promise.all([getJSON(BASE + "indice.json"), getJSON("data/ciudades.json")]).then(function (r) {
      S.indice = r[0]; S.ciudades = r[1];
      $("#ciudad").innerHTML = '<option value="">Elegí tu ciudad</option>' + S.ciudades.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.nombre) + "</option>"; }).join("");
      var sv = null; try { sv = JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) {}
      var qc = qs.get("ciudad"), ciudad = S.ciudades.filter(function (c) { return c.id === qc; })[0];
      if (ciudad) { $("#ciudad").value = ciudad.id; setCentro({ lat: ciudad.lat, lon: ciudad.lon }, ciudad.id); }
      else if (sv && sv.c) { if (sv.n && sv.n !== "gps") $("#ciudad").value = sv.n; setCentro(sv.c, sv.n); }
      else { status("Elegí tu ciudad o usá tu ubicación."); render(); }
    }).catch(function () { status("Todavía no hay precios cargados. Volvé a intentar más tarde.", true); });

    $("#ciudad").addEventListener("change", function (e) {
      var c = S.ciudades.filter(function (x) { return x.id === e.target.value; })[0];
      if (c) setCentro({ lat: c.lat, lon: c.lon }, c.id);
    });
    $("#radio").addEventListener("change", function (e) { S.radio = +e.target.value; cargar(); });
    $("#btn-loc").addEventListener("click", function () {
      if (!navigator.geolocation) { status("Tu navegador no permite ubicación. Elegí tu ciudad.", true); return; }
      status("Pidiendo permiso de ubicación…");
      navigator.geolocation.getCurrentPosition(function (pos) {
        // Se usa solo en tu navegador; no se envía a ningún servidor.
        $("#ciudad").value = "";
        setCentro({ lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) }, "gps");
      }, function () { status("No diste permiso (o falló). Elegí tu ciudad en la lista.", true); }, { timeout: 10000, maximumAge: 600000 });
    });
    $("#q").addEventListener("input", function (e) { S.q = e.target.value; S.mostrar = 48; render(); });
    $("#cadena").addEventListener("change", function (e) { S.cadena = e.target.value; S.mostrar = 48; render(); });
    $("#min").addEventListener("change", function (e) { S.min = +e.target.value; S.mostrar = 48; render(); });
    $("#orden").addEventListener("change", function (e) { S.orden = e.target.value; render(); });
    $("#mas").addEventListener("click", function () { S.mostrar += 48; render(); });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
