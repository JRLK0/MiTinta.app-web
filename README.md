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
