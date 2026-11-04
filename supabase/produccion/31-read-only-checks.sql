-- PRODUCCIÓN · paso 13 · comprobación final de SOLO LECTURA (no cambia nada).
-- Pegar en el SQL Editor DESPUÉS de todos los archivos anteriores. Cada fila debe decir «ok».
-- Si alguna dice FALTA o REVISAR: para y manda la captura. No da error aunque falte algo: lo marca FALTA.
-- Generado por tools/build-produccion.mjs (no editar a mano).
with t(orden, que, bien) as (values
  -- plataforma
  (1,  'acceso: access_info, my_access, has_full_access, is_premium', to_regprocedure('public.access_info(uuid)') is not null and to_regprocedure('public.my_access()') is not null and to_regprocedure('public.has_full_access()') is not null and to_regprocedure('public.is_premium(uuid)') is not null),
  (2,  'prueba de 24 h al confirmar el correo (disparador)', exists (select 1 from pg_trigger where tgname = 'on_auth_email_confirmed' and tgrelid = 'auth.users'::regclass)),
  (3,  'regla de registro (hook) solo para Supabase Auth', case when to_regprocedure('public.hook_before_user_created(jsonb)') is null then false else has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute') and not has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute') end),
  (4,  'dominios desechables bloqueados: al menos 9222', case when to_regclass('public.blocked_email_domains') is null then false else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.blocked_email_domains', false, true, '')))[1]::text::int >= 9222 end),
  (5,  'comunidad: límites y cupo de DeepL', to_regclass('public.app_config') is not null and to_regclass('public.deepl_usage_daily') is not null and to_regclass('public.community_usage_log') is not null),
  (6,  'panel: administradores y registro', to_regclass('public.admin_users') is not null and to_regclass('public.admin_audit_log') is not null and to_regprocedure('public.admin_whoami()') is not null),
  (7,  'avisos de aporte, códigos de regalo y conflictos', to_regclass('public.support_claims') is not null and to_regclass('public.gift_codes') is not null and to_regclass('public.gift_redeem_attempts') is not null and to_regclass('public.support_claim_conflicts') is not null),
  (8,  'avisos: tarde, historial y cuenta borrada', (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'support_claims' and column_name in ('late', 'review_history', 'account_deleted_at')) = 3),
  (9,  'correos: registro de envíos y corrección de correo', to_regclass('public.mail_events') is not null and to_regclass('public.signup_fix_attempts') is not null and to_regprocedure('public.admin_pending_claims()') is not null),
  (10, 'Bitácora: escribir solo con acceso completo', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bitacora_entries' and policyname = 'bitacora_insert_own' and with_check like '%has_full_access%')),
  -- aportes manuales
  (11, 'aportes manuales: tabla, protección y funciones del panel', to_regclass('public.manual_contributions') is not null and to_regprocedure('public.admin_list_manual_contributions(uuid, integer)') is not null and to_regprocedure('public.admin_void_manual_contribution(bigint, text)') is not null and to_regprocedure('public.svc_grant_full_access(uuid)') is not null),
  (12, 'aportes manuales: nadie los lee desde el navegador', case when to_regclass('public.manual_contributions') is null then false else not has_table_privilege('anon', 'public.manual_contributions', 'select') and not has_table_privilege('authenticated', 'public.manual_contributions', 'insert') end),
  -- propósito
  (13, 'propósito: se guarda la fecha de la casilla', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'support_claims' and column_name = 'purpose_accepted_at')),
  (14, 'propósito: reservar exige la casilla (función de 2 argumentos; la de 1 cerrada)', case when to_regprocedure('public.create_support_claim(integer, boolean)') is null or to_regprocedure('public.create_support_claim(integer)') is null then false else has_function_privilege('authenticated', 'public.create_support_claim(integer, boolean)', 'execute') and not has_function_privilege('authenticated', 'public.create_support_claim(integer)', 'execute') end),
  (15, '«Ya tienes cuenta»: el registro avisa del correo repetido', coalesce(pg_get_functiondef(to_regprocedure('public.hook_before_user_created(jsonb)')) like '%account_exists%', false)),
  -- prueba una vez por persona
  (16, 'prueba una vez por persona: huellas y disparador al borrar cuenta', to_regclass('public.trial_email_hashes') is not null and exists (select 1 from pg_trigger where tgname = 'on_auth_user_delete_trial' and tgrelid = 'auth.users'::regclass)),
  (17, 'prueba una vez por persona: la prueba consulta las huellas', coalesce(pg_get_functiondef(to_regprocedure('public.start_trial_on_email_confirmed()')) like '%trial_email_used%', false)),
  (18, 'prueba una vez por persona: huellas y clave secreta invisibles desde el navegador', case when to_regclass('public.trial_pepper') is null or to_regclass('public.trial_email_hashes') is null then false else not has_table_privilege('authenticated', 'public.trial_email_hashes', 'select') and not has_table_privilege('authenticated', 'public.trial_pepper', 'select') end),
  -- juego
  (19, 'juego: partidas guardadas y función de guardado', to_regclass('public.game_progress') is not null and to_regprocedure('public.game_save(jsonb)') is not null),
  (20, 'juego: acepta el equipo de la carpa (20261029) y los machos (20261031)', coalesce(pg_get_functiondef(to_regprocedure('public.game_state_valid(jsonb)')) like '%machos%', false) and coalesce(pg_get_functiondef(to_regprocedure('public.game_state_valid(jsonb)')) like '%setup%', false)),
  (21, 'juego: nadie escribe la tabla directamente', case when to_regclass('public.game_progress') is null then false else not has_table_privilege('authenticated', 'public.game_progress', 'insert') and not has_table_privilege('authenticated', 'public.game_progress', 'update') end),
  -- seguridad general
  (22, 'todas las tablas de public con RLS encendido', not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity)),
  (23, 'tus dos cuentas con acceso completo (si ya existen)', not exists (select 1 from auth.users u join public.profiles p on p.id = u.id where u.email in ('berthalimo@gmail.com', 'berthalimo@proton.me') and not public.is_premium(u.id)))
)
select orden, que, case when bien then 'ok' when bien is null then 'REVISAR' else 'FALTA' end as resultado
from t order by orden;
