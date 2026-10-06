# Lorcana Lector Web

Este repositorio contiene la web publicada en GitHub Pages y su código fuente React/Vite. La portada publicada está en `index.html`, su fuente React en `landing/`, la aplicación publicada en `collection/` y su fuente en `frontend/`. Los colores y la tipografía comunes se definen en `shared/tokens.css`.

## Desarrollo y comprobación

```bash
npm ci
npm test
npm run build
```

`npm run build` genera `collection/` y la portada para GitHub Pages. Usa `npm run dev` para la aplicación y `npm run dev:landing` para la portada. `npx vite preview --config vite.landing.config.ts --port 4173` permite revisar ambas compiladas en `/MiTinta.app-web/`. Para configurar Supabase, copia `.env.example` a `.env` y sustituye los valores de ejemplo por la URL y la clave **publicable**. No publiques una clave `service_role` ni subas `.env` al repositorio. Puedes cambiar la ruta pública con `VITE_BASE_PATH`.

Desde el repositorio Android, `web/` apunta a este repositorio como submódulo.

La importación de mazos comprados usa las listas de [LorcanaJSON](https://lorcanajson.org/) guardadas en `frontend/src/starterDecks.generated.json`. Cada lista conserva cantidades y acabado foil por carta; las cartas se enlazan al catálogo por set y número de coleccionista. Los iconos de tinta de `frontend/public/ink-icons/` proceden de [Disney Lorcana](https://www.disneylorcana.com/en-US/inks).

## Diseño web

La web usa un tema claro, tipografía de sistema y un acento amatista. Los filtros comunes están en un panel lateral en escritorio y una hoja en móvil; búsqueda, ordenación, selecciones activas y resultados permanecen visibles. La colección agrupa importación y exportación bajo «Acciones». Los símbolos de coste del catálogo y de los filtros comparten el recurso oficial. La app Android mantiene su estética actual.

El selector claro/oscuro comparte `frontend/public/theme.js` y `theme.css`, con paletas en `shared/tokens.css`. Guarda `mitinta-theme` en localStorage y sincroniza pestañas; el tema claro es el predeterminado.

El catálogo reserva 242 números para Hyperia City (total previsto). Los números ausentes aparecen con ? y no se pueden añadir a la colección ni a los mazos. Los huecos se sustituyen automáticamente cuando el catálogo incorpora sus cartas.

El constructor separa el catálogo (izquierda) de la lista (derecha). En móvil se alternan con Añadir cartas / Tu lista. Tus mazos, Opciones y Detalles agrupan biblioteca, descripción, privacidad, exportación, disponibilidad, precios y análisis; formato, cantidades y avisos siguen accesibles durante la construcción. La navegación de Colección, Catálogo y Mazos comparte la cabecera en escritorio y la barra inferior en móvil.

Mis mazos es una biblioteca independiente del editor: muestra cartas reales, tintas animadas y el set numerado más alto de cada lista. Nuevo mazo exige elegir Core o Infinity antes de abrir el constructor. El botón Mis mazos vuelve a la biblioteca y conserva el borrador local; Continuar borrador permite retomarlo. Los resúmenes y las listas se cargan con paginación.

El visor de cartas permite sumar y restar copias normales o foil mediante un contador. La resta usa una copia existente del acabado y la impresión seleccionados, incluso si está en otro idioma; nunca crea cantidades negativas. El acabado seleccionado se conserva al actualizar la colección y los controles se bloquean mientras se guarda.

El visor incluye un enlace a la impresión seleccionada en Cardmarket, que abre otra pestaña. Los enlaces canónicos proceden de LorcanaJSON y se actualizan con `npm run sync:cardmarket-links`. Si no existe un enlace inequívoco para esa impresión, se ofrece una búsqueda por el nombre completo de la carta.
