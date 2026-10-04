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
