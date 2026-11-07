# Mother Verde · copias de seguridad diarias · configuración (SIN claves).
# Las claves están en la bóveda de Windows «MotherVerdeCopias» (SecretStore), nunca en archivos.
# Ver docs/copias-seguridad.md.

$Carpeta        = 'C:\CopiasMotherVerde'          # copias, registro y herramientas (sincronizada con Google Drive)
$DiscoExterno   = ''                              # opcional, por ejemplo 'E:\CopiasMotherVerde'; vacío = no se usa
$Boveda         = 'MotherVerdeCopias'
$SecretoCifrado = 'mv-cifrado'                    # tu contraseña de cifrado (la escribes tú, nunca la ve nadie)
$DiasGuardar    = 30                              # se borran las copias de más de 30 días...
$MinimoGuardar  = 7                               # ...pero siempre quedan al menos las 7 más recientes
$Intentos       = 3                               # si falla la conexión, se reintenta
$EsperaMinutos  = 10                              # minutos entre intentos

$PgBin    = 'C:\Program Files\PostgreSQL\17\bin'
$SieteZip = 'C:\Program Files\7-Zip\7z.exe'

# Un bloque por proyecto. Producción se añadirá SOLO con la autorización escrita de Bertha.
$Proyectos = @{
  staging = @{
    Ref        = 'ciqdnrdtaxbmcjvxljvq'
    Servidor   = 'aws-0-us-west-2.pooler.supabase.com'   # Supabase → Connect → Session pooler
    Puerto     = 5432
    Base       = 'postgres'
    Usuario    = 'mv_backup'                              # usuario de solo lectura (supabase/admin/backup-role-staging.sql)
    SecretoBase = 'mv-staging-db'                         # su contraseña, en la bóveda
  }
}
