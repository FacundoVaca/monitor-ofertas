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

**Conclusión:** el sitio es un **monitor curado**: vos cargás las ofertas (5 a 10 minutos por día) y el sitio las filtra por ciudad, calcula el descuento y marca "precio más bajo registrado" con el historial que se va guardando.

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
