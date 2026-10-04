# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Coleccionistas de Disney Lorcana que hablan español. Abren sobres en la mesa, escanean cada carta con el móvil Android y después, en el ordenador o en el propio móvil, revisan qué tienen, qué les falta para completar un set, cuánto vale su colección y qué mazos pueden montar con sus cartas.

## Product Purpose
MiTinta mantiene una colección personal de Lorcana sincronizada entre la app Android (escáner) y la web (gestión). Éxito: que registrar una carta cueste un gesto y que la web responda al instante a "¿la tengo?", "¿qué me falta?" y "¿cuánto vale?".

## Positioning
La carta escaneada en el móvil aparece en la web en tiempo real, con aviso y sonido cuando es valiosa. El reconocimiento ocurre en el dispositivo y la imagen de la cámara nunca sale de él. El visor reproduce el acabado foil de cada carta con máscaras por perfil de foil.

## Operating Context
- Escaneo con cámara y OCR en Android, sin guardar ni enviar imágenes.
- Sincronización con Supabase (cuenta por correo y contraseña) y canal en tiempo real sobre `collection_entries`.
- Catálogo y datos de cartas de Lorcast; precios orientativos en euros de archivos públicos de Cardmarket.
- Exportación a Dreamborn (CSV) y listas de faltantes para Cardmarket (copiar o descargar).
- Importación de mazos iniciales comprados con listas de LorcanaJSON.

## Capabilities and Constraints
- Web: colección (cartas o por sets con progreso y master set), catálogo completo, estudio de mazos con enlace público, visor de carta con foil, importador de mazos iniciales, exportaciones, borrado de cuenta.
- Filtros comunes en Colección, Catálogo y Mazos: búsqueda, tintas, rarezas, tipos, costes 1 a 8 y 9+, precio y ordenación; OR dentro del grupo y AND entre grupos.
- Rutas publicadas en GitHub Pages: `/` portada, `/collection/` app, `/privacy/` política. Se mantienen.
- La app Android no está publicada en Google Play todavía: la portada la presenta como "Próximamente en Google Play", sin enlace ni APK.
- Producto gratuito, sin anuncios, suscripciones ni compras.

## Brand Commitments
- Nombre: **MiTinta**. La app Android y la política siguen nombrando "Lorcana Lector"; el texto legal no se cambia.
- Web clara y luminosa, con acento amatista discreto (preferencia expresa del propietario del 4 de octubre de 2026; sustituye el tema oscuro anterior). Android mantiene su estética actual.
- Iconos de tinta, rareza y coste: recursos oficiales de Disney Lorcana (`frontend/public/ink-icons/`), nunca aproximaciones.
- Se permite usar arte de cartas en la portada pública siempre con el aviso visible: "Aplicación no oficial y no afiliada, respaldada ni aprobada por Disney o Ravensburger. Las imágenes, nombres y marcas pertenecen a sus respectivos titulares."
- Voz: español directo y concreto, sin promesas promocionales engañosas.

## Evidence on Hand
- Imágenes reales de cartas desde la API de Lorcast (`frontend/src/catalog.ts`) y perfiles foil generados (`frontend/src/foilProfiles.generated.ts`).
- 23 mazos iniciales reales (`frontend/src/starterDecks.generated.json`).
- Funcionalidades reales listadas arriba. No hay testimonios, cifras de usuarios, valoraciones ni prensa: no se inventan.
- Capturas de la app Android: solo si se toman de un dispositivo o emulador real.

## Product Principles
1. Un gesto para registrar, cero dudas para consultar.
2. La carta es la protagonista; la interfaz se aparta.
3. Privacidad demostrable: lo que se procesa en el móvil se queda en el móvil.
4. Coherencia entre vistas: mismos filtros, mismos componentes, mismo comportamiento.
5. Honestidad: precios orientativos, herramienta no oficial, sin cifras inventadas.

## Accessibility & Inclusion
Contraste WCAG AA en ambos temas, controles cómodos de pulsar en móvil, navegación por teclado y respeto de `prefers-reduced-motion`.

Tema oscuro: utiliza las mismas superficies y componentes con tokens de `shared/tokens.css`; el selector guarda la elección localmente y la aplica antes del primer render mediante `theme.js`.
