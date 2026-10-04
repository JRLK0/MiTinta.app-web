# Construcción y sello de tintas

El editor comprueba construcción de mazos construidos: mínimo de 60 cartas,
máximo de dos tintas y cuatro copias por nombre completo, sumando reimpresiones.
Las cartas de doble tinta cuentan como ambos colores. La validación permite
guardar borradores incompletos y explica los errores; no certifica legalidad
de torneo, rotación ni prohibiciones de un formato concreto.

Excepciones implementadas: Dalmatian Puppy — Tail Wagger (99), Microbots
(sin límite) y The Glass Slipper (2). Christopher Robin — Hunny Sage habilita
otros personajes con clasificación Hunny fuera de la base Amatista/Zafiro.
Retirarlo recalcula inmediatamente la validez. La clasificación se identifica
por nombre y versión verificados, no por contener la palabra Hunny.

Fuentes comprobadas el 4 de octubre de 2026:

- https://www.disneylorcana.com/en-US/play/ways-to-play
- https://www.disneylorcana.com/en-US/news/2025/02/2025-2-10_dual-ink
- https://www.disneylorcana.com/en-GB/news/2026/07/attack-of-the-vine-set-release-notes
- https://cards.disneylorcana.com/en-US/?cardId=1641
- https://api.lorcast.com/v0/cards/search?q=hunny (clasificaciones por versión)

Los botones de añadir se bloquean al alcanzar el límite por nombre completo,
incluidas otras ediciones. El editor muestra cantidad/límite y el catálogo el
total compartido. Una importación con exceso se rechaza sin reemplazar el mazo.
Los mazos antiguos con exceso pueden corregirse, pero no guardarse con exceso.

El sello usa los iconos oficiales existentes. Un efecto canvas de duración finita
dibuja corrientes entrelazadas, reconstruye el símbolo a partir de sus píxeles y
cierra la combinación con trazados concéntricos y un anillo de impacto.
Los símbolos quedan visibles al terminar. Se anima al cambiar la identidad de
tinta; añadir copias no reinicia el efecto. No bloquea acciones y cancela efectos
anteriores si cambian las tintas rápidamente. Respeta movimiento reducido.

Tras la formación, un segundo canvas mantiene pigmento vivo detrás de los sellos:
corrientes curvas intercambian los colores y pequeñas nubes los recorren. Funciona
también al abrir un mazo existente, con una tinta o con varias (incluidas Hunny).
Los símbolos permanecen quietos. Se limita a 30 fotogramas/s y DPR 2; pausa cuando
el sello queda fuera de pantalla o la pestaña está oculta. Movimiento reducido
desactiva el fondo y puede cambiarse durante la sesión.

## Formato Core / Infinity

El constructor y el importador exigen elegir un formato; los mazos anteriores
conservan formato nulo hasta que su propietario lo indique. El formato se guarda
en `decks.format` y en el borrador local; los enlaces públicos lo muestran mediante
`get_public_deck`. Aplicar `202610040001_deck_formats.sql` antes del despliegue.

Core usa sets 9 en adelante tras la rotación del set 13. Una edición antigua sigue
siendo legal cuando coincide el nombre completo y versión con una reimpresión
vigente. El aviso ofrece sustituirla por una edición normal vigente, conserva
las cantidades y combina filas si esa edición ya estaba añadida. Nunca cambia
la colección del usuario. Las cartas no legales permanecen como borrador con
avisos; no se presenta ese mazo como válido para el formato.

Reglas verificadas el 4 de octubre de 2026: Core no tiene prohibiciones actuales;
Infinity prohíbe Hiram Flaversham — Toymaker. Hyperia City se habilita el 16 de
octubre, fecha de prelanzamiento. Los sets futuros desconocidos y cartas especiales
sin edición construida confirmada no se declaran legales. Añadir las fechas y
rotaciones nuevas a `deckFormat.ts` cuando se anuncien oficialmente.

- https://files.disneylorcana.com/Tournament-Rules-7.14.2026_Update_EN.pdf (§1.6)
- https://www.disneylorcana.com/en-GB/news/2026/08/rotation
- https://www.disneylorcana.com/en-US/product/hyperia-city
- https://www.disneylorcana.com/en-GB/news/2026/03/card-bans
