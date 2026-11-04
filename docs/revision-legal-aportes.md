# Motivo de los aportes — textos para abogado/a y contador (2026-11-03; actualizado 2026-11-04)

Cambio decidido por Bertha Limo:
- **Antes:** el aporte único de apoyo se destinaba a crear Canna Wasi.
- **Ahora:** apoya su educación en SUNY Morrisville.
- **2026-11-04:** **no se menciona ningún grado ni título** (ni «bachillerato», ni «bachelor», ni el nombre del programa, ni «B.Tech.»). Se usa solo esta frase, **provisional** (Bertha dará la redacción final):
  - ES: «SUNY Morrisville me aceptó para continuar mi educación.»
  - EN: «SUNY Morrisville accepted me to continue my education.»
  - DE: «Die SUNY Morrisville hat mich aufgenommen, damit ich meine Ausbildung fortsetzen kann.»
  - FR: «SUNY Morrisville m’a acceptée pour poursuivre mes études.»
  - Está en **un solo lugar** (`SUNY_ACCEPTED` en `src/purposeTexts.js`); `node tools/apply-purpose-texts.mjs` la copia a la web y a los correos. Una prueba automática falla si vuelve a aparecer un grado o título.
- **Canna Wasi:** ya no se menciona en ningún sitio.
- **Lo que no cambia:** la vía de aporte (USDC en la red Base, billetera personal de Bertha, 1 flor = 10 USDC, revisión manual de hasta 24 h, códigos de regalo, aportes manuales) ni la regla de acceso.

Estado: hecho en `dev`. **Nada en producción.** Términos y Privacidad **no se tocan** en la web: los textos de abajo son propuestas para tu revisión.
- Los textos en los 4 idiomas (ES, EN, DE, FR) están en `src/purposeTexts.js`; las tablas muestran el español.
- Los correos están en `supabase/functions/support-claims/index.ts`.

## 0. Cambio del 2026-11-04: sin grado ni título

| Dónde | Texto actual (hasta hoy) | Texto nuevo |
|---|---|---|
| Historia, pantalla 4 | «Hoy estoy ante un gran reto. SUNY Morrisville me dio otra vez la oportunidad de volver y terminar mi bachillerato en Horticulture Business Management (B.Tech.). Volver a esa casa de estudios me emociona muchísimo.» | «Hoy estoy ante un gran reto. SUNY Morrisville me aceptó para continuar mi educación. Volver a esa casa de estudios me emociona muchísimo.» (el resto, igual) |
| Pantalla de aporte, punto 1 | «Tu aporte único de apoyo ayuda a Bertha Limo, fundadora de Mother Verde, a terminar su bachillerato en Horticulture Business Management (B.Tech.) en SUNY Morrisville.» | «Tu aporte único de apoyo ayuda a Bertha Limo, fundadora de Mother Verde, a seguir estudiando. En sus palabras: «SUNY Morrisville me aceptó para continuar mi educación.»» |
| Aviso corto (Desbloquear y pantalla de bloqueo) | «Tu aporte único de apoyo me ayuda a terminar mi bachillerato en horticultura en SUNY Morrisville, y lo que aprenda lo compartiré contigo y con mi comunidad. A cambio tienes acceso completo a la plataforma. Mother Verde no está afiliado a SUNY Morrisville.» | «Tu aporte único de apoyo me ayuda a estudiar. SUNY Morrisville me aceptó para continuar mi educación. Lo que aprenda lo compartiré contigo y con mi comunidad. A cambio tienes acceso completo a la plataforma. Mother Verde no está afiliado ni respaldado por SUNY Morrisville.» |
| Correo «aviso recibido» | «Gracias por tu aporte. Recuerda: tu aporte único de apoyo ayuda a Bertha Limo a terminar su bachillerato en horticultura en SUNY Morrisville. Revisaremos tu aviso en un plazo de hasta 24 horas.» | «Gracias por tu aporte. Recuerda: tu aporte único de apoyo ayuda a Bertha Limo a seguir estudiando. En sus palabras: «SUNY Morrisville me aceptó para continuar mi educación.» Revisaremos tu aviso en un plazo de hasta 24 horas.» |
| Correos «acceso aprobado» (USDC y aporte manual) | «¡Gracias! Tu aporte fue confirmado y ya tienes acceso completo. Tu apoyo me ayuda a estudiar, y lo que aprenda lo compartiré contigo y con mi comunidad.» | «¡Gracias! Tu aporte fue confirmado y ya tienes acceso completo. Tu apoyo me ayuda a estudiar. SUNY Morrisville me aceptó para continuar mi educación. Lo que aprenda lo compartiré contigo y con mi comunidad.» |
| Lección «Dónde estudiar cannabis», SUNY Morrisville | «Minor en Cannabis Industry, certificado en Specialty Crops & Cannabis Production, con posibilidad de apilarlo hacia un A.A.S. o B.Tech en horticultura. Incluye una parcela…» | «Minor en Cannabis Industry y certificado en Specialty Crops & Cannabis Production. Incluye una parcela…» (sin frase personal) |
| Términos, borrador cláusula 5 (no publicado) | «…ayuda a Bertha Limo, fundadora de Mother Verde, a terminar su bachillerato en Horticulture Business Management (B.Tech.) en SUNY Morrisville…» | Ver sección 1. |

Se mantiene: «Mother Verde no está afiliado ni respaldado por SUNY Morrisville» (historia, pantalla de aporte y ahora también el aviso corto).

## 1. Términos y Condiciones (cláusula 5, aportes) — sigue SIN texto final

| Texto actual publicado (staging) | Borrador propuesto (NO publicado; solo para esta revisión) |
|---|---|
| «[PENDIENTE: texto final de abogado/a y contador — prueba gratis de 24 horas al confirmar el correo, aporte único de apoyo en USDC (red Base), códigos de regalo y retirada del acceso en caso de fraude.]» | «El aporte único de apoyo ayuda a Bertha Limo, fundadora de Mother Verde, a continuar su educación en SUNY Morrisville, que la aceptó como estudiante. A cambio, la persona recibe acceso completo a la plataforma. Es voluntario y único; no es una donación ni es deducible de impuestos. El aporte llega a la billetera personal de cripto de Bertha Limo en la red Base. La prueba gratuita de 24 horas se ofrece una sola vez por persona. Mother Verde es un proyecto independiente, no afiliado ni respaldado por SUNY Morrisville.» |

## 2. Política de Privacidad

| Texto actual | Texto nuevo propuesto |
|---|---|
| (no hablaba de la casilla) | Sección 4 (publicado en staging): «Si marcas la casilla de propósito antes de aportar, guardamos que la aceptaste y cuándo, junto a tu aviso de aporte.» (Se guarda solo la fecha y hora; nada más.) |
| (no hablaba de la prueba al borrar la cuenta) | **Propuesta, NO publicada (2026-11-04):** «Si borras tu cuenta, guardamos solo una huella cifrada e irreversible de tu correo, sin ningún otro dato, para que la prueba gratuita de 24 horas se use una sola vez por persona.» (Técnico: SHA-256 del correo normalizado con una clave secreta; sin id de cuenta, sin el correo en claro. Migración `20261105100000`.) |

## 3. Pantalla de aporte (Desbloquear)

| Texto actual | Texto nuevo |
|---|---|
| Título «¿A dónde va tu aporte?» y: «Tu aporte llega a la billetera personal de cripto de Bertha Limo (horticultora y especialista en cannabis), fundadora de Mother Verde, en la red Base. Lo recaudado se destinará a crear Canna Wasi, una asociación de pacientes de cannabis medicinal en Urubamba, Cusco (Valle Sagrado, Perú), que Bertha funda junto a su hermano César (arquitecto)…» y «Wasi significa casa en quechua». | Título «Antes de aportar: para qué es tu aporte» y 6 puntos: (1) «Tu aporte único de apoyo ayuda a Bertha Limo, fundadora de Mother Verde, a seguir estudiando. En sus palabras: «SUNY Morrisville me aceptó para continuar mi educación.»» (2) «A cambio recibes acceso completo a la plataforma.» (3) «Es voluntario y único. No es una donación ni es deducible de impuestos.» (4) «Lo que aprendo lo comparto con mi comunidad y con quienes aprenden aquí.» (5) «Mother Verde es un proyecto independiente, no afiliado ni respaldado por SUNY Morrisville.» (6) «Las condiciones completas están en los Términos y Condiciones.» Se mantiene: «Tu aporte llega a la billetera personal de cripto de Bertha Limo (horticultora y especialista en cannabis), fundadora de Mother Verde, en la red Base.» Casilla obligatoria: «Entiendo el propósito de mi aporte y estoy de acuerdo.» |
| — | Aviso corto (arriba en Desbloquear y en la pantalla de bloqueo): «Tu aporte único de apoyo me ayuda a estudiar. SUNY Morrisville me aceptó para continuar mi educación. Lo que aprenda lo compartiré contigo y con mi comunidad. A cambio tienes acceso completo a la plataforma. Mother Verde no está afiliado ni respaldado por SUNY Morrisville.» |

## 4. Correos

| Correo | Texto actual | Texto nuevo |
|---|---|---|
| Acceso activo (aporte USDC aprobado) | «Gracias por apoyar Canna Wasi. Si no hiciste este aporte, responde a este correo.» | «¡Gracias! Tu aporte fue confirmado y ya tienes acceso completo. Tu apoyo me ayuda a estudiar. SUNY Morrisville me aceptó para continuar mi educación. Lo que aprenda lo compartiré contigo y con mi comunidad.» + «Si no hiciste este aporte, responde a este correo.» |
| **Nuevo:** aviso recibido (al enviar el código de la transacción) | (no existía) | «Gracias por tu aporte. Recuerda: tu aporte único de apoyo ayuda a Bertha Limo a seguir estudiando. En sus palabras: «SUNY Morrisville me aceptó para continuar mi educación.» Revisaremos tu aviso en un plazo de hasta 24 horas.» + monto + «Si no hiciste este aviso, responde a este correo.» |
| **Nuevo:** aporte manual confirmado | (no se enviaba correo) | El mismo texto que «acceso activo». |

## 5. Historia de bienvenida y otros

- **Historia «Nuestra historia»:** 6 pantallas con el texto aprobado por Bertha (pantalla 4 con la frase nueva, ver sección 0).
  - Sale una vez, después de confirmar la edad, y siempre está en «Más ▾» y en el pie de página.
  - La última pantalla dice: «Mother Verde es un proyecto independiente. No está afiliado ni respaldado por SUNY Morrisville.»
- **Lista «Dónde estudiar cannabis»:** junto a SUNY Morrisville, nueva línea «La fundadora estudia en esta institución». La descripción del programa ya no nombra grados (sección 0).

## Lo que deben revisar antes de producción

1. **Términos, cláusula 5:** redactar el texto final. El borrador de arriba es solo un punto de partida y **no está publicado**.
2. **Que el aporte no sea una donación:** confirmar que el aporte es un pago a cambio de acceso, no deducible. Ver también cómo declara Bertha esos ingresos (billetera personal) y si hace falta factura o recibo.
3. **SUNY Morrisville:**
   - Que nombrar la institución (sin logo, sin nombre de programa ni grado, sin textos copiados) es correcto, y que la frase «no afiliado ni respaldado» basta.
   - La frase «SUNY Morrisville me aceptó para continuar mi educación» es **provisional**: Bertha dará la redacción final.
   - Que la línea «La fundadora estudia en esta institución», en una lista que recomienda dónde estudiar, no se lee como publicidad pagada ni como conflicto de interés.
4. **Privacidad:**
   - Base legal y plazo de conservación del registro de la casilla. Es la misma nota «PENDIENTE» que ya tenía la sección 4.
   - La frase propuesta sobre la huella del correo al borrar la cuenta (sección 2): base legal (interés legítimo, evitar abuso de la prueba) y plazo de conservación.
5. **Fotos de la historia:**
   - La 09 (graduación con el diploma) no se usa: sale otra persona y el escudo de la institución.
   - La 04 (laboratorio) no se usa: salen otras personas sin permiso.
