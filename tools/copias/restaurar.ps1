# Mother Verde · abrir y restaurar una copia de seguridad.
#
#   .\restaurar.ps1 -Archivo C:\CopiasMotherVerde\staging\mv-staging-AAAA-MM-DD_HHMM.7z -Prueba
#       Restaura la copia en una base de PRUEBA local (Docker, imagen oficial de Supabase, solo en 127.0.0.1:55432),
#       en la base «restaurada». No toca Supabase. Sirve para comprobar que una copia está bien.
#       -Borrar: al terminar, borra la base de prueba (el contenedor).
#
#   .\restaurar.ps1 -Archivo ...\mv-staging-....7z -SoloDescifrar -Salida C:\Restaurar
#       Solo descifra: deja el archivo .dump en la carpeta indicada, para restaurarlo en un proyecto nuevo de
#       Supabase siguiendo docs/copias-seguridad.md («Si hay un desastre»). Borra esa carpeta al terminar.
#
# La contraseña de cifrado se lee de la bóveda. En otro ordenador (sin bóveda) la pide con puntos en vez de letras.
param(
  [Parameter(Mandatory)][string]$Archivo,
  [switch]$Prueba,
  [switch]$SoloDescifrar,
  [string]$Salida = '',
  [switch]$Borrar,
  [string]$Imagen = 'supabase/postgres:17.6.1.178'
)
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'config.ps1')
if (-not (Test-Path $Archivo)) { Write-Host "No encuentro $Archivo"; exit 1 }
if (-not ($Prueba -or $SoloDescifrar)) { Write-Host 'Elige -Prueba o -SoloDescifrar.'; exit 1 }

# Contraseña de cifrado
$pw = $null
try {
  Import-Module Microsoft.PowerShell.SecretManagement, Microsoft.PowerShell.SecretStore -ErrorAction Stop
  $pw = Get-Secret -Vault $Boveda -Name $SecretoCifrado -AsPlainText -ErrorAction Stop
} catch {
  $s = Read-Host -AsSecureString 'Contraseña de cifrado de las copias'
  $pw = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
}

$tmp = if ($SoloDescifrar -and $Salida) { $Salida } else { Join-Path $env:TEMP ('mvrestaurar-' + [guid]::NewGuid().ToString('N')) }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  & $SieteZip x "-p$pw" "-o$tmp" -y $Archivo -bso0 -bsp0
  $pw = $null
  if ($LASTEXITCODE -ne 0) { Write-Host 'No se pudo abrir la copia (¿contraseña de cifrado equivocada?).'; exit 1 }
  $dump = Get-ChildItem $tmp -Filter '*.dump' | Select-Object -First 1
  if (-not $dump) { Write-Host 'La copia no contiene ningún archivo .dump.'; exit 1 }
  Get-Content (Join-Path $tmp 'LEEME.txt') -ErrorAction SilentlyContinue | ForEach-Object { "  $_" }
  $hash = (Get-FileHash $dump.FullName -Algorithm SHA256).Hash
  $esperado = (Select-String -Path (Join-Path $tmp 'LEEME.txt') -Pattern 'SHA-256 de .*: ([0-9A-F]{64})' -ErrorAction SilentlyContinue).Matches.Groups[1].Value
  if ($esperado -and $esperado -ne $hash) { Write-Host 'La huella SHA-256 del .dump NO coincide con la de LEEME.txt: la copia está dañada.'; exit 1 }
  Write-Host "Copia abierta y sin daños (SHA-256 coincide): $($dump.Name)"

  if ($SoloDescifrar) {
    Write-Host "Archivo listo en: $($dump.FullName)"
    Write-Host 'Sigue docs/copias-seguridad.md («Si hay un desastre») y BORRA esta carpeta al terminar: no está cifrada.'
    exit 0
  }

  # --- Base de prueba local en Docker (imagen oficial de Supabase: trae sus esquemas, roles y extensiones)
  $c = 'mv-restaurar-prueba'
  docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Host 'Docker no está en marcha: abre Docker Desktop y vuelve a intentarlo.'; exit 1 }
  $existe = docker ps -a --filter "name=^$c$" --format '{{.Names}}'
  if (-not $existe) {
    $b = New-Object byte[] 18; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    $pwLocal = [Convert]::ToBase64String($b) -replace '[+/=]', 'x'
    docker run -d --name $c -e "POSTGRES_PASSWORD=$pwLocal" -p 127.0.0.1:55432:5432 $Imagen | Out-Null
    $pwLocal = $null
  } else { docker start $c | Out-Null }
  for ($i = 0; $i -lt 60; $i++) { Start-Sleep -Seconds 3; docker exec $c pg_isready -U postgres -h localhost 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { break } }
  Start-Sleep -Seconds 5
  docker cp $dump.FullName "${c}:/tmp/copia.dump" | Out-Null
  docker exec $c psql -U supabase_admin -d postgres -X -q -c 'drop database if exists restaurada with (force);' -c 'create database restaurada;' 2>$null | Out-Null
  # Roles internos de Supabase alojado que la imagen local no trae (solo dueños de objetos; sin acceso)
  docker exec $c psql -U supabase_admin -d postgres -X -q -c "do `$`$ begin if not exists (select 1 from pg_roles where rolname = 'supabase_realtime_admin') then create role supabase_realtime_admin nologin; end if; end `$`$;" 2>$null | Out-Null
  Write-Host 'Restaurando en la base de prueba «restaurada»...'
  $log = Join-Path $tmp 'pg_restore.txt'
  docker exec $c pg_restore -U supabase_admin -d restaurada --no-password /tmp/copia.dump *> $log
  docker exec $c rm -f /tmp/copia.dump | Out-Null
  $lineas = @(Get-Content $log -ErrorAction SilentlyContinue)
  $errores = @($lineas | Where-Object { $_ -match '^pg_restore: error:' })
  Write-Host "Restauración terminada. Avisos de pg_restore: $($errores.Count) (agrupados abajo; los de objetos que la imagen ya trae son normales)."
  # Agrupa por mensaje (la línea ERROR que sigue a cada aviso) y muestra el objeto afectado del primero
  for ($k = 0; $k -lt $lineas.Count; $k++) {
    if ($lineas[$k] -match '^pg_restore: from TOC entry') { $objeto = $lineas[$k] -replace '^pg_restore: from TOC entry \d+; \d+ \d+ ', '' }
    if ($lineas[$k] -match '^pg_restore: error:') { $mensajes += , ($lineas[$k] -replace '^pg_restore: error: (could not execute query: )?', '') + '   <- ' + $objeto }
  }
  $mensajes | Group-Object { ($_ -split '   <- ')[0] } | Sort-Object Count -Descending | ForEach-Object {
    '  {0} x {1}   (p. ej. {2})' -f $_.Count, $_.Name.Substring(0, [Math]::Min(110, $_.Name.Length)), (($_.Group[0] -split '   <- ')[1]).Substring(0, [Math]::Min(80, (($_.Group[0] -split '   <- ')[1]).Length))
  }
  Write-Host "Para comprobarla: psql dentro del contenedor «$c», base «restaurada» (ver docs/copias-seguridad.md)."
  if ($Borrar) { docker rm -f $c | Out-Null; Write-Host 'Base de prueba borrada.' }
  exit 0
}
finally {
  $pw = $null
  if (-not ($SoloDescifrar -and $Salida) -and (Test-Path $tmp)) { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}
