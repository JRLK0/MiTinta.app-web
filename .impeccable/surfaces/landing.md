---
version: 1
slug: "landing"
primary_target: "landing"
related_targets: ["index.html"]
---

## Scope
Portada pública de MiTinta (`/`), modo Persuade. Coleccionista hispanohablante que consulta colección, faltantes o próximo mazo. Acción principal: abrir `/collection/`, donde están acceso y registro. `/privacy/` conserva el texto legal.

## Direction contract
THESIS: Un espacio claro para tus cartas: la interfaz luminosa se aparta y las cartas reales explican el producto.
OWN-WORLD: Blanco, gris suave, texto oscuro y amatista discreto; tipografía de sistema, cifras tabulares, esquinas suaves y profundidad contenida. Sustituye expresamente la antigua hoja de carbón. Selector claro/oscuro discreto con elección persistida; claro predeterminado.
STORY: Ver una colección realista, entender sets, catálogo y mazos, conocer el vínculo con Android y abrir la colección.
FIRST VIEWPORT: Cabecera sencilla con símbolo oficial amatista y MiTinta, navegación y acceso a colección. Titular breve centrado, descripción, acción principal y enlace a funciones. Seis cartas reales de Lorcast con nombre, versión, tinta oficial y copias; ejemplo identificado. Seis columnas en escritorio y tres en móvil.
FORM: Funciones espaciosas en filas alternas de texto y demostración: sets, catálogo y lista de mazo. Apiladas en móvil. Bloque gris suave para Android y cierre con acción a colección. Sin formulario de correo en portada.
FINISH: Revisar escritorio y móvil, contraste, teclado y reducción de movimiento. Mantener DESIGN.md y sidecar coherentes; registrar procedencia de recursos.

## Guardrails
- Android: “Próximamente en Google Play”, sin enlace de tienda ni APK.
- Aviso de herramienta no oficial visible en el pie.
- Colecciones y listas identificadas como ejemplos; sin usuarios, valoraciones, testimonios ni precios inventados.
- Cartas reales: URLs `https://cards.lorcast.io/card/digital/full/{id}.jpg` declaradas en Landing.tsx. Símbolos oficiales locales: `frontend/public/ink-icons/` y `frontend/public/rarity-icons/`. Sin imágenes generadas ni nuevo logo.
- La app usa el mundo claro con mayor densidad. Funciones existentes, rutas y shader foil se conservan. Android queda fuera del rediseño.

Tema oscuro: utiliza las mismas superficies y componentes con tokens de `shared/tokens.css`; el selector guarda la elección localmente y la aplica antes del primer render mediante `theme.js`.
