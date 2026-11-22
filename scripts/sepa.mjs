// Procesa la base SEPA (Precios Claros) ya descomprimida y genera archivos por zona (celdas de 0,1°).
// Uso: node scripts/sepa.mjs <carpeta_sepa> <carpeta_salida>
// Fuente: Precios Claros – Base SEPA, Secretaría de Comercio (datos abiertos).
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";

const [, , IN, OUT] = process.argv;
if (!IN || !OUT) { console.error("Uso: node scripts/sepa.mjs <entrada> <salida>"); process.exit(1); }
const LIM = { cobertura: 350, promos: 350, filasMax: 120000, descMax: 0.7 };

function archivos(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) archivos(p, out); else out.push(p);
  }
  return out;
}
const todos = archivos(IN);
const de = (re) => todos.filter((f) => re.test(path.basename(f).toLowerCase()));
const fComercio = de(/^comercio.*\.csv$/), fSuc = de(/^sucursales.*\.csv$/), fProd = de(/^productos.*\.csv$/);
console.log(`Archivos: ${fComercio.length} comercio, ${fSuc.length} sucursales, ${fProd.length} productos`);
if (!fSuc.length || !fProd.length) { console.error("No se encontraron CSV de sucursales/productos."); process.exit(1); }
const fechaDir = todos.map((f) => (f.match(/(\d{4}-\d{2}-\d{2})/) || [])[1]).filter(Boolean).sort().pop();
const FECHA = fechaDir || new Date().toISOString().slice(0, 10);

// ---- lectura CSV tolerante: separador | o , ; encabezado por nombre ; ignora líneas finales sueltas
async function* filas(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: "utf8" }), crlfDelay: Infinity });
  let head = null, sep = "|", n = 0, malas = 0;
  for await (let line of rl) {
    if (!head) {
      line = line.replace(/^﻿/, "");
      sep = line.split("|").length >= line.split(",").length ? "|" : ",";
      head = line.split(sep).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
      if (n++ === 0 && !global.__mostrado?.[path.basename(file)]) {
        (global.__mostrado ||= {})[path.basename(file)] = 1;
        console.log("Encabezado", path.basename(file), "sep=" + sep, head.join(","));
      }
      continue;
    }
    if (!line.trim()) continue;
    const c = line.split(sep);
    if (c.length < head.length - 1) { malas++; continue; }
    const o = {};
    for (let i = 0; i < head.length; i++) o[head[i]] = (c[i] || "").trim().replace(/^"|"$/g, "");
    yield o;
  }
  if (malas > 5) console.log(`  ${path.basename(file)}: ${malas} líneas ignoradas`);
}
const num = (v) => { if (!v) return NaN; v = String(v).trim(); if (v.includes(",") && !v.includes(".")) v = v.replace(",", "."); else v = v.replace(/,/g, ""); return parseFloat(v); };
const pick = (o, ...ks) => { for (const k of ks) if (o[k] !== undefined && o[k] !== "") return o[k]; return ""; };
const titulo = (s) => s.toLowerCase().replace(/(^|[\s(\-/])([a-záéíóúñü])/g, (m, a, b) => a + b.toUpperCase());

// ---- comercios / banderas
const banderas = new Map();
for (const f of fComercio) for await (const o of filas(f)) {
  const k = pick(o, "id_comercio") + "-" + pick(o, "id_bandera");
  banderas.set(k, pick(o, "comercio_bandera_nombre", "comercio_razon_social") || "Comercio " + k);
}

// ---- sucursales -> celda
const suc = new Map(); // clave -> {celda, idx}
const celdas = new Map(); // celda -> {tiendas:[], eans: Map, sel:Set, filas:[], leyendas: Map}
const celdaDe = (lat, lon) => Math.floor(lat * 10) + "_" + Math.floor(lon * 10);
for (const f of fSuc) for await (const o of filas(f)) {
  const lat = num(pick(o, "sucursales_latitud", "latitud")), lon = num(pick(o, "sucursales_longitud", "longitud"));
  if (!(lat < -21 && lat > -56 && lon < -53 && lon > -74)) continue;
  const ic = pick(o, "id_comercio"), ib = pick(o, "id_bandera"), is = pick(o, "id_sucursal");
  const key = ic + "-" + ib + "-" + is;
  const c = celdaDe(lat, lon);
  if (!celdas.has(c)) celdas.set(c, { tiendas: [], eans: new Map(), sel: null, filas: [], leyendas: new Map() });
  const cel = celdas.get(c);
  const dir = [pick(o, "sucursales_calle"), pick(o, "sucursales_numero")].filter(Boolean).join(" ");
  cel.tiendas.push([banderas.get(ic + "-" + ib) || "Comercio", titulo(pick(o, "sucursales_nombre")), titulo(dir), titulo(pick(o, "sucursales_localidad")), +lat.toFixed(5), +lon.toFixed(5)]);
  suc.set(key, { c, i: cel.tiendas.length - 1 });
}
console.log(`Sucursales con ubicación: ${suc.size} en ${celdas.size} zonas. Fecha de datos: ${FECHA}`);

function precioRow(o) {
  const lista = num(pick(o, "productos_precio_lista", "precio_lista"));
  if (!(lista > 0)) return null;
  let promo = 0, ley = "";
  for (const [pk, lk] of [["productos_precio_unitario_promo1", "productos_leyenda_promo1"], ["productos_precio_unitario_promo2", "productos_leyenda_promo2"]]) {
    const p = num(o[pk]);
    if (p > 0 && p < lista && 1 - p / lista < LIM.descMax && (!promo || p < promo)) { promo = p; ley = (o[lk] || "").slice(0, 80); }
  }
  return { lista: Math.round(lista * 100) / 100, promo: promo ? Math.round(promo * 100) / 100 : 0, ley };
}
function eanDe(o) {
  const e = pick(o, "productos_ean"), id = pick(o, "id_producto");
  if (/^\d{8,14}$/.test(e)) return e;
  if (/^\d{8,14}$/.test(id) && (e === "" || e === "1" || e.toLowerCase() === "true")) return id;
  return "";
}

// ---- pasada 1: cobertura y mejor descuento por zona
let leidas = 0;
for (const f of fProd) for await (const o of filas(f)) {
  leidas++;
  const s = suc.get(pick(o, "id_comercio") + "-" + pick(o, "id_bandera") + "-" + pick(o, "id_sucursal"));
  if (!s) continue;
  const ean = eanDe(o); if (!ean) continue;
  const p = precioRow(o); if (!p) continue;
  const m = celdas.get(s.c).eans;
  let e = m.get(ean);
  if (!e) {
    const pres = [pick(o, "productos_cantidad_presentacion"), pick(o, "productos_unidad_medida_presentacion")].filter(Boolean).join(" ");
    e = { n: 0, d: 0, info: [ean, pick(o, "productos_descripcion").slice(0, 90), titulo(pick(o, "productos_marca")).slice(0, 40), pres.replace(/\.0+(?=\s|$)/, "")] };
    m.set(ean, e);
  }
  e.n++;
  if (p.promo) e.d = Math.max(e.d, 1 - p.promo / p.lista);
}
console.log(`Filas de productos leídas: ${leidas}`);

// ---- selección por zona
for (const cel of celdas.values()) {
  const arr = [...cel.eans.entries()];
  const porCob = arr.filter(([, e]) => e.n >= 2 || cel.tiendas.length < 2).sort((a, b) => b[1].n - a[1].n).slice(0, LIM.cobertura);
  const porPromo = arr.filter(([, e]) => e.d >= 0.05).sort((a, b) => b[1].d - a[1].d).slice(0, LIM.promos);
  const orden = []; const vistos = new Set();
  for (let i = 0; i < Math.max(porCob.length, porPromo.length); i++) for (const l of [porPromo, porCob]) if (l[i] && !vistos.has(l[i][0])) { vistos.add(l[i][0]); orden.push(l[i]); }
  let filasEst = 0; cel.sel = new Map(); cel.prods = [];
  for (const [ean, e] of orden) { if (filasEst + e.n > LIM.filasMax) continue; filasEst += e.n; cel.sel.set(ean, cel.prods.length); cel.prods.push(e.info); }
  cel.eans = null;
}

// ---- pasada 2: precios de los productos elegidos
for (const f of fProd) for await (const o of filas(f)) {
  const s = suc.get(pick(o, "id_comercio") + "-" + pick(o, "id_bandera") + "-" + pick(o, "id_sucursal"));
  if (!s) continue;
  const cel = celdas.get(s.c);
  const ean = eanDe(o); const pi = cel.sel.get(ean); if (pi === undefined) continue;
  const p = precioRow(o); if (!p) continue;
  let li = -1;
  if (p.promo && p.ley) { if (!cel.leyendas.has(p.ley)) cel.leyendas.set(p.ley, cel.leyendas.size); li = cel.leyendas.get(p.ley); }
  cel.filas.push([pi, s.i, p.lista, p.promo, li]);
}

// ---- escritura
fs.mkdirSync(path.join(OUT, "super", "celdas"), { recursive: true });
const indice = { fecha: FECHA, generado: new Date().toISOString(), fuente: "Precios Claros – Base SEPA (Secretaría de Comercio)", celdas: {} };
let bytes = 0;
for (const [c, cel] of celdas) {
  if (!cel.filas.length) continue;
  const json = JSON.stringify({ f: FECHA, t: cel.tiendas, p: cel.prods, x: cel.filas, l: [...cel.leyendas.keys()] });
  const gz = zlib.gzipSync(json, { level: 9 });
  fs.writeFileSync(path.join(OUT, "super", "celdas", c + ".json.gz"), gz);
  bytes += gz.length;
  indice.celdas[c] = cel.tiendas.length;
}
fs.writeFileSync(path.join(OUT, "super", "indice.json"), JSON.stringify(indice));
console.log(`Listo: ${Object.keys(indice.celdas).length} zonas, ${(bytes / 1e6).toFixed(1)} MB comprimidos.`);
if (!Object.keys(indice.celdas).length) process.exit(1);
