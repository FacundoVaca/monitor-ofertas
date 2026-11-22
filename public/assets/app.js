/* Monitor de ofertas — lógica del lado del cliente. Sin dependencias. */
(function () {
  "use strict";
  var LS_CITY = "mo:ciudad";
  var state = { ofertas: [], ciudades: [], ciudad: null, q: "", tienda: "", cat: "", orden: "desc", hoy: false, activas: { mercadolibre: true, pedidosya: true } };
  var DIAS = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
  var DIAS_N = { dom: "domingos", lun: "lunes", mar: "martes", mie: "miércoles", jue: "jueves", vie: "viernes", sab: "sábados" };

  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return typeof n === "number" ? "$ " + n.toLocaleString("es-AR", { maximumFractionDigits: 0 }) : ""; }
  function safeUrl(u) { return /^https:\/\//i.test(u || "") ? u : "#"; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function fmtDate(iso) { var p = (iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] : ""; }

  function descuento(o) {
    if (typeof o.precio !== "number" || typeof o.precio_anterior !== "number" || o.precio_anterior <= o.precio) return 0;
    return Math.round((1 - o.precio / o.precio_anterior) * 100);
  }
  function esMinimo(o) {
    if (!o.historial || o.historial.length < 2 || typeof o.precio !== "number") return false;
    return o.historial.every(function (h) { return o.precio <= h.precio; });
  }
  function km(a, b) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function setCity(id, save) {
    state.ciudad = id || null;
    var sel = $("#ciudad"); if (sel) sel.value = id || "";
    if (save) { try { id ? localStorage.setItem(LS_CITY, id) : localStorage.removeItem(LS_CITY); } catch (e) {} }
    render();
  }

  function locate() {
    var st = $("#loc-status");
    if (!navigator.geolocation) { st.textContent = "Tu navegador no permite ubicación. Elegí tu ciudad en la lista."; return; }
    st.textContent = "Pidiendo permiso de ubicación…";
    navigator.geolocation.getCurrentPosition(function (pos) {
      // La ubicación se usa solo en tu navegador para elegir la ciudad más cercana. No se envía a ningún servidor.
      var me = { lat: pos.coords.latitude, lon: pos.coords.longitude }, best = null, bestD = Infinity;
      state.ciudades.forEach(function (c) { var d = km(me, c); if (d < bestD) { bestD = d; best = c; } });
      if (best && bestD < 150) { st.textContent = "Mostrando ofertas para " + best.nombre + "."; setCity(best.id, true); }
      else { st.textContent = "No encontramos una ciudad cercana en la lista. Elegila a mano."; }
    }, function () { st.textContent = "No diste permiso (o falló). Podés elegir tu ciudad en la lista."; },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 3600000 });
  }

  function diasTexto(d) {
    if (!d || !d.length) return "";
    var n = d.map(function (x) { return DIAS_N[x] || x; });
    return n.length > 1 ? n.slice(0, -1).join(", ") + " y " + n[n.length - 1] : n[0];
  }

  function visible(o) {
    if (state.activas[o.tienda] === false) return false;
    if (o.vence && o.vence < today()) return false;
    if (state.hoy && o.dias && o.dias.length && o.dias.indexOf(DIAS[new Date().getDay()]) === -1) return false;
    if (state.tienda && o.tienda !== state.tienda) return false;
    if (state.cat && o.categoria !== state.cat) return false;
    var cs = o.ciudades || ["todas"];
    if (state.ciudad && cs.indexOf("todas") === -1 && cs.indexOf(state.ciudad) === -1) return false;
    if (state.q) {
      var t = (o.titulo + " " + (o.nota || "") + " " + (o.categoria || "")).toLowerCase();
      if (t.indexOf(state.q) === -1) return false;
    }
    return true;
  }

  function card(o) {
    var d = descuento(o), tiendaN = o.tienda === "pedidosya" ? "PedidosYa" : "Mercado Libre";
    var cs = o.ciudades || ["todas"];
    var lugar = cs.indexOf("todas") > -1 ? "Todo el país" : cs.map(function (id) {
      var c = state.ciudades.filter(function (x) { return x.id === id; })[0]; return c ? c.nombre : id; }).join(", ");
    return '<article class="deal">' +
      (o.imagen && /^https:\/\//.test(o.imagen) ? '<img loading="lazy" alt="" src="' + esc(o.imagen) + '">' : "") +
      '<div class="body"><div class="badges">' +
      '<span class="badge ' + (o.tienda === "pedidosya" ? "py" : "ml") + '">' + tiendaN + "</span>" +
      (d ? '<span class="badge">-' + d + "%</span>" : "") +
      (esMinimo(o) ? '<span class="badge low">Precio más bajo registrado</span>' : "") +
      (o.ejemplo ? '<span class="badge demo">Ejemplo</span>' : "") +
      "</div><h3>" + esc(o.titulo) + "</h3>" +
      (typeof o.precio === "number" ? '<div class="price">' + money(o.precio) + (o.precio_anterior > o.precio ? '<span class="old">' + money(o.precio_anterior) + "</span>" : "") + "</div>" : "") +
      (o.medio_pago ? "<div><strong>Pagando con:</strong> " + esc(o.medio_pago) + "</div>" : "") +
      (o.dias && o.dias.length ? "<div><strong>Válida:</strong> " + esc(diasTexto(o.dias)) + "</div>" : "") +
      (o.cupon ? '<div><strong>Cupón:</strong> <code>' + esc(o.cupon) + '</code> <button type="button" class="copy" data-c="' + esc(o.cupon) + '" style="padding:3px 8px;font-size:.8rem">Copiar</button></div>' : "") +
      (o.nota ? "<div>" + esc(o.nota) + "</div>" : "") +
      '<div class="meta">' + esc(lugar) + (o.vence ? " · Vence " + fmtDate(o.vence) : "") + "</div>" +
      '<a class="go" href="' + esc(safeUrl(o.url)) + '" target="_blank" rel="sponsored noopener">Ver oferta en ' + tiendaN + "</a>" +
      "</div></article>";
  }

  function render() {
    var box = $("#deals"); if (!box) return;
    var list = state.ofertas.filter(visible);
    list.sort(function (a, b) {
      if (state.orden === "precio") return (a.precio || 0) - (b.precio || 0);
      if (state.orden === "nuevo") return (b.agregado || "").localeCompare(a.agregado || "");
      return descuento(b) - descuento(a);
    });
    box.innerHTML = list.length ? list.map(card).join("") : '<p class="empty">No hay ofertas con estos filtros' + (state.ciudad ? " para tu ciudad" : "") + ". Probá con otra categoría o ciudad.</p>";
    $("#count").textContent = list.length + (list.length === 1 ? " oferta" : " ofertas");
    var demo = $("#demo-notice"); if (demo) demo.hidden = !state.ofertas.some(function (o) { return o.ejemplo && state.activas[o.tienda] !== false; });
  }

  function load(url) { return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }

  function init() {
    if (!$("#deals")) return;
    Promise.all([load("data/ofertas.json"), load("data/ciudades.json"), load("data/config.json").catch(function () { return {}; })]).then(function (res) {
      state.ofertas = res[0].ofertas || []; state.ciudades = res[1] || [];
      if (res[2] && res[2].tiendas) state.activas = res[2].tiendas;
      var on = Object.keys(state.activas).filter(function (k) { return state.activas[k]; });
      if (on.length < 2) $("#tienda-box").hidden = true;
      Array.prototype.forEach.call($("#tienda").options, function (op) { if (op.value && !state.activas[op.value]) op.remove(); });
      $("#updated").textContent = res[0].actualizado ? "Actualizado: " + res[0].actualizado.split("-").reverse().join("/") : "";
      var sel = $("#ciudad");
      sel.innerHTML = '<option value="">Todas las ciudades</option>' + state.ciudades.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.nombre) + "</option>"; }).join("");
      var cats = {}; state.ofertas.forEach(function (o) { if (o.categoria && state.activas[o.tienda] !== false) cats[o.categoria] = 1; });
      $("#cat").innerHTML = '<option value="">Todas</option>' + Object.keys(cats).sort().map(function (c) { return '<option>' + esc(c) + "</option>"; }).join("");
      var saved = null; try { saved = localStorage.getItem(LS_CITY); } catch (e) {}
      var p = new URLSearchParams(location.search);
      if (p.get("tienda")) {
        if (state.activas[p.get("tienda")] === false) $("#ml-notice").hidden = false;
        else { state.tienda = p.get("tienda"); $("#tienda").value = state.tienda; }
      }
      setCity(p.get("ciudad") || saved, false);
    }).catch(function () { $("#deals").innerHTML = '<p class="empty">No pudimos cargar las ofertas. Recargá la página.</p>'; });

    $("#q").addEventListener("input", function (e) { state.q = e.target.value.trim().toLowerCase(); render(); });
    $("#tienda").addEventListener("change", function (e) { state.tienda = e.target.value; render(); });
    $("#cat").addEventListener("change", function (e) { state.cat = e.target.value; render(); });
    $("#orden").addEventListener("change", function (e) { state.orden = e.target.value; render(); });
    $("#ciudad").addEventListener("change", function (e) { setCity(e.target.value, true); });
    $("#btn-loc").addEventListener("click", locate);
    $("#hoy").addEventListener("change", function (e) { state.hoy = e.target.checked; render(); });
    $("#deals").addEventListener("click", function (e) {
      var b = e.target.closest(".copy"); if (!b) return;
      var done = function () { b.textContent = "¡Copiado!"; setTimeout(function () { b.textContent = "Copiar"; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.c).then(done, function () {}); 
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
