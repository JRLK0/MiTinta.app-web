---
name: MiTinta
description: Colección Lorcana en una interfaz clara y luminosa.
colors:
  paper: "#ffffff"
  surface: "#ffffff"
  surface-raised: "#f5f5f7"
  ink: "#1d1d1f"
  muted: "#626269"
  line: "#e4e4e9"
  line-bright: "#c6c6cf"
  accent: "#7040a0"
  accent-hover: "#5d3288"
  accent-soft: "#f3edf8"
  success: "#206347"
  success-soft: "#edf6f1"
  danger: "#a32d3d"
  danger-soft: "#fbedef"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(44px, 5.5vw, 76px)"
    fontWeight: 650
    lineHeight: 1.06
    letterSpacing: "-.035em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "clamp(32px, 4vw, 52px)"
    fontWeight: 650
    lineHeight: 1.12
    letterSpacing: "-.035em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "16px"
    lineHeight: 1.7
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
rounded:
  sm: "10px"
  md: "14px"
  lg: "16px"
  pill: "999px"
spacing:
  control-gap: "10px"
  panel: "24px"
  desktop-gutter: "32px"
  mobile-gutter: "20px"
components:
  button-landing:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0 23px"
    height: "48px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "40px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  chip-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    padding: "4px 10px"
    height: "32px"
  panel:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  navigation-active:
    textColor: "{colors.accent}"
    height: "48px"
---

# Design System: MiTinta

## Overview

**Creative North Star: "Un espacio claro para tus cartas"**

La web toma la limpieza luminosa de Apple y Ubiquiti como referencia: blanco, gris suave, texto oscuro y amatista discreto. Las cartas reales aportan la riqueza visual; la interfaz deja espacio para verlas y entender la colección.

Este sistema sustituye la anterior hoja de carbón por decisión expresa del propietario del 4 de octubre de 2026. Se aplica a portada, aplicación y privacidad web; Android conserva su estética actual.

**Key Characteristics:**
- Superficies claras y jerarquía tranquila.
- Cartas y símbolos oficiales como protagonistas.
- Controles coherentes entre colección, catálogo y mazos.
- Tipografía de sistema y cifras tabulares.

## Colors

### Primary
Amatista identifica acciones, enlaces, selección y progreso. Su tono suave acompaña chips seleccionados; el tono profundo responde al hover.

**The Acento discreto Rule.** Usa amatista para acción y estado; el color de las cartas no se extiende al fondo de la interfaz.

### Neutral
Blanco sostiene páginas y controles; gris suave agrupa demostraciones y zonas secundarias. Texto oscuro para contenido y cifras; gris medio para contexto. Las líneas delimitan controles. Los pares success y danger expresan disponibilidad, confirmación, error y faltantes.

## Typography

Una familia de sistema para titulares, contenido y controles. Títulos seminegrita con espaciado ligeramente cerrado; etiquetas en caja natural. Display y headline describen la portada; title describe el título de carta compacto de la app; body describe texto de lectura de funciones y privacidad. La app adapta tamaños a cada rol.

En móvil, el display de portada pasa a `clamp(38px, 10vw, 52px)`. Cantidades, precios y resúmenes usan `font-variant-numeric: tabular-nums`.

## Layout

Portada centrada con filas alternas de texto y demostración. App con herramientas antes de la cuadrícula, contenedor máximo de 1440px y márgenes de 32px en escritorio, 20px en móvil y 16px bajo 390px. Privacidad usa una columna de lectura máxima de 820px.

La navegación de la app pasa de pestañas superiores a barra inferior a 720px. Filtros en drawer derecho de hasta 480px y hoja inferior de hasta 88dvh en móvil. Las acciones largas de mazos desplazan dentro de su fila; Cardmarket envuelve sin desbordar la página.

## Elevation & Depth

Gris suave sobre blanco aporta profundidad. Contenedores de cartas planos en app; menús y diálogos usan shadow-soft, algunas imágenes usan shadow-card. Los valores exactos y las curvas de transición están en el sidecar.

Movimiento breve para hover, pulsación y apertura. Respeta `prefers-reduced-motion`; conserva el shader foil existente en el visor.

## Shapes

Controles con esquinas suaves (sm), paneles (md o lg) y acción de portada en píldora. Cartas con proporción y marco real. Chips removibles con esquinas de 7px; no fuerces un radio global sobre cada pieza.

## Components

### Buttons
Portada: acción amatista en píldora. App: acción amatista rectangular suave. Secundarias blancas con borde tenue. Hover profundo; foco visible de 2px con separación de 3px; pulsación breve. Deshabilitado reduce opacidad.

### Inputs / Fields
Búsqueda blanca con borde, altura mínima de 44px y radio sm. Foco en amatista. Popovers personalizados contenidos en el viewport.

### Chips
Filtros activos removibles con fondo amatista suave. Grupos de tinta, rareza, tipo y coste con selección visible. Símbolos oficiales y cifras de coste oscuras para mantener contraste.

### Cards / Containers
Carta real primero, datos y cantidades debajo. Contenedor plano en app; gris suave para ejemplos de portada. Visor y diálogos claros, sombra suave y backdrop oscuro translúcido.

### Navigation
Pestañas superiores en escritorio, barra inferior en móvil. Selección amatista y opciones inactivas grises. Cuenta y Acciones agrupan tareas secundarias.

### Shared filters
Búsqueda, orden y Filtros permanentes. El drawer/hoja reúne filtros adicionales, resultados y limpiar. Conserva foco dentro del diálogo, Escape para cerrar y retorno al disparador. Colección, catálogo y selector de mazos comparten presentación con estados independientes.

## Do's and Don'ts

### Do:
- Do usar cartas reales y símbolos oficiales de Lorcana.
- Do mantener contraste, foco visible y controles cómodos en móvil.
- Do agrupar tareas secundarias y dar espacio al contenido.

### Don't:
- Don't recuperar el tema oscuro ni añadir selector de temas en la web.
- Don't inventar logo, ilustraciones, testimonios o cifras de producto.
- Don't cambiar el texto legal ni la estética Android dentro de este sistema web.
