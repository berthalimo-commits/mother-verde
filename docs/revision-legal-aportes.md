# Motivo de los aportes — textos para abogado/a y contador (2026-11-03)

Cambio decidido por Bertha Limo:
- **Antes:** el aporte único de apoyo se destinaba a crear Canna Wasi.
- **Ahora:** apoya su formación en **Horticulture Business Management (B.Tech.)** en SUNY Morrisville.
- **Canna Wasi:** ya no se menciona en ningún sitio.
- **Lo que no cambia:** la vía de aporte (USDC en la red Base, billetera personal de Bertha, 1 flor = 10 USDC, revisión manual de hasta 24 h, códigos de regalo, aportes manuales) ni la regla de acceso.

Estado: hecho en `dev` y en staging (pruebas). **Nada en producción.**
- Los textos en los 4 idiomas (ES, EN, DE, FR) están en `src/purposeTexts.js`; la tabla muestra el español.
- Los correos están en `supabase/functions/support-claims/index.ts`.

## 1. Términos y Condiciones (cláusula 5, aportes) — sigue SIN texto final

| Texto actual publicado (staging) | Borrador propuesto (NO publicado; solo para esta revisión) |
|---|---|
| «[PENDIENTE: texto final de abogado/a y contador — prueba gratis de 24 horas al confirmar el correo, aporte único de apoyo en USDC (red Base), códigos de regalo y retirada del acceso en caso de fraude.]» | «El aporte único de apoyo ayuda a Bertha Limo, fundadora de Mother Verde, a terminar su bachillerato en Horticulture Business Management (B.Tech.) en SUNY Morrisville. A cambio, la persona recibe acceso completo a la plataforma. Es voluntario y único; no es una donación ni es deducible de impuestos. El aporte llega a la billetera personal de cripto de Bertha Limo en la red Base. Mother Verde es un proyecto independiente, no afiliado ni respaldado por SUNY Morrisville.» |

## 2. Política de Privacidad (sección 4, aportes en USDC)

| Texto actual | Texto nuevo (publicado en staging) |
|---|---|
| (no hablaba de la casilla) | Se añade: «Si marcas la casilla de propósito antes de aportar, guardamos que la aceptaste y cuándo, junto a tu aviso de aporte.» (Se guarda solo la fecha y hora; nada más.) |

## 3. Pantalla de aporte (Desbloquear)

| Texto actual | Texto nuevo |
|---|---|
| Título «¿A dónde va tu aporte?» y: «Tu aporte llega a la billetera personal de cripto de Bertha Limo (horticultora y especialista en cannabis), fundadora de Mother Verde, en la red Base. Lo recaudado se destinará a crear Canna Wasi, una asociación de pacientes de cannabis medicinal en Urubamba, Cusco (Valle Sagrado, Perú), que Bertha funda junto a su hermano César (arquitecto)…» y «Wasi significa casa en quechua». | Título «Antes de aportar: para qué es tu aporte» y 6 puntos: (1) «Tu aporte único de apoyo ayuda a Bertha Limo, fundadora de Mother Verde, a terminar su bachillerato en Horticulture Business Management (B.Tech.) en SUNY Morrisville.» (2) «A cambio recibes acceso completo a la plataforma.» (3) «Es voluntario y único. No es una donación ni es deducible de impuestos.» (4) «Lo que aprendo lo comparto con mi comunidad y con quienes aprenden aquí.» (5) «Mother Verde es un proyecto independiente, no afiliado ni respaldado por SUNY Morrisville.» (6) «Las condiciones completas están en los Términos y Condiciones.» Se mantiene: «Tu aporte llega a la billetera personal de cripto de Bertha Limo (horticultora y especialista en cannabis), fundadora de Mother Verde, en la red Base.» Casilla obligatoria: «Entiendo el propósito de mi aporte y estoy de acuerdo.» |
| — | Aviso corto (arriba en Desbloquear y en la pantalla de bloqueo): «Tu aporte único de apoyo me ayuda a terminar mi bachillerato en horticultura en SUNY Morrisville, y lo que aprenda lo compartiré contigo y con mi comunidad. A cambio tienes acceso completo a la plataforma. Mother Verde no está afiliado a SUNY Morrisville.» |

## 4. Correos

| Correo | Texto actual | Texto nuevo |
|---|---|---|
| Acceso activo (aporte USDC aprobado) | «Gracias por apoyar Canna Wasi. Si no hiciste este aporte, responde a este correo.» | «¡Gracias! Tu aporte fue confirmado y ya tienes acceso completo. Tu apoyo me ayuda a estudiar, y lo que aprenda lo compartiré contigo y con mi comunidad.» + «Si no hiciste este aporte, responde a este correo.» |
| **Nuevo:** aviso recibido (al enviar el código de la transacción) | (no existía) | «Gracias por tu aporte. Recuerda: tu aporte único de apoyo ayuda a Bertha Limo a terminar su bachillerato en horticultura en SUNY Morrisville. Revisaremos tu aviso en un plazo de hasta 24 horas.» + monto + «Si no hiciste este aviso, responde a este correo.» |
| **Nuevo:** aporte manual confirmado | (no se enviaba correo) | El mismo texto que «acceso activo». |

## 5. Historia de bienvenida y otros

- **Historia «Nuestra historia»:** 6 pantallas con el texto aprobado por Bertha.
  - Sale una vez, después de confirmar la edad, y siempre está en «Más ▾» y en el pie de página.
  - La última pantalla dice: «Mother Verde es un proyecto independiente. No está afiliado ni respaldado por SUNY Morrisville.»
- **Lista «Dónde estudiar cannabis»:** junto a SUNY Morrisville, nueva línea «La fundadora estudia en esta institución».

## Lo que deben revisar antes de producción

1. **Términos, cláusula 5:** redactar el texto final. El borrador de arriba es solo un punto de partida y **no está publicado**.
2. **Que el aporte no sea una donación:** confirmar que el aporte es un pago a cambio de acceso, no deducible. Ver también cómo declara Bertha esos ingresos (billetera personal) y si hace falta factura o recibo.
3. **SUNY Morrisville:**
   - Que nombrar la institución y el programa (sin logo ni textos copiados) es correcto, y que la frase «no afiliado ni respaldado» basta.
   - Que la línea «La fundadora estudia en esta institución», en una lista que recomienda dónde estudiar, no se lee como publicidad pagada ni como conflicto de interés.
4. **Privacidad:** base legal y plazo de conservación del registro de la casilla. Es la misma nota «PENDIENTE» que ya tenía la sección 4.
5. **Fotos de la historia:**
   - La 09 (graduación) espera su decisión: sale otra persona y el diploma con el escudo de la institución.
   - La 04 (laboratorio) no se usa: salen otras personas sin permiso.
