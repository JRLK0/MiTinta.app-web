# Lorcana Lector Web

Este repositorio contiene MiTinta en https://mitinta.app, publicada mediante Cloudflare Workers Static Assets. La portada está en `/`, la aplicación en `/collection/` y la privacidad en `/privacy/`. Las fuentes están en `landing/` y `frontend/`; los colores y la tipografía comunes en `shared/tokens.css`. GitHub Pages se conserva temporalmente como web anterior.

## Desarrollo y comprobación

```bash
npm ci
npm test
npm run build
```

`npm run build` genera `collection/` y la portada para GitHub Pages. Usa `npm run dev` para la aplicación y `npm run dev:landing` para la portada. `npx vite preview --config vite.landing.config.ts --port 4173` permite revisar ambas compiladas en `/MiTinta.app-web/`. Para configurar Supabase, copia `.env.example` a `.env` y sustituye los valores de ejemplo por la URL y la clave **publicable**. No publiques una clave `service_role` ni subas `.env` al repositorio. Puedes cambiar la ruta pública con `VITE_BASE_PATH`.

Desde el repositorio Android, `web/` apunta a este repositorio como submódulo.

## Conexión con IA

MiTinta ofrece un MCP remoto en **https://lorcana-mcp.mitinta.app/mcp** para consultar la colección, calcular faltantes y gestionar los mazos propios con autorización por usuario. En la cuenta de la web, **Conexiones de IA** permite consultar y revocar accesos. La colección es siempre de solo lectura. Consulta [la integración MCP](mcp/README.md) para herramientas, permisos, pruebas y despliegue.

## Publicación en Cloudflare

`npm run build:cloudflare` compila únicamente archivos públicos en `dist/` y genera `.cloudflare/output/v0/`. `MITINTA_CUSTOM_DOMAINS=1 npm run deploy:cloudflare` publica en `mitinta.app` y `www.mitinta.app` mediante la API oficial de Workers, usando `CLOUDFLARE_API_TOKEN`. El publicador conserva la salida de compilación de `cf`, comprueba los dominios y rechaza bindings adicionales antes de reemplazar el Worker. Sin esa variable no publica en producción. `node scripts/deploy-cloudflare.mjs --dry-run` verifica los artefactos sin acceder a Cloudflare. En PowerShell se define la variable con `$env:MITINTA_CUSTOM_DOMAINS='1'`.

`cloudflare/backend.json` contiene exclusivamente configuración pública: URL autorizada, clave publicable/anónima, versión y mantenimiento. El build rechaza destinos ajenos y claves privilegiadas. Se puede usar `MITINTA_BACKEND_CONFIG_FILE` para un archivo externo. No incluir contraseñas ni claves de servicio. La web verifica esta configuración al arrancar y antes de cada petición a Supabase; un cambio de backend exige nueva sesión. La configuración se sirve sin caché; los documentos HTML se revalidan y no hay fallback HTML para rutas desconocidas.

El workflow `cloudflare.yml` ejecuta pruebas y build de la web y del MCP en cada cambio. Actions publica la web cuando existen `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_DEPLOY_ENABLED=true`. Para Workers Builds, usar `npm run build:cloudflare` y `node scripts/deploy-cloudflare.mjs`, con `MITINTA_CUSTOM_DOMAINS=1` y la credencial de Cloudflare configurada. Usar una sola vía de publicación. El MCP tiene su propia opción `LORCANA_MCP_DEPLOY_ENABLED=true` y requiere aplicar previamente sus migraciones.

La importación de mazos comprados usa las listas de [LorcanaJSON](https://lorcanajson.org/) guardadas en `frontend/src/starterDecks.generated.json`. Cada lista conserva cantidades y acabado foil por carta; las cartas se enlazan al catálogo por set y número de coleccionista. Los iconos de tinta de `frontend/public/ink-icons/` proceden de [Disney Lorcana](https://www.disneylorcana.com/en-US/inks).

## Diseño web

La web usa un tema claro, tipografía de sistema y un acento amatista. Los filtros comunes están en un panel lateral en escritorio y una hoja en móvil; búsqueda, ordenación, selecciones activas y resultados permanecen visibles. La colección agrupa importación y exportación bajo «Acciones». Los símbolos de coste del catálogo y de los filtros comparten el recurso oficial. La app Android mantiene su estética actual.

El selector claro/oscuro comparte `frontend/public/theme.js` y `theme.css`, con paletas en `shared/tokens.css`. Guarda `mitinta-theme` en localStorage y sincroniza pestañas; el tema claro es el predeterminado.

El catálogo reserva 242 números para Hyperia City (total previsto). Los números ausentes aparecen con ? y no se pueden añadir a la colección ni a los mazos. Los huecos se sustituyen automáticamente cuando el catálogo incorpora sus cartas.

El constructor separa el catálogo (izquierda) de la lista (derecha). En móvil se alternan con Añadir cartas / Tu lista. Tus mazos, Opciones y Detalles agrupan biblioteca, descripción, privacidad, exportación, disponibilidad, precios y análisis; formato, cantidades y avisos siguen accesibles durante la construcción. La navegación de Colección, Catálogo y Mazos comparte la cabecera en escritorio y la barra inferior en móvil.

Mis mazos es una biblioteca independiente del editor: muestra cartas reales, tintas animadas y el set numerado más alto de cada lista. Nuevo mazo exige elegir Core o Infinity antes de abrir el constructor. El botón Mis mazos vuelve a la biblioteca y conserva el borrador local; Continuar borrador permite retomarlo. Los resúmenes y las listas se cargan con paginación.

El visor de cartas permite sumar y restar copias normales o foil mediante un contador. La resta usa una copia existente del acabado y la impresión seleccionados, incluso si está en otro idioma; nunca crea cantidades negativas. El acabado seleccionado se conserva al actualizar la colección y los controles se bloquean mientras se guarda.

El visor incluye un enlace a la impresión seleccionada en Cardmarket, que abre otra pestaña. Los enlaces canónicos proceden de LorcanaJSON y se actualizan con `npm run sync:cardmarket-links`. Si no existe un enlace inequívoco para esa impresión, se ofrece una búsqueda por el nombre completo de la carta.
