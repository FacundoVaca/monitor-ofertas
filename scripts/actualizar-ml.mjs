// Actualiza public/data/ofertas.json con ofertas de Mercado Libre usando la API OFICIAL de catálogo.
// Endpoints usados (token de aplicación, client_credentials):
//   POST /oauth/token                    -> token de la app
//   GET  /highlights/MLA/category/{id}   -> más vendidos de una categoría
//   GET  /products/{id}                  -> nombre, foto, precio ganador
//   GET  /products/{id}/items            -> ofertas de vendedores (precio y precio original)
//   GET  /categories/{id}                -> nombre de la categoría
// No hace scraping. Las ofertas cargadas a mano (sin "auto": true) se conservan siempre.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API = process.env.ML_API_BASE || "https://api.mercadolibre.com";
const OFERTAS = path.join(ROOT, "public/data/ofertas.json");
const HIST = path.join(ROOT, "public/data/historial-ml.json");
const cfg = JSON.parse(await readFile(path.join(ROOT, "scripts/config.json"), "utf8"));
const hoy = (process.env.FECHA_HOY || new Date().toISOString()).slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function token() {
  const id = process.env.ML_CLIENT_ID, secret = process.env.ML_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Faltan los secretos ML_CLIENT_ID y ML_CLIENT_SECRET en GitHub.");
  const r = await fetch(API + "/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  });
  if (!r.ok) throw new Error("No se pudo obtener el token de Mercado Libre: HTTP " + r.status + " " + (await r.text()).slice(0, 200));
  return (await r.json()).access_token;
}

let TOKEN = "";
let llamadas = 0;
async function get(p, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    llamadas++;
    await sleep(120);
    const r = await fetch(API + p, { headers: { authorization: "Bearer " + TOKEN, accept: "application/json" } });
    if (r.ok) return r.json();
    if (r.status === 404) return null;
    if (r.status === 429 || r.status >= 500 || r.status === 400) { await sleep(1500 * (i + 1)); continue; }
    throw new Error(p + " -> HTTP " + r.status);
  }
  return null;
}

async function leerJSON(f, def) { try { return JSON.parse(await readFile(f, "utf8")); } catch { return def; } }

function precioDe(prod, items) {
  // Precio más bajo entre vendedores nuevos; precio original si el vendedor lo informa.
  const lista = (items?.results || []).filter((x) => typeof x.price === "number" && (x.currency_id || "ARS") === "ARS" && (!x.condition || x.condition === "new"));
  let best = null;
  for (const x of lista) if (!best || x.price < best.price) best = x;
  const bb = prod?.buy_box_winner;
  if (!best && bb && typeof bb.price === "number") best = bb;
  if (!best) return null;
  return {
    precio: Math.round(best.price),
    original: typeof best.original_price === "number" && best.original_price > best.price ? Math.round(best.original_price) : null,
    envio_gratis: !!best.shipping?.free_shipping,
  };
}

async function main() {
  if (!process.env.ML_CLIENT_ID || !process.env.ML_CLIENT_SECRET) {
    console.log("Todavía no están cargados los secretos ML_CLIENT_ID y ML_CLIENT_SECRET: no se actualiza nada.");
    return;
  }
  TOKEN = await token();
  const data = await leerJSON(OFERTAS, { ofertas: [] });
  const hist = await leerJSON(HIST, {});
  const desde = new Date(Date.parse(hoy) - cfg.dias_historial * 864e5).toISOString().slice(0, 10);
  const candidatas = [];
  const vistos = new Set();

  for (const cat of cfg.categorias) {
    const catInfo = await get("/categories/" + cat).catch(() => null);
    const catNombre = catInfo?.name || "Mercado Libre";
    let hl;
    try { hl = await get("/highlights/MLA/category/" + cat); }
    catch (e) { console.warn("Categoría " + cat + ": " + e.message); continue; }
    const ids = (hl?.content || []).filter((c) => c.type === "PRODUCT").slice(0, cfg.productos_por_categoria).map((c) => c.id);
    console.log(`${cat} (${catNombre}): ${ids.length} productos`);
    for (const id of ids) {
      if (vistos.has(id)) continue;
      vistos.add(id);
      try {
        const prod = await get("/products/" + id);
        if (!prod) continue;
        const items = await get("/products/" + id + "/items");
        const p = precioDe(prod, items);
        if (!p) continue;
        const h = (hist[id] || []).filter((x) => x.fecha >= desde);
        if (!h.length || h[h.length - 1].fecha !== hoy) h.push({ fecha: hoy, precio: p.precio });
        else h[h.length - 1].precio = p.precio;
        hist[id] = h;
        const maxHist = Math.max(...h.slice(-30).map((x) => x.precio));
        const anterior = p.original || (maxHist > p.precio ? maxHist : null);
        const desc = anterior ? Math.round((1 - p.precio / anterior) * 100) : 0;
        const esMin = h.length >= 3 && h.every((x) => p.precio <= x.precio);
        if (desc < cfg.descuento_minimo && !esMin) continue;
        const img = (prod.pictures?.[0]?.url || "").replace(/^http:/, "https:");
        candidatas.push({
          id: "ml-" + id,
          auto: true,
          tienda: "mercadolibre",
          titulo: prod.name,
          precio: p.precio,
          ...(anterior ? { precio_anterior: anterior } : {}),
          historial: h.slice(-30),
          url: prod.permalink || "https://www.mercadolibre.com.ar/p/" + id,
          ...(img.startsWith("https://") ? { imagen: img } : {}),
          categoria: catNombre,
          ciudades: ["todas"],
          ...(p.envio_gratis ? { nota: "Envío gratis." } : {}),
          _desc: desc,
        });
      } catch (e) { console.warn("Producto " + id + ": " + e.message); }
    }
  }

  const idsManuales = new Set((data.ofertas || []).filter((o) => !o.auto).map((o) => o.id));
  candidatas.sort((a, b) => b._desc - a._desc);
  const anteriores = new Map((data.ofertas || []).filter((o) => o.auto).map((o) => [o.id, o]));
  const auto = candidatas.filter((o) => !idsManuales.has(o.id)).slice(0, cfg.max_ofertas).map(({ _desc, ...o }) => ({ ...o, agregado: anteriores.get(o.id)?.agregado || hoy }));
  let manuales = (data.ofertas || []).filter((o) => !o.auto);
  if (auto.length >= 10) manuales = manuales.filter((o) => !o.ejemplo); // con ofertas reales, se van las de ejemplo

  // Limpia historial de productos que no se ven hace más de dias_historial
  for (const k of Object.keys(hist)) { hist[k] = hist[k].filter((x) => x.fecha >= desde); if (!hist[k].length) delete hist[k]; }

  const salida = { actualizado: hoy, ofertas: [...manuales, ...auto] };
  await writeFile(OFERTAS, JSON.stringify(salida, null, 2) + "\n");
  await writeFile(HIST, JSON.stringify(hist) + "\n");
  console.log(`Listo: ${auto.length} ofertas automáticas, ${manuales.length} manuales, ${llamadas} llamadas a la API.`);
  if (vistos.size === 0) { console.error("No se obtuvo ningún producto: revisá credenciales o categorías."); process.exit(1); }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
