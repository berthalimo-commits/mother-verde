# Mother Verde · copia de seguridad diaria (la lanza el Programador de tareas a las 20:00).
#   .\copia-diaria.ps1 -Proyecto staging
# 1. Lee las claves de la bóveda de Windows (nunca se escriben en disco ni en el registro).
# 2. pg_dump completo con el usuario de SOLO LECTURA (formato «custom» de PostgreSQL).
# 3. Comprueba que la copia se puede leer (pg_restore --list).
# 4. La cifra con 7-Zip (AES-256, también los nombres de dentro) -> <Carpeta>\<proyecto>\mv-<proyecto>-AAAA-MM-DD_HHMM.7z
# 5. Comprueba el archivo cifrado con la contraseña (7z t) y borra el archivo sin cifrar.
# 6. Solo si todo salió bien: borra las copias de más de $DiasGuardar días (siempre quedan las $MinimoGuardar últimas).
# 7. Aviso de Windows «Copia hecha» o «Copia FALLIDA» y una línea en registro-<proyecto>.txt.
param(
  [string]$Proyecto = 'staging',
  [switch]$SinAviso,
  [switch]$SinBorrar,
  [switch]$SinReintentos
)
# 'Continue': en Windows PowerShell 5.1, con 'Stop' cualquier aviso de pg_dump/7-Zip por stderr cortaría el script;
# aquí cada paso comprueba su código de salida.
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'config.ps1')

$p = $Proyectos[$Proyecto]
$dirCopias = Join-Path $Carpeta $Proyecto
$registro = Join-Path $Carpeta "registro-$Proyecto.txt"
New-Item -ItemType Directory -Force -Path $dirCopias | Out-Null

function Escribir-Registro([string]$t) {
  Add-Content -Path $registro -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $t) -Encoding UTF8
}

function Mostrar-Aviso([string]$titulo, [string]$texto) {
  if ($SinAviso) { return }
  try {
    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
    [void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
    $x = New-Object Windows.Data.Xml.Dom.XmlDocument
    $t1 = [Security.SecurityElement]::Escape($titulo); $t2 = [Security.SecurityElement]::Escape($texto)
    $x.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$t1</text><text>$t2</text></binding></visual></toast>")
    $aviso = [Windows.UI.Notifications.ToastNotification]::new($x)
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe').Show($aviso)
  } catch { Escribir-Registro "(no se pudo mostrar el aviso: $($_.Exception.Message))" }
}

function Fallo([string]$porque) {
  Escribir-Registro "FALLIDA: $porque"
  Mostrar-Aviso "Mother Verde: copia FALLIDA ($Proyecto)" "$porque Mira $registro"
  exit 1
}

# Una sola copia a la vez
$candado = New-Object System.Threading.Mutex($false, "Global\MotherVerdeCopia-$Proyecto")
if (-not $candado.WaitOne(0)) { Escribir-Registro 'Ya había una copia en marcha: esta no se ejecuta.'; exit 0 }

$tmp = Join-Path $env:TEMP ('mvcopia-' + [guid]::NewGuid().ToString('N'))
try {
  if (-not $p) { Fallo "Proyecto desconocido: $Proyecto." }
  foreach ($exe in @((Join-Path $PgBin 'pg_dump.exe'), (Join-Path $PgBin 'pg_restore.exe'), $SieteZip)) {
    if (-not (Test-Path $exe)) { Fallo "Falta el programa $exe." }
  }
  Import-Module Microsoft.PowerShell.SecretManagement, Microsoft.PowerShell.SecretStore
  try {
    $pwBase = Get-Secret -Vault $Boveda -Name $p.SecretoBase -AsPlainText -ErrorAction Stop
    $pwCifrado = Get-Secret -Vault $Boveda -Name $SecretoCifrado -AsPlainText -ErrorAction Stop
  } catch { Fallo 'No pude leer las claves de la bóveda (¿se guardaron con guardar-secretos.ps1?).' }

  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  $sello = Get-Date -Format 'yyyy-MM-dd_HHmm'
  $nombre = "mv-$Proyecto-$sello"
  $dump = Join-Path $tmp "$nombre.dump"
  $err = Join-Path $tmp 'pg_dump.err'

  # 2. pg_dump (la contraseña va solo en la variable de entorno de ESTE proceso)
  $env:PGPASSWORD = $pwBase; $env:PGSSLMODE = 'require'; $env:PGCONNECT_TIMEOUT = '30'; $env:PGAPPNAME = 'mv-copia-diaria'
  $usuario = "$($p.Usuario).$($p.Ref)"
  $max = if ($SinReintentos) { 1 } else { $Intentos }
  $ok = $false
  for ($i = 1; $i -le $max -and -not $ok; $i++) {
    & (Join-Path $PgBin 'pg_dump.exe') -h $p.Servidor -p $p.Puerto -U $usuario -d $p.Base --no-password `
        --format=custom --compress=6 --file=$dump 2> $err
    if ($LASTEXITCODE -eq 0 -and (Test-Path $dump) -and (Get-Item $dump).Length -gt 0) { $ok = $true }
    else {
      $msg = (Get-Content $err -ErrorAction SilentlyContinue | Select-Object -Last 3) -join ' '
      Escribir-Registro "Intento $i de $max sin éxito: $msg"
      if ($i -lt $max) { Start-Sleep -Seconds ($EsperaMinutos * 60) }
    }
  }
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue; $pwBase = $null
  if (-not $ok) { Fallo 'No se pudo copiar la base (¿sin internet, Supabase caído o contraseña cambiada?).' }

  # 3. ¿Se puede leer?
  & (Join-Path $PgBin 'pg_restore.exe') --list $dump > (Join-Path $tmp 'lista.txt') 2> $err
  if ($LASTEXITCODE -ne 0) { Fallo 'La copia se descargó pero no se puede leer.' }
  # Tablas cuyo contenido va en la copia (también las vacías), por esquema. No cuenta las tablas «contenedor»
  # particionadas (p. ej. realtime.messages): no tienen filas propias; su estructura sí va en la copia.
  $conDatos = @(Select-String -Path (Join-Path $tmp 'lista.txt') -Pattern ' TABLE DATA (\S+) ' | ForEach-Object { $_.Matches[0].Groups[1].Value })
  $tablas = $conDatos.Count
  $porEsquema = ($conDatos | Group-Object | Sort-Object Count -Descending | ForEach-Object { "$($_.Name) $($_.Count)" }) -join ', '

  # 4. Cifrar (AES-256; -mhe=on cifra también los nombres) y 5. comprobar
  $info = Join-Path $tmp 'LEEME.txt'
  @(
    "Copia de Mother Verde ($Proyecto, $($p.Ref))",
    "Hecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')",
    "Herramienta: $(& (Join-Path $PgBin 'pg_dump.exe') --version)",
    "Tablas copiadas (con o sin filas): $tablas ($porEsquema)",
    "SHA-256 de $nombre.dump: $((Get-FileHash $dump -Algorithm SHA256).Hash)",
    'Cómo restaurar: docs/copias-seguridad.md (también en la carpeta herramientas).'
  ) | Set-Content -Path $info -Encoding UTF8
  $destino = Join-Path $dirCopias "$nombre.7z"
  & $SieteZip a -t7z -mx=5 -mhe=on "-p$pwCifrado" $destino $dump $info -bso0 -bsp0 2> $err
  if ($LASTEXITCODE -ne 0) { Fallo 'No se pudo cifrar la copia.' }
  & $SieteZip t "-p$pwCifrado" $destino -bso0 -bsp0 2> $err
  if ($LASTEXITCODE -ne 0) { Remove-Item $destino -Force -ErrorAction SilentlyContinue; Fallo 'El archivo cifrado no pasó la comprobación.' }
  $pwCifrado = $null
  $bytes = (Get-Item $destino).Length
  $tamano = if ($bytes -ge 1MB) { '{0:N1} MB' -f ($bytes / 1MB) } else { '{0:N0} KB' -f ($bytes / 1KB) }

  # Copia extra en un disco externo, si está configurado y conectado
  if ($DiscoExterno -and (Test-Path (Split-Path $DiscoExterno -Qualifier))) {
    $ext = Join-Path $DiscoExterno $Proyecto
    New-Item -ItemType Directory -Force -Path $ext | Out-Null
    Copy-Item $destino $ext -Force
  }

  # 6. Borrar copias viejas (solo tras una copia buena; siempre quedan las más recientes)
  $borradas = 0
  if (-not $SinBorrar) {
    $todas = Get-ChildItem $dirCopias -Filter "mv-$Proyecto-*.7z" | Sort-Object LastWriteTime -Descending
    $limite = (Get-Date).AddDays(-$DiasGuardar)
    $todas | Select-Object -Skip $MinimoGuardar | Where-Object { $_.LastWriteTime -lt $limite } | ForEach-Object {
      Remove-Item $_.FullName -Force; $borradas++
    }
  }

  Escribir-Registro "HECHA: $nombre.7z ($tamano; $tablas tablas copiadas, con o sin filas: $porEsquema; copias viejas borradas: $borradas)"
  Mostrar-Aviso "Mother Verde: copia hecha ($Proyecto)" "$nombre.7z · $tamano · $tablas tablas copiadas"
  exit 0
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
  $candado.ReleaseMutex() | Out-Null
}
