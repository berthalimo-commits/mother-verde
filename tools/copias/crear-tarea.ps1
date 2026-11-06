# Mother Verde · instala las herramientas en C:\CopiasMotherVerde\herramientas y crea la tarea diaria de las 20:00.
#   .\crear-tarea.ps1 -Proyecto staging          (crear o actualizar)
#   .\crear-tarea.ps1 -Proyecto staging -Quitar  (borrar la tarea; las copias NO se tocan)
# La tarea:
#   - todos los días a las 20:00;
#   - si a esa hora la laptop estaba apagada o dormida, se lanza en cuanto se pueda («StartWhenAvailable»);
#   - solo con tu sesión de Windows abierta (para mostrar el aviso y poder abrir la bóveda);
#   - también con batería; como mucho 1 hora; nunca dos a la vez.
# No necesita permisos de administrador.
param(
  [string]$Proyecto = 'staging',
  [switch]$Quitar
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'config.ps1')
if (-not $Proyectos[$Proyecto]) { throw "Proyecto desconocido: $Proyecto" }

$nombreTarea = "Copia diaria $Proyecto"
$rutaTarea = '\Mother Verde\'

if ($Quitar) {
  Unregister-ScheduledTask -TaskName $nombreTarea -TaskPath $rutaTarea -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Tarea «$nombreTarea» quitada. Las copias de $Carpeta siguen ahí."
  exit 0
}

# Herramientas en la carpeta de copias (así la tarea no depende del repositorio ni de la rama de git)
$herr = Join-Path $Carpeta 'herramientas'
New-Item -ItemType Directory -Force -Path $herr | Out-Null
foreach ($f in 'config.ps1', 'copia-diaria.ps1', 'restaurar.ps1', 'comprobar.sql', 'guardar-secretos.ps1') {
  Copy-Item (Join-Path $PSScriptRoot $f) $herr -Force
}
$doc = Join-Path $PSScriptRoot '..\..\docs\copias-seguridad.md'
if (Test-Path $doc) { Copy-Item $doc $herr -Force }

$script = Join-Path $herr 'copia-diaria.ps1'
$accion = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Proyecto $Proyecto"
$disparador = New-ScheduledTaskTrigger -Daily -At '20:00'
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
$quien = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $nombreTarea -TaskPath $rutaTarea -Action $accion -Trigger $disparador -Settings $ajustes `
  -Principal $quien -Description "Mother Verde: copia cifrada diaria de $Proyecto en $Carpeta (docs/copias-seguridad.md)" -Force | Out-Null

$t = Get-ScheduledTask -TaskName $nombreTarea -TaskPath $rutaTarea
Write-Host "Tarea «$nombreTarea» lista. Estado: $($t.State). Próxima vez: $((Get-ScheduledTaskInfo $t).NextRunTime)"
Write-Host "Herramientas copiadas en $herr"
