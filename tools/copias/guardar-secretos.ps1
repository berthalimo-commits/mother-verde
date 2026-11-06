# Mother Verde · guarda las claves de las copias en la bóveda de Windows (sin mostrarlas nunca).
#
#   .\guardar-secretos.ps1 -Que base -Proyecto staging
#       Genera al azar la contraseña del usuario de solo lectura mv_backup, la guarda en la bóveda
#       y copia al PORTAPAPELES solo su huella SCRAM:  alter role mv_backup with password 'SCRAM-SHA-256$…';
#       Esa línea se pega en el SQL Editor del proyecto (no contiene la contraseña).
#       -Nueva: genera otra (por ejemplo si se sospecha que se filtró); hay que volver a pegar la línea.
#
#   .\guardar-secretos.ps1 -Que cifrado
#       Pide tu contraseña de cifrado dos veces, con puntos en vez de letras, y la guarda en la bóveda.
#       Guárdala TAMBIÉN en tu gestor de contraseñas: sin ella ninguna copia se puede abrir.
#       -Cambiar: la sustituye (las copias anteriores siguen necesitando la contraseña anterior).
param(
  [Parameter(Mandatory)][ValidateSet('base', 'cifrado')][string]$Que,
  [string]$Proyecto = 'staging',
  [switch]$Nueva,
  [switch]$Cambiar
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'config.ps1')
Import-Module Microsoft.PowerShell.SecretManagement, Microsoft.PowerShell.SecretStore

function Get-Huella-Scram([string]$Contrasena) {
  # Huella SCRAM-SHA-256 como la guarda PostgreSQL (RFC 5802 / 7677): PBKDF2-HMAC-SHA256, 4096 vueltas.
  $sal = New-Object byte[] 16
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($sal)
  $kdf = New-Object System.Security.Cryptography.Rfc2898DeriveBytes -ArgumentList ([Text.Encoding]::UTF8.GetBytes($Contrasena)), $sal, 4096, ([System.Security.Cryptography.HashAlgorithmName]::SHA256)
  $salada = $kdf.GetBytes(32)
  $hmac = New-Object System.Security.Cryptography.HMACSHA256 -ArgumentList (, $salada)
  $claveCliente = $hmac.ComputeHash([Text.Encoding]::ASCII.GetBytes('Client Key'))
  $claveGuardada = [System.Security.Cryptography.SHA256]::Create().ComputeHash($claveCliente)
  $claveServidor = $hmac.ComputeHash([Text.Encoding]::ASCII.GetBytes('Server Key'))
  return 'SCRAM-SHA-256$4096:' + [Convert]::ToBase64String($sal) + '$' + [Convert]::ToBase64String($claveGuardada) + ':' + [Convert]::ToBase64String($claveServidor)
}

function New-Contrasena-Azar([int]$Largo = 40) {
  # Solo letras y números: sin caracteres que haya que escapar en ningún sitio.
  $abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $b = New-Object byte[] 1
  $sb = New-Object System.Text.StringBuilder
  while ($sb.Length -lt $Largo) {
    $rng.GetBytes($b)
    if ($b[0] -lt 248) { [void]$sb.Append($abc[$b[0] % 62]) }   # 248 = 4 × 62: sin sesgo
  }
  return $sb.ToString()
}

if ($Que -eq 'base') {
  $p = $Proyectos[$Proyecto]
  if (-not $p) { throw "Proyecto desconocido: $Proyecto" }
  $existe = Get-SecretInfo -Vault $Boveda -Name $p.SecretoBase -ErrorAction SilentlyContinue
  if ($existe -and -not $Nueva) {
    Write-Host "Ya hay una contraseña guardada para $Proyecto. Para cambiarla: añade -Nueva (y vuelve a pegar la línea en el SQL Editor)."
    exit 1
  }
  $pw = New-Contrasena-Azar
  Set-Secret -Vault $Boveda -Name $p.SecretoBase -Secret (ConvertTo-SecureString $pw -AsPlainText -Force)
  $linea = "alter role $($p.Usuario) with password '" + (Get-Huella-Scram $pw) + "';"
  $pw = $null
  Set-Clipboard -Value $linea
  $linea = $null
  Write-Host "Listo. La contraseña de $($p.Usuario) ($Proyecto) está guardada en la bóveda y nadie la ha visto."
  Write-Host "En el PORTAPAPELES está la línea con su huella. Pégala en el SQL Editor de $Proyecto ($($p.Ref)) y pulsa Run."
  exit 0
}

if ($Que -eq 'cifrado') {
  $existe = Get-SecretInfo -Vault $Boveda -Name $SecretoCifrado -ErrorAction SilentlyContinue
  if ($existe -and -not $Cambiar) {
    Write-Host 'Ya hay una contraseña de cifrado guardada. Para sustituirla: añade -Cambiar.'
    Write-Host 'Ojo: las copias ya hechas seguirán necesitando la contraseña anterior.'
    exit 1
  }
  $a = Read-Host -AsSecureString 'Escribe tu contraseña de cifrado (mínimo 16 caracteres)'
  $b = Read-Host -AsSecureString 'Escríbela otra vez'
  $pa = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($a))
  $pb = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($b))
  if ($pa -cne $pb) { $pa = $null; $pb = $null; Write-Host 'No coinciden. No se guardó nada; vuelve a ejecutarlo.'; exit 1 }
  if ($pa.Length -lt 16) { $pa = $null; $pb = $null; Write-Host 'Tiene menos de 16 caracteres. No se guardó nada.'; exit 1 }
  if ($pa -match '"') { $pa = $null; $pb = $null; Write-Host 'No uses comillas dobles ("). No se guardó nada.'; exit 1 }
  $pa = $null; $pb = $null
  Set-Secret -Vault $Boveda -Name $SecretoCifrado -Secret $a
  Write-Host 'Listo. Tu contraseña de cifrado está guardada en la bóveda.'
  Write-Host 'Recuerda: guárdala TAMBIÉN en tu gestor de contraseñas. Sin ella ninguna copia se puede abrir.'
  exit 0
}
