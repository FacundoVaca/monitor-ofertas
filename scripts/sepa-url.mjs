// Imprime la URL del archivo SEPA (Precios Claros) más reciente publicado en datos.produccion.gob.ar
const UA = "BolsilloOfertas/1.0 (+https://ofertas.bolsillo.online)";
const H = { "user-agent": UA, accept: "application/json, text/html;q=0.9, */*;q=0.8", "accept-language": "es-AR,es;q=0.9" };
const t = (x) => Date.parse(x.last_modified || x.metadata_modified || x.created || 0) || 0;

async function porApi(api) {
  const r = await fetch(api, { headers: H });
  if (!r.ok) throw new Error("API CKAN HTTP " + r.status + " " + (await r.text()).slice(0, 200).replace(/\s+/g, " "));
  const zips = ((await r.json()).result.resources || []).filter((x) => /\.zip($|\?)/i.test(x.url || ""));
  zips.sort((a, b) => t(b) - t(a));
  for (const z of zips.slice(0, 3)) console.error("Recurso:", z.name, z.last_modified || z.created, z.url);
  return zips[0]?.url;
}
async function porPagina() {
  const r = await fetch("https://datos.produccion.gob.ar/dataset/sepa-precios", { headers: H });
  if (!r.ok) throw new Error("Página del dataset HTTP " + r.status);
  const urls = [...new Set(((await r.text()).match(/https?:\/\/[^"' ]+\.zip/gi) || []))];
  console.error("Zips en la página:", urls.slice(0, 10).join(" "));
  // Los archivos suelen tener la fecha en el nombre: elegimos la más reciente
  const f = (u) => (u.match(/(\d{4}-\d{2}-\d{2})/) || [, ""])[1];
  urls.sort((a, b) => f(b).localeCompare(f(a)));
  return urls[0];
}
let url = null;
for (const api of ["https://datos.produccion.gob.ar/api/3/action/package_show?id=sepa-precios", "https://datos.gob.ar/api/3/action/package_show?id=produccion-precios-claros---base-sepa"]) {
  if (url) break;
  try { url = await porApi(api); } catch (e) { console.error(api.split("/")[2] + ": " + e.message); }
}
if (!url) { try { url = await porPagina(); } catch (e) { console.error(e.message); } }
if (!url) process.exit(1);
console.log(url);
