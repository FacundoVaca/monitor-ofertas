# Bolsillo Ofertas: guía para publicar y ganar plata

## Qué se puede y qué no (importante)

**Mercado Libre**
- La búsqueda pública de su API (`/sites/MLA/search`) **está cerrada**: devuelve error 403 aunque uses token de aplicación. Varios proyectos lo reportaron durante 2025 y 2026. Por eso no se puede armar un "monitor automático" de todo Mercado Libre de forma permitida.
- Scrapear el sitio va contra sus términos y te pueden bloquear la cuenta de afiliado. No lo usamos.
- Lo que **sí** funciona: el **Programa de Afiliados y Creadores** (hasta 15% de comisión, se cobra en Mercado Pago). Elegís productos, generás tu enlace y lo cargás en el sitio. Requisitos: ser mayor de 18 y tener monotributo para cobrar de verdad (podés empezar en modo prueba). → https://www.mercadolibre.com.ar/l/afiliados

**PedidosYa**
- **No tiene API pública para consumidores.** Su "Partner API" es solo para locales que venden en PedidosYa (pedidos, catálogo, promos de su propio local).
- Scrapear la app o la web viola sus términos. No lo usamos.
- Lo que sí se puede: cargar a mano promos públicas (por ejemplo, promos bancarias o 2x1 que ves en la app o en sus redes), con la ciudad donde valen. Hay un programa de afiliados de PedidosYa por instalación de la app en redes como FlexOffers (tipo "CPE Android AR"), pero hay que aplicar y que te acepten.

**Conclusión:** Mercado Libre se actualiza **solo** con la API oficial de catálogo (ver abajo). PedidosYa se carga a mano.

## Actualización automática de Mercado Libre

Un proceso de GitHub Actions (`.github/workflows/actualizar-ofertas.yml`) corre todos los días a las 8:00 (hora Argentina):
1. Pide los **más vendidos** de las categorías de `scripts/config.json` (`/highlights/MLA/category/...`).
2. Para cada producto consulta el precio más bajo entre vendedores (`/products/{id}/items`) y el precio original si lo hay.
3. Guarda el precio del día en `public/data/historial-ml.json`.
4. Publica los que tienen al menos 10% de descuento o están en su precio más bajo registrado (hasta 80).
5. Hace commit de `ofertas.json` y Cloudflare publica solo. Las ofertas que cargás a mano no se tocan.

**Configuración (una sola vez):**
1. Entrá a https://developers.mercadolibre.com.ar/devcenter con tu cuenta de Mercado Libre y tocá **Crear aplicación**.
   - Nombre: Bolsillo Ofertas. URI de redirección: `https://ofertas.bolsillo.online`. Permisos: solo lectura alcanza.
2. Copiá el **App ID** (Client ID) y la **Clave secreta** (Client Secret).
3. En GitHub: repo `monitor-ofertas` → *Settings → Secrets and variables → Actions → New repository secret*:
   - `ML_CLIENT_ID` = App ID
   - `ML_CLIENT_SECRET` = Clave secreta
4. Probalo: pestaña *Actions → Actualizar ofertas de Mercado Libre → Run workflow*.

Para cambiar categorías, descuento mínimo o cantidad, editá `scripts/config.json`.

## Archivos

- `public/index.html`: página principal con buscador, filtros por ciudad, tienda y categoría, y botón "Usar mi ubicación" (solo con permiso; el cálculo se hace en el navegador).
- `public/cargar.html`: tu panel privado para cargar ofertas. No aparece en Google (`noindex` + `robots.txt`).
- `public/data/ofertas.json`: las ofertas. Trae 3 **de ejemplo**: borralas antes de publicar (hay una casilla en el panel).
- `public/data/ciudades.json`: ciudades disponibles. Podés agregar más con su latitud y longitud.
- `acerca.html`, `privacidad.html`, `ads.txt`, `robots.txt`, `sitemap.xml`: lo que pide AdSense.

## Cómo cargar ofertas (rutina diaria)

1. Abrí `ofertas.bolsillo.online/cargar.html`.
2. Tocá **"Cargar las ofertas publicadas"**.
3. Para cada oferta: completá el formulario. En Mercado Libre pegá **tu enlace de afiliado**. Si actualizás el precio de una oferta que ya existe (botón *Editar*), se suma un punto al historial.
4. Tocá **"Descargar ofertas.json"** y subí ese archivo a la carpeta `data/` del sitio (reemplazando el anterior).

## Publicarlo en ofertas.bolsillo.online (Cloudflare Pages, gratis)

1. Creá el repo `monitor-ofertas` en GitHub (público) y avisame: subo el sitio.
2. En Cloudflare: *Workers & Pages → Create → Pages → Connect to Git* → elegí `monitor-ofertas`.
   - Framework preset: **None**. Build command: vacío. Build output directory: **public**.
3. Cuando termine, en el proyecto: *Custom domains → Set up a custom domain* → `ofertas.bolsillo.online`. Como el dominio ya está en Cloudflare, el DNS se crea solo.
4. Correo de contacto: en Cloudflare, *bolsillo.online → Email → Email Routing*, creá `contacto@bolsillo.online` y reenvialo a tu Gmail (gratis).
5. Para actualizar ofertas: cambiá `public/data/ofertas.json` en GitHub (botón de lápiz o "Upload files") y Cloudflare republica solo en ~1 minuto.

## Monetización

1. **AdSense (primero)**: cuando el sitio tenga contenido real y algo de tráfico, pedí la aprobación. Después:
   - Descomentá el script de AdSense en el `<head>` de cada página y poné tu `ca-pub-…`.
   - Poné tu ID en `ads.txt`.
   - Pegá los bloques de anuncio en los `<div class="ad-slot">`.
   - AdSense no aprueba sitios con contenido de ejemplo o vacío: cargá ofertas reales primero.
2. **Afiliados de Mercado Libre (más adelante, cuando tengas monotributo)**: anotate, generá enlaces y reemplazá los enlaces comunes por los de afiliado.
3. **Tráfico**: compartí las mejores ofertas en un canal de WhatsApp/Telegram o en Instagram, con link al sitio. Eso suele traer más visitas que Google al principio.

## Cuidados legales

- El pie dice que el sitio es independiente y que hay enlaces de afiliado. No lo saques.
- No uses los logos de Mercado Libre ni de PedidosYa, solo los nombres en texto.
- Poné solo precios que viste vos y la fecha; no inventes "precios anteriores".

## Activar o desactivar Mercado Libre

En `public/data/config.json` cambiá `"mercadolibre": false` a `true` para volver a mostrar sus ofertas (cuando tengas la app aprobada y los secretos cargados). Mientras esté en `false`, el sitio se enfoca en PedidosYa.

## Campos extra de las promos de PedidosYa

En el panel de carga podés poner **cupón** (se muestra con botón "Copiar"), **medio de pago** y **días en que vale**. En el sitio, la casilla "Solo válidas hoy" filtra por día.

## Súper cerca tuyo (automático, página principal)

- Fuente: **Precios Claros – Base SEPA** (datos abiertos de la Secretaría de Comercio): precios y promos por sucursal, publicados todos los días.
- `.github/workflows/actualizar-super.yml` corre todos los días a las 20:30 (hora Argentina): descarga la base, la procesa con `scripts/sepa.mjs` y publica los archivos por zona en la rama **`datos`** del repo (se reemplaza cada día, no ocupa espacio de más).
- La página `index.html` descarga solo la zona del visitante desde `raw.githubusercontent.com` y calcula distancias en su navegador.
- No necesita claves ni secretos. Para correrlo a mano: *Actions → Actualizar precios de supermercados (SEPA) → Run workflow*.
- La página de promos manuales quedó en `ofertas.html` (oculta del menú y de Google por ahora).
