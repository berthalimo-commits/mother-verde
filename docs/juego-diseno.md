# Zona del juego — diseño (fase 1: cimientos y cultivo)

Rama `juego` (sale de `dev`). Nada en producción y sin merge. Es una **simulación educativa** para practicar lo que
enseña la plataforma: sin dinero real, sin apuestas, sin cajas sorpresa, sin tablas de clasificación y sin chat. Solo
para mayores de edad (la misma pregunta de edad de la web y un aviso propio en la portada del juego).

## 1. El bucle del juego (por turnos)

Un turno = **una semana** de la planta. En cada turno:

1. **El científico** (el mismo que vuela por la plataforma) cuenta en qué etapa está la planta y qué conviene
   mirar esa semana, con un enlace a la lección de la plataforma.
2. **La persona decide** los 6 ajustes de la semana (ver punto 3).
3. **Se aplica la semana**: la salud de la planta sube o baja según las reglas de `src/game/rules.json`.
4. Si una mala condición se repite **2 semanas seguidas**, aparece un **evento** (moho, plaga, carencia, exceso de
   riego). La persona elige una respuesta, y el científico explica si era la correcta y por qué.
5. **Se guarda** (en su cuenta y en el navegador) y se pasa a la semana siguiente.

No hay azar: con las mismas decisiones, siempre pasa lo mismo. Así el juego enseña causa y efecto, y al recargar
nunca se repite ni cambia nada.

## 2. Las etapas

| Etapa | Turnos | Qué se practica | Lección de la plataforma |
|---|---|---|---|
| Semilla / plántula | 2 | luz suave, 18/6, no encharcar | Cultivo → Propagación, Ciclo |
| Vegetativo | de 3 a 6 (la persona decide cuándo pasar a 12/12) | 18/6, luz media, nutrición, temperatura, humedad | Cultivo → Sistemas, Iluminación |
| Floración | hasta que la persona cosecha (máximo 12) | 12/12, luz alta, humedad baja, mirar los tricomas | Cultivo → Iluminación, Cosecha |
| Cosecha | 1 | elegir el momento por el estado de los tricomas | Cultivo → Cosecha |
| Secado y curado | **fase 2** | — | Elaboración → Procesos |

El paso a floración lo decide la persona: en vegetativo, elegir **12/12** cambia de etapa (si lo hace antes de la
semana 3 de vegetativo, el científico avisa de que es pronto y resta salud).

## 3. Las decisiones de cada turno

| Decisión | Opciones | Qué significa (cifras de la plataforma) |
|---|---|---|
| Luz: horas | 18/6 · 12/12 | fotoperiodo |
| Luz: intensidad | baja · media · alta | PPFD 100–300 · 300–600 · 600–1.000 µmol/m²/s |
| Riego | poco · moderado · mucho | «moderado» = dejar secar el sustrato entre riegos |
| Nutrientes | bajo · medio · alto | EC por debajo de 1,2 · 1,2–2,2 · por encima de 2,2 mS/cm |
| Temperatura | fresca · templada · cálida | por debajo de 24 · 24–28 · por encima de 28 °C (de día) |
| Humedad | baja · media-alta · alta | HR 40–50 % (ideal en floración) · ≈ 65–75 % (ideal en vegetativo: VPD 0,8–1,0 kPa a 24–25 °C, indicado por la dueña, lo confirmará Bertha) · por encima de ≈ 75 % |

Lo ideal de cada etapa está en `src/game/rules.json`. Donde la plataforma **no da un dato** (por ejemplo, la
temperatura en floración o la humedad de la plántula), el valor es `null` y **esa decisión no puntúa** en esa etapa.
No se inventó ninguno. Cada valor lleva la marca **[POR VERIFICAR POR BERTHA]**.

## 4. Los eventos

| Evento | Aparece si… (2 semanas seguidas) | Respuesta correcta | Fuente en la plataforma |
|---|---|---|---|
| Oídio | humedad alta | ventilar | Cultivo → Diagnóstico |
| Botrytis | humedad alta en floración | bajar la humedad y retirar lo afectado | Cultivo → Diagnóstico |
| Ácaros | temperatura cálida + humedad baja | depredadores naturales | Cultivo → Diagnóstico |
| Carencia de nitrógeno | nutrientes bajos en vegetativo | ajustar la nutrición | Cultivo → Diagnóstico |
| Exceso de riego | riego «mucho» | dejar secar entre riegos | Cultivo → Diagnóstico |

Cada evento muestra el síntoma tal como lo describe la plataforma, 4 respuestas posibles y el enlace a Diagnóstico.

## 5. Cómo se puntúa

- **Salud** de la planta, de 0 a 100. Empieza en 100.
- Cada decisión ideal no resta nada. Un nivel de distancia resta 4, dos niveles restan 8 y el fotoperiodo
  equivocado resta 8.
- Un evento sin resolver resta 6 por semana. Resolverlo bien devuelve 4.
- **Cosecha**: suma o resta según los tricomas (transparentes −15, lechosas +15, mezcla con 10–30 % de ámbar +20,
  ámbar +5).
- **Resultado final** = salud + puntos de la cosecha, de 0 a 100, con un resumen de qué salió bien y qué repasar
  (con enlaces a las lecciones). Sin rankings ni comparaciones con otras personas.
- Si la salud llega a 0, la planta no sobrevive: el científico explica las 3 causas principales y se puede empezar
  otra planta.

Todas estas cifras son **valores de juego** (ritmo), no datos de cultivo, y también están en `rules.json` para
ajustarlas sin tocar el código.

## 6. Conexión con las lecciones

- Cada etapa y cada evento tienen un botón «Repasar la lección» que abre la sección exacta de la plataforma
  (`showSub('cultivo','iluminacion')`, etc.).
- El resumen final enlaza las lecciones de las decisiones que más salud restaron.
- **Fase 4**: aprobar el juego (o partes) desbloquea herramientas de la plataforma «dentro» del juego (por ejemplo,
  usar la calculadora de VPD o de DLI en el invernadero del juego).

## 7. El científico como guía

Se reutiliza **el mismo dibujo** del científico que vuela por la plataforma (`createMiniScientist` en `main.js`:
cuerpo verde, cabeza con gafas turquesa y sonrisa, sin texto). En la fase 1 aparece tal cual, sin animación de vuelo, junto al globo
de texto del guía.

**Poses y expresiones nuevas que harían falta** (aprobadas el 20-10-2026; dibujadas en `src/game/poses.js`, el juego elige la pose según lo que pasa):
1. **Preocupado** (boca hacia abajo, cejas inclinadas): cuando aparece un evento.
2. **Contento** (sonrisa grande, brazos arriba): decisión correcta o buena cosecha.
3. **Explicando** (un brazo señalando): portada y consejos de cada etapa.
4. **Con lupa**: revisar los tricomas.
5. **Con casco y gafas de laboratorio**: fase 3, avisos de seguridad del BHO y del CO2.
6. **Pensando** (mano en la barbilla): cuando falta un dato y la decisión no puntúa.

## 8. Plan de las fases siguientes

**Fase 2 — secado, curado y prensa de rosin.** Secado (sala fresca y con humedad media, 7–14 días según la
plataforma), curado en frasco (HR 58–62 %, mínimo 2–4 semanas) y una prensa de rosin **solo cualitativa**: niveles
bajo/medio/alto de calor y presión, sin temperaturas, tiempos ni cantidades, y con avisos de seguridad (superficies
calientes, quemaduras). **Decidido (14-10-2026):** el texto de la plataforma sobre el rosin se queda tal cual;
dentro del juego, solo niveles cualitativos, sin ninguna cifra.

**Fase 3 — BHO y CO2 (conceptual y de seguridad).** Sin ninguna cifra, cantidad, presión, temperatura ni paso que se
pueda copiar. El jugador **no** «hace» una extracción: recorre un laboratorio y aprende **por qué** es peligrosa y
**qué la hace segura**:
- BHO: el butano es inflamable y puede **explotar**; solo en **laboratorios con licencia y equipo certificado**, en
  **sistema cerrado**, con **ventilación** y detección de gases. Nunca en casa. El objetivo del jugador es
  **detectar los peligros** (llamas, espacio cerrado, equipo casero) y **no** seguir una receta.
- CO2: equipo a alta presión, solo personal formado y equipo certificado. Explicación de conceptos (qué es un
  solvente, por qué se purga) sin parámetros.
- Si el jugador elige una opción insegura, el resultado es siempre «detener y llamar a un profesional», nunca una
  versión casera «mejor hecha».
Antes de implementarla, te paso el guion completo de esta fase para que lo apruebes.

**Fase 4 — lecciones que desbloquean herramientas y pulido final.** Las lecciones leídas desbloquean herramientas
dentro del juego (calculadoras de VPD y DLI, lupa de tricomas). Animaciones con las poses nuevas, sonido opcional
(apagado por defecto) y revisión completa de accesibilidad.

## 9. Cómo está construido (resumen técnico)

- **Variable de compilación** `VITE_MV_GAME`: encendida solo en el servidor local y en la compilación de la rama
  `juego` de Vercel (o a mano con `MV_GAME=1`). En `main` y en `dev` está **apagada**: no se compila ni el menú ni
  el juego.
- **Carga diferida**: el juego vive en `src/game/` y se descarga **solo cuando se entra al juego**. Con la variable
  encendida, la web descarga además un archivo pequeño que añade la entrada «Juego» al menú.
- **Textos**: el mismo sistema `translations` y `t()` de la plataforma. Los textos del juego viajan dentro del
  archivo del juego y se registran en ese sistema al cargarlo (así no engordan `main.js`). El cambio de idioma en
  vivo vuelve a dibujar el juego.
- **Acceso**: el mismo que el resto. En la pantalla se usa `mvAccessState()`: con la prueba de 24 h, el aporte o
  el regalo se juega; si no, aparece la **misma pantalla de bloqueo** (`showScreen` manda a «acceso»). En el
  **servidor**, guardar exige `has_full_access()`, la misma regla de la base que usa la Comunidad.
- **Modo claro**: la plataforma hoy solo tiene modo oscuro. El juego usa las mismas variables de color (`--paper`,
  `--ink`, `--moss`…), así que seguirá automáticamente a la plataforma cuando tenga modo claro. No se añadió un modo
  claro propio para no desentonar con el resto.
- **Memoria**: tabla `game_progress` (una fila por persona). Detalle en `docs/juego-informe.md`.
