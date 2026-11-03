# Juego v2: la carpa de cultivo que se ve (diseño, paso 0)

Rama: **`juego`** solamente. Nada de esto va a `main`, a `dev` ni a producción hasta que Bertha lo apruebe.
El diseño actual de la plataforma se queda; el **científico** sigue siendo el guía (sin Verdi).

**La idea.** Hoy el juego es una lista de opciones por semana y no se ve nada. La versión 2 es como Los Sims:
la persona **ve una carpa de cultivo** con su planta, **da órdenes tocando las cosas de la carpa** (la luz, el
riego, los nutrientes, el ventilador, el clima) y **ve cómo la planta reacciona**: crece, cambia de color, se
enferma o se recupera. Los datos de cultivo los decide Bertha; aquí van solo **propuestas** para que ella corrija.

---

## 1. Lo que ya existe y se mantiene

- Simulación educativa, solo para mayores de 18, sin dinero ni rankings (el aviso se sigue viendo al entrar).
- Acceso solo con acceso completo (prueba de 24 h, aporte o código de regalo). El servidor también lo comprueba.
- Guardado en la cuenta, con copia en el dispositivo si no hay internet.
- 4 idiomas (ES, EN, DE, FR) con el mismo sistema de textos de la app.
- Secado, curado y **rosin solo cualitativo** (niveles, sin cifras).
- **Laboratorio de seguridad BHO/CO₂**: solo conceptos y seguridad. **No se toca**: sin cifras, sin pasos, sin marcas.
- El juego se descarga **solo al abrirlo**; el laboratorio, solo al visitarlo.
- El interruptor del juego: solo existe en la rama `juego` (o con `MV_GAME=1`). En `main` y `dev` no se compila
  **nada** del juego, tampoco los botones nuevos.

**Peso hoy** (compilación de la rama `juego`):

| Parte | Peso | Comprimido | Cuándo se descarga |
|---|---|---|---|
| Entrada del juego (menú) | 2,2 KB | 1,1 KB | al abrir la web (solo en `juego`) |
| Juego | 86,4 KB | 27,7 KB | al entrar al juego |
| Laboratorio | 36,7 KB | 13,0 KB | al pulsar «Visitar el laboratorio» |
| Resto de la web (`main.js`) | sin cambio en todas las fases | | |

---

## 2. Las fases de construcción

Cada fase se entrega sola, con sus pruebas, capturas (ES/EN/DE/FR, computadora y celular) y un resumen corto.
**No empiezo la siguiente hasta que Bertha escriba «sigue».**

### Fase 1 — Botón «¡Juega ya!» (esfuerzo: pequeño)
**Qué se ve:**
- Un botón destacado **«¡Juega ya!»** en la barra de arriba, fuera del menú «Más».
- Otro botón en la portada de Inicio, junto a los botones principales.
- Textos: ES «¡Juega ya!», EN «Play now!», DE «Jetzt spielen!», FR «Joue maintenant !».
- **Sin acceso completo:** el botón lleva a **Desbloquear** con un mensaje claro («El juego es parte del acceso
  completo…»), nunca a un error.
- En el celular el botón de arriba se hace más corto (icono + texto corto) para no romper la barra.
- Solo aparece donde el juego está encendido. En `main` y `dev` no existe.

**Peso:** +1 KB en la entrada (el juego sigue cargándose solo al abrirlo).
**Pruebas:** el botón existe solo con el juego encendido; con y sin acceso; 4 idiomas en vivo; celular y
computadora; teclado; la web sin el juego no cambia ni un byte.

### Fase 2 — La carpa se ve (esfuerzo: grande)
**Qué se ve:**
- Una carpa de cultivo dibujada: estructura, paredes plateadas por dentro, la lámpara arriba, un ventilador,
  la maceta y la planta.
- **La planta en cada etapa:** semilla y germinación, plántula, vegetativo, floración (con cogollos que
  crecen), cosecha, secado (ramas colgadas) y curado (frascos).
- **La luz:** encendida (brillo cálido) o apagada (carpa oscura). Un reloj de luz muestra el fotoperiodo
  (18/6 o 12/12) como un círculo con la parte de día y la de noche.
- **Los indicadores:** un termómetro, un medidor de humedad y un medidor de pH/EC con colores (bajo, bien, alto).
  Muestran el **nivel** de lo que la persona eligió, no números inventados.
- La escena sigue el modo claro y el oscuro y se ve bien en celular y computadora.
- **Para quien no ve la imagen:** una descripción en texto de lo que pasa en la carpa, que cambia cada semana.

La escena va en su propio archivo, que se descarga **junto con el juego** (no al abrir la web).
**Peso:** +20 a 30 KB (7 a 10 KB comprimido).
**Pruebas:** cada etapa se dibuja; luz y fotoperiodo correctos; indicadores según lo elegido; descripción en
texto; contraste ≥ 4,5; sin desbordes a 360 px; sin romper la CSP.

### Fase 3 — Dar órdenes tocando la carpa (esfuerzo: mediano)
**Qué se ve:**
- Se toca (o se elige con el teclado) un objeto de la carpa y se abre su panel:
  - la lámpara → fotoperiodo e intensidad;
  - la regadera → riego;
  - la botella de nutrientes → nutrientes;
  - el termómetro/calefactor → temperatura;
  - el humidificador → humedad.
- El botón «Pasar la semana» confirma.
- La lista de opciones de hoy se queda debajo como alternativa (para teclado, lectores de pantalla y quien la
  prefiera), con las mismas reglas.

**Peso:** +5 a 8 KB (2 a 3 KB comprimido).
**Pruebas:** cada objeto abre su panel; el teclado llega a todos (Tab, Enter, Escape); la orden dada en la
carpa y la de la lista dan exactamente el mismo resultado; botones ≥ 44 px.

### Fase 4 — Los problemas se ven y la semana se anima (esfuerzo: mediano)
**Qué se ve en la planta:**

| Problema | Cómo se ve |
|---|---|
| Oídio | manchas blancas como polvo en las hojas |
| Botrytis | cogollos que se vuelven grises/marrones |
| Ácaros | puntitos claros en las hojas y finas telarañas |
| Carencia de nitrógeno | hojas de abajo amarillas, de abajo hacia arriba |
| Exceso de riego | hojas caídas y blandas, sustrato oscuro y brillante |

- Al resolver el problema bien, la planta se recupera poco a poco.
- **La semana se anima:** la planta crece suavemente, caen gotas al regar, la luz se apaga y enciende.
- Con «reducir movimiento» activado en el sistema, no hay animaciones: el cambio se ve de golpe.

**Peso:** +8 a 12 KB (3 a 4 KB comprimido).
**Pruebas:** cada problema se ve en la planta y aparece en la descripción en texto; las animaciones se apagan
con «reducir movimiento»; nada se mueve más de 5 segundos seguidos.

### Fase 5 — Nuevo guardado en la base de datos (esfuerzo: pequeño)
- El servidor solo acepta en el guardado las claves que conoce. El sistema de cultivo y el método de
  germinación son **claves nuevas**: hace falta una **migración nueva**, además de la 20261015100000.
- Archivos:
  - la migración, en `supabase/migrations/` (para que las pruebas la usen);
  - una copia lista para pegar en `supabase/staging/`;
  - su reversa, también en `supabase/staging/`.
- **Orden al pegarla:** primero la 20261015100000 (paso 4) y después esta. **Solo en staging.** Producción, el día
  que Bertha lo apruebe.
- Va **antes** de las fases 6 y 7: sin ella, el servidor rechazaría el guardado con sistema y germinación.

**Peso en la web:** 0 KB.
**Pruebas:** acepta las claves nuevas solo con valores conocidos; rechaza cualquier otra cosa; una partida
guardada con la versión anterior sigue funcionando; la reversa deja todo como antes.

### Fase 6 — Elegir el sistema de cultivo (esfuerzo: grande)
**Qué se ve:**
- Al empezar, 4 tarjetas con un dibujo: **tierra, coco, hidroponía, aeroponía**.
- Cada uno cambia la carpa:
  - tierra: maceta de tela con tierra oscura;
  - coco: maceta con fibra clara y bandeja de drenaje;
  - hidroponía: cubo con tapa, raíces en el agua y burbujas;
  - aeroponía: cámara cerrada, raíces en el aire y niebla a ratos.
- Cada uno cambia las reglas: cuánto y cada cuánto regar, qué riesgos aparecen más, qué tan rápido crece y
  cuánto perdona los errores (ver la lista del punto 4).
- El científico explica el error típico de cada sistema.

**Peso:** +10 a 15 KB de dibujos y textos y +3 a 5 KB de reglas (4 a 6 KB comprimido en total).
**Pruebas:** una partida completa con cada sistema; cada uno castiga su error típico; el guardado y la recarga
recuerdan el sistema; 4 idiomas.

### Fase 7 — Elegir el método de germinación (esfuerzo: mediano)
**Qué se ve:**
- Antes de la plántula, 3 opciones: **papel húmedo, cubo/jiffy, directa en el sustrato**.
- Se ve la semilla abriéndose en el papel, en el cubo o en la tierra, y el trasplante cuando toca.
- Cada método cambia los riesgos y el tiempo de las primeras semanas (ver la lista del punto 4).
- Si una combinación no tiene sentido (por ejemplo, siembra directa en aeroponía), no se ofrece y el
  científico explica por qué.

**Peso:** +5 a 8 KB (2 a 3 KB comprimido).
**Pruebas:** cada método con cada sistema permitido; las combinaciones no permitidas no se pueden elegir;
guardado y recarga.

### Fase 8 — Secado y curado se ven (esfuerzo: mediano)
**Qué se ve:**
- Las ramas colgadas en la carpa a oscuras, con el ventilador hacia la pared.
- Los frascos de curado que se abren para «airear».
- El resultado según lo elegido (cogollos bien secos o con problemas).
- El rosin sigue igual: solo niveles, sin cifras, con su aviso de seguridad. El laboratorio no cambia.

**Peso:** +6 a 10 KB (2 a 3 KB comprimido).
**Pruebas:** las de secado, curado y rosin de hoy siguen pasando; ninguna cifra en rosin ni en el laboratorio.

### Fase 9 — Pulido final 10/10 (esfuerzo: mediano)
- Repaso completo: accesibilidad (teclado, lector de pantalla, contraste, «reducir movimiento»), textos en los
  4 idiomas, celular pequeño y pantalla grande, claro y oscuro, velocidad de carga.
- Informe final con todas las capturas, los pesos y la lista de lo que queda para Bertha.

**Peso:** sin cambio (o algo menos, si algo se puede aligerar).

### Resumen de pesos

| | Hoy | Al final (estimado) |
|---|---|---|
| Entrada (al abrir la web, solo en `juego`) | 2,2 KB (1,1 comprimido) | ~3 KB (~1,5 comprimido) |
| Juego + carpa (al entrar al juego) | 86,4 KB (27,7 comprimido) | ~140 a 170 KB (~45 a 55 comprimido) |
| Laboratorio (al visitarlo) | 36,7 KB (13,0 comprimido) | sin cambio |
| Resto de la web | — | **sin cambio** |

### Orden recomendado
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9.

- **Las fases 1 a 4 no necesitan ningún dato nuevo de Bertha.** Usan las reglas de hoy.
- Mientras se construyen, Bertha puede revisar la lista del punto 4, que hace falta para las fases 6 y 7.
- La fase 5 va justo antes de la 6.

---

## 3. Reglas que sigo en todas las fases

- **Ramas:** trabajo solo en `juego`. Push solo a `juego`. Nada en `main`, `dev` ni producción.
- **Cifras:** ninguna en el rosin ni en el laboratorio. En el cultivo, solo los valores que Bertha apruebe;
  lo que no apruebe no puntúa (como hoy).
- **Velocidad del resto de la web:** sin cambio. Nada del juego se descarga hasta abrirlo.
- **CSP:** sin estilos ni código de fuera. Los dibujos van hechos en el propio código (SVG).
- **Al terminar cada fase:**
  - todas las pruebas (las del juego, laboratorio, CSP, idiomas y el resto);
  - commit y push a `juego`;
  - `docs/juego-progreso.md` al día;
  - resumen corto con capturas.

---

## 4. Datos que Bertha debe decidir

Todo lo de abajo es **mi propuesta**, escrita con conocimiento general de cultivo y no copiada de ninguna
fuente. **Bertha corrige, borra o cambia lo que quiera.** En el juego se usan **niveles** (poco / medio /
mucho); las cifras entre paréntesis son solo para que Bertha sepa a qué me refiero, y **solo saldrán en
pantalla si ella lo pide**. Lo que Bertha deje sin decidir **no puntúa** (como hoy).

### 4.1 Por sistema de cultivo

| Dato | Tierra | Coco | Hidroponía (raíces en agua con aire) | Aeroponía |
|---|---|---|---|---|
| Riego ideal | moderado, dejar secar un poco entre riegos | frecuente, sin dejar secar nunca, con algo de drenaje | la raíz siempre en solución; lo que importa es el **aire** del agua | niebla a ratos, sin cortes |
| Cada cuánto (propuesta) | cada 2–3 días | 1 vez al día en vegetativo, 2–3 en floración | continuo | ciclos cortos todo el día |
| pH (nivel «bien») | algo más alto (≈ 6,0–7,0) | medio (≈ 5,5–6,5) | más bajo (≈ 5,5–6,2) | más bajo (≈ 5,5–6,2) |
| Nutrientes / EC | bajo-medio (la tierra ya trae algo) | medio, y necesita calcio y magnesio | medio-alto | bajo-medio |
| Velocidad de crecimiento | normal | un poco más rápida | más rápida | la más rápida |
| Cuánto perdona los errores | mucho (los errores tardan en notarse) | bastante | poco | muy poco (un fallo se nota enseguida) |
| Riesgos que suben | exceso de riego, mosquitas del sustrato | falta de calcio/magnesio, sales acumuladas, coco seco | agua caliente → raíces enfermas, sin aire en el agua | boquillas tapadas o bomba parada → raíces secas |
| Error típico que explica el científico | regar demasiado «por cariño» | dejar que el coco se seque | no vigilar la temperatura y el aire del agua | no revisar boquillas y bomba |

**Preguntas para Bertha:**
1. **¿Hidroponía significa «raíces en agua con aire» (cubo)** o prefieres otra técnica como la representativa?
2. **¿Añadimos problemas nuevos** propios de cada sistema (falta de calcio/magnesio en coco, raíces enfermas en
   hidro, raíces secas en aero)? Hoy el juego tiene 5 problemas. Cada problema nuevo necesita sus dibujos, sus
   textos en 4 idiomas y entraría en la migración de la fase 5.
3. **¿pH/EC pasa a ser una decisión más** (bajo / bien / alto) o solo un indicador que se ve?
4. **¿Cuánto más rápido es cada sistema** en semanas de vegetativo? Propuesta: tierra igual que hoy; coco, hidro
   y aero pueden pasar a floración una semana antes.

### 4.2 Por método de germinación

| Dato | Papel húmedo | Cubo / jiffy | Directa en el sustrato |
|---|---|---|---|
| Cuánto tarda en salir (propuesta) | 1–3 días (raíz visible) | 2–5 días | 3–7 días |
| Trasplante | sí, con cuidado | sí, fácil (el cubo entero) | no hace falta |
| Riesgos | raíz rota al trasplantar, papel seco | cubo demasiado mojado | semilla muy honda, tierra encharcada o compacta, hongos al nacer |
| Error típico | tocar la raíz con los dedos o tardar en trasplantar | encharcar el cubo | regar demasiado antes de que asome |
| Con qué sistemas | todos | tierra y coco: jiffy; hidro y aero: cubo de lana de roca | tierra y coco; **no** en hidro ni en aero |

**Preguntas para Bertha:**
5. **¿Están bien estas combinaciones permitidas?**
6. **¿El método cambia la nota** o solo el tiempo y los riesgos? Propuesta: solo tiempo y riesgos (una mala
   germinación resta salud las primeras semanas).

### 4.3 Otros datos que siguen pendientes de antes
7. Los 57 valores de `src/game/rules.json` marcados «POR VERIFICAR POR BERTHA».
8. La presión del rosin (nivel cualitativo, sin cifras) y el texto de protección (guantes y superficie estable).
9. La humedad en vegetativo («media-alta», ≈ 65–75 %).
10. Los datos que la plataforma no da: temperatura en floración; temperatura, humedad y nutrientes en plántula.
11. **¿En la carpa se muestran números** en los indicadores (por ejemplo, la temperatura) o solo colores y
    niveles? Propuesta: solo colores y niveles hasta que Bertha apruebe cada cifra.

---

## 5. Notas de avance para poder continuar

Al terminar cada fase actualizo **`docs/juego-progreso.md`** y lo guardo en el mismo commit. Así otra sesión
puede seguir si esta se corta. Cada entrada lleva:

- **Fase y fecha**, y su estado: hecha / a medias (qué parte).
- **Commits** de la fase y si están subidos a `juego`.
- **Archivos tocados** y para qué sirve cada uno.
- **Pruebas:** cuáles y su resultado (número de comprobaciones, fallos).
- **Pesos** antes y después.
- **Decisiones de Bertha** recibidas y las que siguen pendientes.
- **Lo siguiente:** exactamente qué falta y el primer paso.
- **Cómo retomar:** la rama, los comandos para correr las pruebas y avisos conocidos. Por ejemplo, si Windows
  reserva los puertos 54321/54322, las pruebas no arrancan: hay que moverlas a otros puertos solo mientras se
  prueban.

Si una fase se corta a medias, la nota lo dice primero y en grande, para no construir encima de algo sin terminar.
