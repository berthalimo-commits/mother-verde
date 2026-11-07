# Copias de seguridad diarias en la laptop

**Estado (2026-11-06):** funciona para **staging** (`ciqdnrdtaxbmcjvxljvq`). **Producción todavía no**: se añadirá
solo con la autorización escrita de Bertha, con su propio usuario, sus propias claves y sus propios archivos.

## Cómo funciona, en pocas palabras

- **Todos los días a las 8 pm** el Programador de tareas de Windows lanza `copia-diaria.ps1`.
  - Si a esa hora la laptop estaba apagada o dormida, la copia se hace **en cuanto la enciendes** e inicias sesión.
- La copia la hace un usuario de la base que **solo puede leer**, `mv_backup`: no puede cambiar nada (comprobado).
- Es una **copia completa de la base**: cuentas, perfiles, Bitácora, Comunidad, aportes, juego…
  - Se descarga con `pg_dump`, de PostgreSQL 17.
  - Se **cifra** al momento con 7-Zip (AES-256; ni siquiera se ven los nombres de lo que hay dentro).
  - Nunca queda en el disco un archivo sin cifrar.
- Se guarda en **`C:\CopiasMotherVerde\staging\`** con la fecha en el nombre, por ejemplo
  `mv-staging-2026-11-06_2000.7z`.
- **Google Drive para escritorio** sincroniza la carpeta `C:\CopiasMotherVerde`. Así hay otra copia fuera de la laptop.
- Al terminar sale un **aviso de Windows**:
  - **«Mother Verde: copia hecha (staging)»**, con el nombre, el tamaño y el número de tablas;
  - o **«Mother Verde: copia FALLIDA (staging)»**.
  - Todo queda anotado en `C:\CopiasMotherVerde\registro-staging.txt`.
- **Copias viejas:** se borran solas las de **más de 30 días**, pero:
  - solo después de una copia buena;
  - siempre quedan las **7 más recientes**.

**Qué NO incluye:** las fotos de la Comunidad que guarda Supabase Storage. Las copias de Supabase tampoco las
incluyen. La base sí guarda la lista de esas fotos.

## Dónde están las claves (nunca en un archivo suelto)

Hay dos claves. Las dos están en la **bóveda de Windows «MotherVerdeCopias»** (módulo oficial de Microsoft
SecretStore). Va cifrada y **solo tu usuario de Windows** puede abrirla. Por eso la tarea de las 8 pm la lee sin
preguntar nada.

| Clave | Quién la conoce | Si se pierde |
|---|---|---|
| Contraseña de `mv_backup` | Nadie: la generó el script al azar | Se crea otra (ver «Cambiar la contraseña de mv_backup») |
| **Tu contraseña de cifrado** (`mv-cifrado`) | Tú: está en tu gestor de contraseñas | **Las copias ya hechas no se pueden abrir.** Guárdala siempre también en tu gestor de contraseñas, nunca solo en la laptop |

Si pierdes la laptop, las copias de Google Drive siguen sirviendo, **siempre que tengas la contraseña de cifrado**.

## Archivos

- `tools/copias/` (en el repositorio) y `C:\CopiasMotherVerde\herramientas\` (la copia que usa la tarea):
  - `config.ps1`: carpeta, días a guardar, datos de conexión. **No lleva claves.**
  - `copia-diaria.ps1`: la copia.
  - `restaurar.ps1`: abrir y restaurar una copia.
  - `comprobar.sql`: comprobación de solo lectura (filas y huella de cada tabla).
  - `guardar-secretos.ps1`: guardar o cambiar las claves.
  - `crear-tarea.ps1`: crear o quitar la tarea.
- `supabase/admin/backup-role-staging.sql`: crea el usuario de solo lectura en staging. No lleva contraseña.

## Ver que todo va bien

- **Cada día:** el aviso de las 8 pm.
- **De vez en cuando:**
  - abre `C:\CopiasMotherVerde\registro-staging.txt`: la última línea debe decir «HECHA», con las tablas copiadas
    por esquema. En staging, el 2026-11-06 eran **66 tablas copiadas, con o sin filas**: auth 27, public 26,
    storage 10, realtime 2 y vault 1. La base tiene 67: la que no cuenta es `realtime.messages`, una tabla
    «contenedor» de Supabase que no guarda filas propias. Su estructura sí va en la copia.
    La comparación de `comprobar.sql` mira las **63** de auth, public y storage, que son las de Mother Verde;
    realtime y vault son internas de Supabase;
  - en Google Drive (drive.google.com → «Ordenadores»), la carpeta debe tener la copia de hoy.
- **Una vez al mes, prueba que una copia se puede restaurar** (abajo, «Restaurar en una base de prueba»).

## Restaurar en una base de prueba (no toca Supabase)

Sirve para comprobar que una copia está bien. Necesita Docker Desktop abierto.

1. Abre **Windows PowerShell**.
2. Escribe esto (cambia la fecha por la de la copia que quieras) y pulsa Enter:
   ```
   & 'C:\CopiasMotherVerde\herramientas\restaurar.ps1' -Archivo 'C:\CopiasMotherVerde\staging\mv-staging-2026-11-06_2000.7z' -Prueba
   ```
3. Debe decir:
   - «Copia abierta y sin daños (SHA-256 coincide)»;
   - «Restauración terminada. Avisos de pg_restore: 0».
4. Comparar con staging (solo lectura): pídeselo a Claude Code. Ejecuta `comprobar.sql` en los dos sitios y te enseña
   la tabla. El 2026-11-06 salió así: **63 tablas, 0 diferencias**.
5. Para borrar la base de prueba: `docker rm -f mv-restaurar-prueba`.

## Si hay un desastre (restaurar de verdad)

**Nunca restaures encima del proyecto que funciona.** Primero se restaura en un **proyecto nuevo** de Supabase y se
comprueba. Después se decide.

1. **Abre la copia.** En PowerShell:
   ```
   & 'C:\CopiasMotherVerde\herramientas\restaurar.ps1' -Archivo '<la copia .7z>' -SoloDescifrar -Salida 'C:\Restaurar'
   ```
   Queda un `.dump` **sin cifrar** en `C:\Restaurar`: bórralo en cuanto termines.
   En otro ordenador, el script te pide la contraseña de cifrado, con puntos en vez de letras.
2. **Crea un proyecto nuevo de Supabase** con la misma versión de Postgres (17).
   Database → Settings → «Reset database password»: escríbela tú en tu gestor de contraseñas.
3. **Restaura** con la cadena del «Session pooler» del proyecto nuevo (botón Connect). Tú escribes la contraseña
   cuando la pida:
   ```
   & 'C:\Program Files\PostgreSQL\17\bin\pg_restore.exe' --no-owner --no-privileges --data-only --schema=auth --schema=public -h <servidor> -p 5432 -U postgres.<ref-nuevo> -d postgres 'C:\Restaurar\<archivo>.dump'
   ```
   Antes, en el proyecto nuevo, hay que aplicar las migraciones de `supabase/migrations/` en orden, para que existan
   las tablas. Este paso es largo y delicado: **hazlo con Claude Code**, que lo prepara y lo comprueba con
   `comprobar.sql`.
4. **Comprueba con `comprobar.sql`** que las tablas coinciden con la copia.
5. **Solo entonces** se cambia la web (variables de Vercel) al proyecto nuevo. Necesita tu autorización escrita.
6. **Borra `C:\Restaurar`.**

Supabase Pro (en producción) tiene además sus propias copias diarias de 7 días, que se restauran desde el panel
(Database → Backups). Mientras se restaura, el proyecto queda fuera de servicio.

## Si sale «copia FALLIDA»

Abre `C:\CopiasMotherVerde\registro-staging.txt` y mira la última línea.

| Dice | Qué hacer |
|---|---|
| «No se pudo copiar la base (¿sin internet…?)» | Mira tu conexión y status.supabase.com. Para lanzarla a mano: Programador de tareas → «Mother Verde» → «Copia diaria staging» → clic derecho → **Ejecutar**. |
| … `password authentication failed` | La contraseña de `mv_backup` cambió o se borró el usuario. Ver «Cambiar la contraseña de mv_backup». |
| «No pude leer las claves de la bóveda» | Alguien cambió la bóveda. Vuelve a guardar las claves con `guardar-secretos.ps1`. |
| «No se pudo cifrar» o «no pasó la comprobación» | ¿Disco lleno? Libera espacio y lánzala a mano. |
| «Falta el programa …» | Se desinstaló 7-Zip o PostgreSQL 17: vuelve a instalarlo con winget (`7zip.7zip`, `PostgreSQL.PostgreSQL.17`, solo «Command Line Tools»). |

La copia se reintenta sola 3 veces, cada 10 minutos, antes de avisar del fallo.

## Cambiar las claves

- **Contraseña de `mv_backup`** (por ejemplo, si sospechas que se filtró):
  1. En PowerShell:
     ```
     & 'C:\CopiasMotherVerde\herramientas\guardar-secretos.ps1' -Que base -Proyecto staging -Nueva
     ```
  2. Pega lo que queda en el portapapeles (`alter role mv_backup with password 'SCRAM-SHA-256$…'`, no es la contraseña)
     en el SQL Editor de **staging** y pulsa Run.
  3. Borra esa consulta de la lista PRIVATE.
- **Contraseña de cifrado:**
  ```
  & 'C:\CopiasMotherVerde\herramientas\guardar-secretos.ps1' -Que cifrado -Cambiar
  ```
  Las copias anteriores siguen necesitando la contraseña **anterior**: no la borres de tu gestor hasta que pasen 30 días.

## Pausar o quitar la copia diaria

- **Pausar:** Programador de tareas → «Mother Verde» → «Copia diaria staging» → clic derecho → **Deshabilitar**.
- **Quitar:**
  ```
  & 'C:\Users\User\Desktop\Cannapp\tools\copias\crear-tarea.ps1' -Proyecto staging -Quitar
  ```
  Las copias no se borran.
- **Quitar el usuario de la base** (solo si se dejan de hacer copias): SQL Editor de staging → `drop role mv_backup;`.
