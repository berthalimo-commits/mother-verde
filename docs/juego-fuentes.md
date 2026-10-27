# Juego — de dónde sale cada regla (fuentes)

Rama: **`juego`**. Revisión de las fases 1 y 2 ya construidas y base para las fases 3, 4 y 8.
Fecha de la revisión: 2026-10-27.

## Cómo leer esta tabla

**Nivel de respaldo**
- **Estudio publicado** — artículo revisado por pares que **abrí y leí** (al menos el resumen).
- **Guía técnica** — servicio de extensión de una universidad o de un gobierno; **abrí la página y la frase está
  ahí** (la cito entre comillas).
- **Práctica de cultivadores** — lo que dice la plataforma y repiten los cultivadores, pero **no encontré** (o no
  pude abrir) una fuente universitaria o un estudio que lo diga.
- **Simplificación del juego** — una regla que existe para que el juego funcione (puntos, semanas, dibujos).
  No pretende ser un dato real.
- **Sin fuente** — no encontré respaldo comprobable. Hay que decidir si se queda, se cambia o se quita.

**Columna «Comprobado»**
- ✅ abrí la página y la frase está (cito el texto en inglés tal como aparece).
- 🔗 el enlace existe, pero no pude leerlo (el sitio bloquea a los programas o tardó demasiado), o lo leí y **no**
  dice esto.
- — no hay fuente externa.

Regla: **no hay citas inventadas.** Si la plataforma enlaza una fuente que no dice lo que el juego usa, lo
digo. Las cifras que el juego muestra hoy salen de la plataforma; aquí digo si además tienen respaldo externo.

## Fuentes comprobadas (abiertas y leídas el 2026-10-27)

| Código | Fuente | Tipo | Qué dice (texto literal) |
|---|---|---|---|
| **F1** | Rodriguez-Morrison, Llewellyn & Zheng (2021). *Cannabis Yield, Potency, and Leaf Photosynthesis Respond Differently to Increasing Light Levels in an Indoor Environment.* Frontiers in Plant Science 12. Universidad de Guelph. https://www.frontiersin.org/articles/10.3389/fpls.2021.646020/full | Estudio publicado | Vegetativo con «an 18-h light/6-h dark photoperiod» y luego 12 semanas en «12-h light/12-h dark "flowering" photoperiod»; «dry inflorescence yield increased linearly with increasing canopy-level PPFD up to 1,800 μmol·m−2·s−1». |
| **F2** | Utah State University Extension — *Hemp nutrient deficiencies.* https://extension.usu.edu/planthealth/ipm/notes_ag/hemp-nutrient-deficiencies | Guía técnica | Nitrógeno: «Chlorosis (yellowing) beginning on older leaves starting at leaf tips and moving toward center». |
| **F3** | UC IPM (University of California) — *Pythium root rot.* https://ipm.ucanr.edu/agriculture/floriculture-and-ornamental-nurseries/pythium-root-rot/ | Guía técnica | «Under wet conditions brought about by poor soil drainage or excess irrigation»; «the plant may wilt, stop growing, or even collapse and die»; «emphasis is placed on providing good drainage and water management». |
| **F4** | Utah State University Extension — *Hemp bud rot.* https://extension.usu.edu/planthealth/ipm/notes_ag/hemp-bud-rot | Guía técnica | Problema «during flower-bud formation under prolonged (one week or longer) greenhouse humidity»; «Keep relative humidity in greenhouse to below 50%»; «Allow proper spacing between plants … to promote airflow». |
| **F5** | Utah State University Extension — *Hemp powdery mildew.* https://extension.usu.edu/planthealth/ipm/notes_ag/hemp-powdery-mildew | Guía técnica | «White, powdery spots that may expand to cover leaves, stems, or flower buds»; «Space out field or greenhouse plantings to allow for air circulation»; «Drip irrigation will lessen the chance of higher humidity, and reduce infection potential». |
| **F6** | NC State Extension — *Twospotted spider mite in industrial hemp.* https://content.ces.ncsu.edu/twospotted-spider-mite-in-industrial-hemp | Guía técnica | «They thrive in high temperatures and low humidity»; «Mites prefer water stressed plants»; daño: «a speckled or wilted appearance to the tops of the leaves»; «TSSM also produces webbing». |
| **F7** | Cornell Chronicle (2023) — *Gene discovery takes aim at hemp nemesis powdery mildew.* https://news.cornell.edu/stories/2023/09/gene-discovery-takes-aim-hemp-nemesis-powdery-mildew (la cita la plataforma en Diagnóstico → Oídio) | Noticia universitaria | «Its spores look like white powdery patches on leaves». **No** habla de humedad ni de ventilación. |

Enlaces que cita la plataforma y **no** pude leer: hemp.ucdavis.edu (Producing hemp; IPM) y extension.oregonstate.edu
(EM 9622) responden 403 a los programas (no están rotos); la guía GPP de Health Canada (canada.ca) no respondió a
tiempo. La tesis de Wageningen que cita la plataforma para «Floración: luz · humedad» existe (Holweg, 2025), pero
su resumen **no** da fotoperiodo, PPFD ni humedad.

## 1. Fase 1 — botón «¡Juega ya!»

| Regla | Fuente | Nivel | Comprobado |
|---|---|---|---|
| El juego es parte del acceso completo | Regla de la plataforma (modelo de acceso) | No es una regla de cultivo | — |

No hay reglas de cultivo en esta fase.

## 2. Reglas de cultivo (rules.json, fase 1 del juego v1, en uso)

| Regla del juego | Fuente | Nivel | Comprobado |
|---|---|---|---|
| Vegetativo con luz 18/6 | Plataforma: Cultivo → Ciclo y Sistemas. **F1** usa 18/6 en vegetativo | Estudio publicado (como protocolo) + práctica estándar | ✅ F1 |
| 12/12 inicia la floración | Plataforma: Cultivo → Ciclo y Sistemas. **F1** usa 12/12 para florecer | Estudio publicado (como protocolo) | ✅ F1 |
| Floración con intensidad alta = mejor | Plataforma: Iluminación (PPFD 600–1.000). **F1**: el rendimiento sube con más luz, hasta 1.800 | Estudio publicado (la dirección). El **rango 600–1.000** de la plataforma no está en F1 | ✅ F1 (dirección) |
| Plántula con intensidad baja (PPFD 100–300); vegetativo media (300–600) | Plataforma: Iluminación | Práctica de cultivadores | — |
| Riego moderado; «mucho» enferma la raíz y la planta se marchita | Plataforma: Diagnóstico → Exceso de riego. **F3** | Guía técnica | ✅ F3 |
| «Poco» riego estresa la planta | **F6**: los ácaros prefieren plantas con estrés de agua | Guía técnica (indirecta) | ✅ F6 |
| Nutrientes medios (EC 1,2–2,2; pH 5,8–6,2) | Plataforma: Sistemas (cita hemp.ucdavis.edu) | Práctica de cultivadores (cifras **sin fuente comprobada**) | 🔗 |
| Nutrientes bajos en vegetativo → carencia de nitrógeno (hojas viejas amarillas) | Plataforma: Diagnóstico. **F2** | Guía técnica | ✅ F2 |
| Temperatura templada 24–28 °C de día | Plataforma: Sistemas | Práctica de cultivadores (**sin fuente comprobada**) | — |
| Humedad media-alta (≈ 65–75 %) en vegetativo | Indicación de Bertha (14-10-2026) con el VPD de la plataforma | Práctica de cultivadores | — |
| Humedad baja (40–50 %) en floración | Plataforma: Sistemas. **F4**: «below 50%» para evitar la pudrición del cogollo | Guía técnica | ✅ F4 |
| Plántula 2 semanas; vegetativo de 3 a 6 semanas | Plataforma: Ciclo | Simplificación del juego | — |
| Cosechar por tricomas: transparentes → lechosos → mezcla con ámbar → ámbar | Plataforma: Cosecha | Práctica de cultivadores (no encontré un estudio que ligue el color con el punto de cosecha) | — |
| «Ámbar = el THC se degrada hacia CBN» | Plataforma: Cosecha | Práctica de cultivadores (**sin fuente comprobada** para el vínculo con el color) | — |
| Semanas en que aparece cada estado de los tricomas (6, 8, 10) | rules.json | Simplificación del juego | — |
| Si nadie cosecha, la planta se cosecha sola a las 12 semanas de flor | rules.json | Simplificación del juego | — |
| Puntos: salud 100; −4 un nivel, −8 dos niveles o fotoperiodo; −6 por semana con un problema; +4 al resolverlo | rules.json | Simplificación del juego | — |
| Un problema aparece tras 2 semanas seguidas de malas condiciones | rules.json | Simplificación del juego | — |

## 3. Problemas (eventos)

| Problema → condición en el juego | Respuesta correcta | Fuente | Nivel | Comprobado |
|---|---|---|---|---|
| Oídio ← humedad alta | Ventilar | **F5** (síntoma; espaciar para que circule el aire; menos humedad = menos infección). **F7** solo el síntoma | Guía técnica | ✅ F5, F7 |
| Botrytis ← humedad alta en floración | Bajar la humedad | **F4** | Guía técnica | ✅ F4 |
| Ácaros ← calor y humedad baja | Depredadores naturales | **F6** (calor y humedad baja; punteado y telarañas). La respuesta «depredadores» la da la plataforma; **F6** no la leí sobre control biológico | Guía técnica (condición) · Práctica de cultivadores (respuesta) | ✅ F6 (condición) |
| Carencia de nitrógeno ← nutrientes bajos en vegetativo | Ajustar la nutrición | **F2** | Guía técnica | ✅ F2 |
| Exceso de riego ← riego «mucho» | Dejar secar entre riegos | **F3** («good drainage and water management») | Guía técnica | ✅ F3 |

## 4. Fase 2 — lo que se dibuja en la carpa

| Lo que se ve | Fuente | Nivel | Comprobado |
|---|---|---|---|
| Hojas pálidas o amarillas cuando baja la salud | — (la salud del juego es una cifra inventada para jugar) | Simplificación del juego. El amarilleo real tiene causas concretas (F2, F3) | — |
| Sustrato seco / húmedo / empapado con agua en el suelo | — | Simplificación visual | — |
| Brillo de la lámpara según la intensidad | — | Simplificación visual | — |
| La planta crece cada semana; en floración estira hasta 3 semanas | — | Simplificación del juego (el «estirón» es práctica de cultivadores, sin fuente comprobada) | — |
| Cogollos con tricomas que pasan a blancos y ámbar | Plataforma: Cosecha | Práctica de cultivadores | — |
| Secado: ramas colgadas boca abajo, carpa a oscuras | Plataforma: Equipamiento → 5. Secado («espacio 100 % oscuro») | Práctica de cultivadores | — |
| Curado en frascos de vidrio | Plataforma: Equipamiento → 6. Curado | Práctica de cultivadores | — |
| Planta marchita cuando la salud llega a 0 | — | Simplificación del juego (F3 sí dice que el exceso de riego puede matar la planta) | — |

## 5. Secado, curado y rosin (fase 2 del juego v1, en uso; la fase 8 lo rehará)

| Regla del juego | Fuente | Nivel | Comprobado |
|---|---|---|---|
| Secado fresco (15–18 °C) | Plataforma: Procesos & SOP → SOP-01 (cita la guía GPP de Health Canada) | Práctica de cultivadores (cifras **sin fuente comprobada**) | 🔗 |
| Secado con humedad media (55–60 %) | Plataforma: SOP-01 | Práctica de cultivadores (**sin fuente comprobada**) | 🔗 |
| Aire contra la pared, nunca directo a las flores | Plataforma: Equipamiento → 5. Secado | Práctica de cultivadores | — |
| Secar a oscuras | Plataforma: Equipamiento → 5. Secado | Práctica de cultivadores | — |
| Terminar el secado por la «prueba del chasquido» (7–14 días) | Plataforma: SOP-01 y Temporizador de secado | Práctica de cultivadores | — |
| Curar en vidrio hermético | Plataforma: Equipamiento → 6. Curado | Práctica de cultivadores | — |
| Humedad en el frasco 58–62 % | Plataforma: SOP-02 | Práctica de cultivadores (**sin fuente comprobada**) | — |
| Abrir el frasco a diario la primera semana | Plataforma: Temporizador de secado | Práctica de cultivadores | — |
| Curar de 2 a 4 semanas como mínimo | Plataforma: SOP-02 | Práctica de cultivadores (**sin fuente comprobada**) | — |
| Rosin: material ya curado | Plataforma: Concentrados | Práctica de cultivadores | — |
| Rosin: calor «medio» (sin cifras) | Plataforma: Concentrados / Técnicas caseras | Práctica de cultivadores | — |
| Rosin: papel pergamino, sin solventes | Plataforma: Concentrados | Práctica de cultivadores | — |
| Rosin: presión | La plataforma no da un nivel | **Sin fuente** — hoy no puntúa | — |
| Rosin: guantes contra quemaduras | Diseño de la fase 2 (seguridad) | Simplificación del juego (sentido común de seguridad) | — |

## 6. Laboratorio de seguridad BHO / CO₂

Sigue **solo conceptual**: sin números, sin pasos, sin marcas. No se toca. Sus mensajes de seguridad vienen de la
plataforma y de los avisos de OSHA / NIOSH que la plataforma ya enlaza. Este archivo no añade nada a ese laboratorio.

## Lo que falta (para Bertha)

**Sin fuente comprobada** (hoy se usan porque los da la plataforma):
1. Rangos de PPFD por etapa (100–300 / 300–600 / 600–1.000).
2. EC 1,2–2,2 y pH 5,8–6,2.
3. Temperatura 24–28 °C de día.
4. Secado a 15–18 °C y 55–60 % de humedad; curado a 58–62 % y de 2 a 4 semanas.
5. El color de los tricomas como punto de cosecha, y «ámbar = CBN».
6. La presión del rosin (no hay ningún dato).

**Posibles fuentes que encontré pero no pude abrir:**
- Un estudio de la Universidad de Georgia sobre secado y curado (openscholar.uga.edu/record/27813): la página bloquea
  a los programas.
- La guía GPP de Health Canada: no respondió a tiempo.

No las cito como comprobadas. Si Bertha las abre y confirma lo que dicen, paso esas filas a «guía técnica» o
«estudio publicado».

## Cómo se ve en el juego («¿Por qué?»)

Cada consecuencia del juego (una semana con pérdida de salud, un problema, la planta marchita, la nota de la
cosecha, el secado y el curado) lleva un botón **«¿Por qué?»**. Al tocarlo se abre:
- la razón en una o dos frases;
- un botón a la lección de la plataforma;
- si la hay, la fuente comprobada de esta tabla (código F1–F7).

Si la regla es una simplificación del juego, lo dice tal cual. Los textos están en `src/game/why.js`.
