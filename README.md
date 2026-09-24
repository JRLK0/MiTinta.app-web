# Lorcana Lector Web

Este repositorio contiene la web publicada en GitHub Pages y su código fuente React/Vite. La portada está en `index.html`, la aplicación publicada en `collection/` y el código fuente en `frontend/`.

## Desarrollo y comprobación

```bash
npm ci
npm test
npm run build
```

`npm run build` genera `collection/` para GitHub Pages. Para configurar Supabase, copia `.env.example` a `.env` y sustituye los valores de ejemplo por la URL y la clave **publicable**. No publiques una clave `service_role` ni subas `.env` al repositorio. Puedes cambiar la ruta pública con `VITE_BASE_PATH`.

Desde el repositorio Android, `web/` apunta a este repositorio como submódulo.
