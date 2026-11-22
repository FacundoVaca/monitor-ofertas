// Imprime la URL del archivo SEPA (Precios Claros) más reciente publicado en datos.produccion.gob.ar
const API = "https://datos.produccion.gob.ar/api/3/action/package_show?id=sepa-precios";
const r = await fetch(API, { headers: { accept: "application/json" } });
if (!r.ok) { console.error("CKAN HTTP " + r.status); process.exit(1); }
const pkg = (await r.json()).result;
const zips = (pkg.resources || []).filter((x) => /\.zip($|\?)/i.test(x.url || ""));
if (!zips.length) { console.error("No hay recursos .zip en el dataset"); process.exit(1); }
const t = (x) => Date.parse(x.last_modified || x.metadata_modified || x.created || 0) || 0;
zips.sort((a, b) => t(b) - t(a));
for (const z of zips.slice(0, 3)) console.error("Recurso:", z.name, z.last_modified || z.created, z.url);
console.log(zips[0].url);
