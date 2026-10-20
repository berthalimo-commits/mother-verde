# Zona del juego — Fase 3: guion para aprobar (BHO y CO2)

**Estado:** APROBADO por la dueña el 20-10-2026, con los cambios de abajo, y PROGRAMADO el mismo día (ver `juego-informe.md`, punto 9). Rama `juego` únicamente,
un commit por escena.

**Cambios de la aprobación (20-10-2026):**
- Frase de entrada nueva (ya no dice que lo anterior «se puede practicar en casa»), en los 4 idiomas.
- Los textos **[NUEVO — APROBAR]** quedan **aprobados** y se apuntan para añadirlos después al Glosario (punto 9).
- Sin número de emergencias: solo «llama a emergencias».
- Cocina y laboratorio dibujados en SVG plano, mismo estilo que el científico, sin ningún detalle interno de
  equipos, descargados solo al entrar al laboratorio.
- En la escena 1, la pregunta pasa a ser «¿Qué diferencia al BHO del rosin?» (la anterior decía que el rosin «se puede
  practicar», lo mismo que se quitó de la entrada).
- «CO₂» se escribe con el ₂ pequeño en los textos del juego, para que la prueba de «sin cifras» no tenga excepciones.

## 0. Reglas que el guion cumple (y que una prueba revisará al programarlo)

1. **Ni una cifra.** Ni temperaturas, ni presiones, ni tiempos, ni cantidades, ni proporciones, ni medidas de equipo.
2. **Ni un paso que se pueda copiar.** El jugador **no hace** una extracción en ningún momento: recorre lugares,
   **detecta peligros** y responde preguntas de concepto.
3. **Ni marcas, ni modelos, ni dónde comprar** equipo, gases o solventes.
4. Toda opción insegura lleva al mismo final: **«Detener todo y llamar a un profesional»**. Nunca se muestra una
   versión casera «mejor hecha».
5. Cada concepto sale de un texto que la plataforma **ya publica** (Glosario, Elaboración → Concentrados). Lo marco
   abajo con la fuente; si algo no está en la plataforma, lo marco **[NUEVO — APROBAR]**.
6. Mismo acceso, mismos avisos (simulación educativa, solo +18, sin dinero ni rankings), mismo guardado, 4 idiomas.
7. El guía lleva **casco y gafas** en toda la fase.

## 1. Cómo se entra

Se desbloquea al terminar una partida de la fase 2 (sea cual sea la nota). En el resultado aparece un botón:
**«Visitar el laboratorio (seguridad de extracciones)»**. Es opcional y no da puntos a la planta.

Pantalla de entrada (texto del guía):
> «Hasta ahora practicaste cultivo y procesos sin solventes. Lo que viene es distinto: las extracciones con butano o
> con CO2 solo se hacen en laboratorios con licencia, con equipo certificado y personal formado. Aquí no vas a
> aprender a hacerlas: vas a aprender por qué son peligrosas y qué las hace seguras.» *(aprobada el 20-10-2026)*

## 2. Escena 1 — ¿Qué es una extracción? (concepto, sin práctica)

Tres tarjetas que se leen y una pregunta.
- **Solvente:** una sustancia que disuelve la resina de la planta y luego se separa. *(Fuente: Glosario →
  Hidrocarburo, Elaboración → Concentrados → Live resin / BHO.)*
- **Purgar:** quitar el solvente que queda en el extracto; si no se purga bien, quedan restos que no deben
  consumirse. *(Fuente: Concentrados → Shatter, wax… «después del purgado»; Glosario → Propano «facilita purga».)*
  **[El matiz «restos que no deben consumirse»: NUEVO — APROBAR]**
- **Sin solvente vs. con solvente:** el kief, el hachís, el bubble hash y el rosin no usan solventes (ya los viste);
  BHO y CO2 sí. *(Fuente: Concentrados.)*

Pregunta: «¿Por qué el rosin se puede practicar con cuidado y el BHO no?» → respuesta correcta: «porque el BHO usa un
gas inflamable que puede explotar». Las otras dos opciones son conceptos equivocados («porque es más caro», «porque
tarda más») y el guía explica por qué no.

## 3. Escena 2 — BHO: encuentra los peligros (una cocina)

Ilustración de una **cocina doméstica** (dibujo plano, mismo estilo de la app). El jugador toca los peligros; cada uno
abre una explicación corta. Hay **6 peligros** y **2 objetos que no son peligro** (para que piense):

| Se toca | El guía explica | Fuente |
|---|---|---|
| Quemador o piloto encendido | El butano es **inflamable**: una llama o una chispa basta para encenderlo. | Glosario → Inflamable |
| Ventana cerrada, cuarto pequeño | El gas se acumula en un espacio cerrado y puede **explotar**. | Glosario → Inflamable / A prueba de explosiones **[«se acumula»: NUEVO — APROBAR]** |
| Tubo o aparato hecho en casa | Sin **sistema cerrado certificado**, el gas sale al ambiente. | Concentrados → Live resin («extractor de circuito cerrado») |
| Enchufes, nevera, interruptores | Cualquier aparato eléctrico puede hacer una chispa; por eso los laboratorios usan equipo **a prueba de explosiones**. | Glosario → A prueba de explosiones |
| Alguien fumando | Una llama más. | Glosario → Inflamable |
| Nadie que sepa qué hacer, sin detector de gas | En un laboratorio hay **detección de gases** y personal formado. | **[NUEVO — APROBAR]** |
| (no es peligro) Una planta en la ventana | — «Esto no es un peligro: sigue buscando.» | — |
| (no es peligro) Un frasco de curado | — «Esto es de la fase 2, no es un peligro.» | — |

Al encontrar los 6, la pregunta final: «¿Qué haces en esta cocina?» Opciones:
1. **«Nada de esto: no se hace en casa. Si alguien lo está haciendo, aléjate y llama a emergencias.»** ✔ (sin número)
2. «Abrir la ventana y seguir» ✘
3. «Apagar el quemador y seguir» ✘

Toda opción ✘ lleva a: «**Detener todo y llamar a un profesional.** Arreglar un peligro no hace segura una
extracción casera: el problema es hacerla en casa.» **[Texto NUEVO — APROBAR]**

## 4. Escena 3 — El laboratorio con licencia (el contraste)

Mismo tipo de ilustración, ahora un laboratorio. El jugador toca **qué lo hace seguro** (6 elementos), sin ver nunca
cómo funciona por dentro:
- **Licencia** del laboratorio y personal formado. **[NUEVO — APROBAR]**
- **Sistema cerrado** certificado. *(Concentrados → Live resin)*
- **Equipo a prueba de explosiones.** *(Glosario)*
- **Ventilación** y **detección de gases.** **[NUEVO — APROBAR]**
- **Equipo de protección** (gafas, guantes, ropa adecuada). *(Elaboración → SOP-04 Vestimenta, como idea general)*
- **Controles e inspecciones.** *(Procesos & SOP: guías GACP / BfArM / Health Canada, como idea general)*

Ningún elemento muestra un ajuste, un número o una pantalla de máquina.

## 5. Escena 4 — CO2: alta presión (concepto)

Tarjetas y una pregunta, sin ilustración de equipo por dentro:
- El CO2 también se usa como solvente, pero **dentro de equipos a alta presión**. *(Concentrados → Live resin
  «extraído con butano o CO2»; [«alta presión»: NUEVO — APROBAR])*
- Peligros: un equipo a presión que falla puede **soltar el gas de golpe**, y mucho CO2 en un cuarto cerrado
  **desplaza el aire** que respiramos. **[NUEVO — APROBAR]**
- Por eso: **solo personal formado y equipo certificado**, igual que el BHO.

Pregunta: «¿Qué tienen en común el BHO y el CO2?» → ✔ «Los dos necesitan equipo certificado y personal formado en un
laboratorio con licencia.» ✘ «El CO2 se puede hacer en casa porque no se enciende» → «No: no se enciende, pero la
presión y la falta de aire también son peligros graves. Detener todo y llamar a un profesional.»

## 6. Final de la fase

Resumen sin nota numérica (no hay «mejor o peor extractor»): «Encontraste los peligros de la cocina, sabes qué hace
seguro un laboratorio y por qué el CO2 también es peligroso.» Botones: **Repasar Elaboración → Concentrados** y
**Volver a la partida**. Se guarda como «laboratorio visitado» (no hay puntos, ni insignias que comparar).

## 7. Lo que el juego NUNCA muestra (lista para la prueba automática)

- Cifras de cualquier tipo en la fase 3 (la prueba buscará dígitos en todos sus textos, en los 4 idiomas).
- Palabras de procedimiento: «paso 1», «llenar», «cargar el gas», «tiempo de purga», «vacío a…», nombres de piezas
  de equipo por dentro, recipientes, cantidades.
- Marcas, modelos, tiendas o enlaces a equipo, gases o solventes.
- Una manera de «ganar» haciendo la extracción.

## 8. Lo que necesito que decidas

1. ¿Apruebas el guion tal cual, o con cambios? (Puedes cambiar textos, quitar escenas o añadir peligros.)
2. Los textos marcados **[NUEVO — APROBAR]** no están en la plataforma: ¿los apruebas, los quitas, o prefieres que
   primero se añadan a la plataforma (Glosario o Concentrados) y el juego los tome de ahí?
3. ¿Mostramos el número de emergencias? Cambia por país; propongo decir solo «llamar a emergencias», sin número.
4. ¿Ilustración de la cocina y del laboratorio dibujada en el mismo estilo plano de la app (la hago como el
   científico, en SVG) o solo tarjetas de texto?

## 9. Pendiente para el Glosario de la plataforma (textos aprobados el 20-10-2026)

Estos textos ya están en el juego y quedan aprobados; falta **añadirlos al Glosario** (o a Concentrados) para que la
plataforma también los enseñe. No se ha tocado el Glosario todavía.

1. **Purgar:** «si no se purga bien, quedan restos que no deben consumirse».
2. **Gas acumulado:** «el gas se acumula en un espacio cerrado y puede explotar».
3. **Detección de gases:** «en un laboratorio hay detección de gases y personal formado».
4. **Extracción casera:** «Detener todo y llamar a un profesional. Arreglar un peligro no hace segura una extracción
   casera: el problema es hacerla en casa.»
5. **Laboratorio con licencia:** «licencia del laboratorio y personal formado».
6. **Ventilación y detección de gases** como parte de lo que hace seguro un laboratorio.
7. **CO2, alta presión:** «el CO2 se usa como solvente dentro de equipos a alta presión».
8. **Peligros del CO2:** «un equipo a presión que falla puede soltar el gas de golpe, y mucho CO2 en un cuarto cerrado
   desplaza el aire que respiramos».
