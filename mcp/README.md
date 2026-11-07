# MiTinta Lorcana MCP

Servidor remoto: **https://lorcana-mcp.mitinta.app/mcp**. Usa Streamable HTTP y OAuth con PKCE. Cada persona se conecta con su cuenta real de MiTinta y solo accede a su colección y sus mazos.

## Conectar una IA

1. Añade la URL anterior como servidor MCP remoto en un cliente compatible con OAuth.
2. En la página de MiTinta que se abre, revisa el nombre del cliente y el destino de autorización e inicia sesión.
3. La consulta no permite cambiar cantidades de la colección. Para gestionar mazos, activa **Permitir crear, editar y eliminar mazos** cuando se solicite ese permiso.
4. En la web, abre tu cuenta → **Conexiones de IA** para consultar y revocar conexiones.

Permisos: `collection:read`, `decks:read`, `decks:write`; `offline_access` permite renovar la autorización durante un máximo de treinta días. La solicitud inicial anuncia permisos de consulta. Una llamada de escritura sin permiso responde HTTP 403 con un desafío `insufficient_scope` para que el cliente solicite autorización adicional. Si el cliente no implementa esa ampliación, configura los tres permisos al conectar. La casilla de escritura está desactivada por defecto incluso cuando el cliente solicita escritura.

Ejemplos de peticiones al agente:

- «Lista mis mazos y enséñame el de Amatista/Zafiro».
- «¿Qué cartas y cuántas copias me faltan para este mazo?».
- «Compara estos dos mazos por separado y después calcula qué necesito para montarlos a la vez».
- «Crea un borrador Core con estas cartas».
- «En este mazo pon dos copias de esta carta y quita esta otra».

## Herramientas

`search_cards`, `get_card`, `list_collection`, `get_collection_summary`, `list_decks`, `get_deck`, `get_missing_cards`, `create_deck`, `update_deck`, `delete_deck`.

Los listados devuelven `items`, `total`, `offset`, `limit` y `has_more`. Las cartas se identifican mediante `card_id` del catálogo; nombres ambiguos se resuelven buscando, nunca suponiendo una impresión. El catálogo se lee de `/collection/catalog.json` de MiTinta con caché de quince minutos y fecha de actualización; no depende de la tabla `cards` de Supabase.

`get_missing_cards` recibe `deck_ids` y `mode`: `independent` compara cada mazo por separado y `simultaneous` suma los mazos elegidos antes de descontar la colección. Cuenta juntas las impresiones equivalentes por nombre y versión, incluidos acabados e idiomas. No reserva cartas para otros mazos. Los avisos de formato y construcción reutilizan las reglas versionadas de la web; no certifican legalidad actual de un torneo.

Las escrituras requieren `request_id` UUID, reutilizado en reintentos idénticos. `get_deck` devuelve `revision`; editar y eliminar exigen esa revisión en `expected_revision`. Una edición cambia solo los campos y cartas indicados; las cantidades son absolutas y cero retira una entrada. Crear exige Core o Infinity y es privado por defecto. Se admiten borradores incompletos.

## Datos y autenticación

El Worker sigue la configuración pública y validada de `https://mitinta.app/backend.json`, igual que la web. El backend activo verificado al publicar es el Supabase gestionado `wedzkhkkqilokvfmzyuv.supabase.co`, versión `managed-1`. El CT131 contiene una copia local: no debe confundirse con el backend público ni activarse para desplegar este MCP. Un cambio de versión del backend obliga a autorizar de nuevo.

El inicio de sesión crea una sesión Supabase independiente de la del navegador. Los tokens se cifran con AES-GCM y una clave secreta del Worker. D1 guarda conexiones, revocaciones y transacciones OAuth de un solo uso; KV guarda clientes y concesiones del proveedor OAuth. La renovación usa un bloqueo con arrendamiento en D1. Las contraseñas no se guardan. Cada petición valida la conexión en D1 y el acceso al backend conserva la identidad del usuario y RLS; no se utiliza una clave `service_role`.

La web y el MCP comparten `get_own_deck_snapshot`, `save_deck_atomic` y `delete_deck_atomic`. Estas funciones son `security invoker`, comprueban propietario, guardan metadatos y lista en una transacción y conservan recibos de idempotencia treinta días, con un máximo de 1000 operaciones por cuenta y tamaños limitados también para inserciones directas. La comparación de varios mazos se resuelve en una única consulta al backend. La revisión incluye tanto metadatos como cartas. Un conflicto conserva el borrador local del navegador y exige revisar la versión guardada.

## Comprobar y publicar

Desde esta carpeta:

```sh
npm ci
npm test
```

Las pruebas locales usan workerd y el cliente oficial de MCP, con un backend simulado. `tests/postgres.mjs` exige explícitamente una base aislada `MITINTA_QA_DATABASE=mitinta_mcp_qa_<fecha>` y verifica las funciones contra PostgreSQL real; el adaptador de prueba utiliza CT131. Nunca apuntarlo a `postgres`.

`tests/live.mjs` exige `MITINTA_QA_ACCOUNTS` con dos cuentas sintéticas y `PLAYWRIGHT_MODULE` con Playwright. Comprueba autorización en Chromium, CRUD público, lectura en la web, conflictos entre web e IA, gestión de conexiones y revocación. No crea cuentas ni envía correos. Los resultados y capturas se guardan en `.private/`, fuera de Git. `MITINTA_STAGE_ASSETS` permite comprobar una compilación web antes de publicarla manteniendo su origen real mediante interceptación del navegador.

Antes del primer despliegue, guardar una copia de la base activa y aplicar allí las migraciones de `migrations/` en orden: `20261107_deck_transactions.sql`, `20261107_2_limits_and_batch.sql` y `20261107_3_http_conflicts.sql`. `schema.sql` corresponde exclusivamente a la nueva D1. `wrangler.jsonc` identifica el Worker, D1 y KV propios. Configurar `SESSION_KEY` como secreto aleatorio de 32 bytes en base64; nunca reemplazarlo en una actualización rutinaria. Después, `npm run deploy` publica el Worker. Publicar también la web desde el repositorio raíz y verificar ambos dominios. El workflow verifica MCP y web; el despliegue MCP automático necesita `LORCANA_MCP_DEPLOY_ENABLED=true` y el secreto Cloudflare correspondiente, con la migración ya aplicada.

Para revertir, restaurar las versiones anteriores de ambos Workers. Mantener la clave de cifrado y dejar la migración aditiva aplicada: no es necesario restaurar toda la base ni perder operaciones posteriores. No eliminar la tabla de recibos para una reversión de código. El MCP de pruebas `mcp.mitinta.app` utiliza recursos independientes.
