// Builds supabase/produccion/: every SQL file for launch day, numbered in the
// exact order of docs/plan-migracion.md (steps 11, 12, 12b, 13), each with a
// short header saying what it is and where it comes from. The SQL itself is a
// byte-for-byte copy of the source (never edited here). Also writes
// read-only-checks.sql (step 13: one query, every row must say «ok»), which
// covers the platform, manual contributions, purpose, the trial once per
// person and the game. Run again after any migration change:
//   node tools/build-produccion.mjs
// The prod-files test applies these files in order on a real Postgres and
// fails if the folder is out of date.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SB = path.join(ROOT, 'supabase');
const OUT = path.join(SB, 'produccion');

// [source (relative to supabase/), what it is, kind]
// kind: 'lectura' = read-only (changes nothing), 'cambio' = one transaction,
//       'manual' = read the header first (two parts)
const PLATFORM = ['20261010130000_community_full_access', '20261011100000_admin_and_audit', '20261011120000_support_claims',
  '20261011130000_gift_codes_and_access', '20261013100000_mail_delivery', '20261013110000_mail_failures_panel', '20261013120000_signup_fix_limits',
  '20261014100000_claims_survive_account_deletion', '20261014110000_late_payment', '20261014120000_late_payment_conflicts',
  '20261014130000_pending_claims_counter', '20261014140000_one_access_rule', '20261020100000_bitacora_read_only_without_access'];
export const ORDER = [
  ['admin/precheck-before-20261010.sql', 'Comprobación ANTES de empezar (paso 11): todas las filas «ok». Si no, PARA.', 'lectura'],
  ['migrations/20261010120000_access_support_model.sql', 'Modelo de acceso: prueba de 24 h, aporte único, regla de registro.', 'cambio'],
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => [`seed-blocked-email-domains/part-0${n}.sql`, `Dominios de correo desechable bloqueados, parte ${n} de 7.`, 'cambio']),
  ...PLATFORM.map((m) => [`migrations/${m}.sql`, 'Plataforma: ' + m.slice(15).replace(/_/g, ' ') + '.', 'cambio']),
  ['migrations/20261103100000_manual_contributions.sql', 'Aportes manuales (PayPal, Cash App…).', 'cambio'],
  ['migrations/20261104100000_purpose_and_signup_message.sql', 'Propósito del aporte (casilla) + «Ya tienes cuenta».', 'cambio'],
  ['migrations/20261105100000_trial_once_per_person.sql', 'Prueba de 24 h una sola vez por persona (huella del correo al borrar la cuenta).', 'cambio'],
  ['admin/supporters-betian-mother-verde.sql', 'Acceso completo para tus dos cuentas. Ejecuta primero solo la PARTE 1 (lectura) y comprueba que salen exactamente esas dos cuentas; después la PARTE 2.', 'manual'],
  ['admin/precheck-game.sql', 'Comprobación ANTES del juego (paso 12b): todas las filas «ok». Si sale FALTA o YA EXISTE, PARA.', 'lectura'],
  ['migrations/20261015100000_game_progress.sql', 'Juego: partidas guardadas.', 'cambio'],
  ['migrations/20261029100000_game_setup.sql', 'Juego: equipo de la carpa.', 'cambio'],
  ['migrations/20261031100000_game_plants.sql', 'Juego: varias plantas y machos.', 'cambio'],
];

const domains = fs.readFileSync(path.join(SB, 'blocked-email-domains.txt'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).length;

// Step 13: one read-only query. Every row must say «ok».
export const CHECKS = `-- PRODUCCIÓN · paso 13 · comprobación final de SOLO LECTURA (no cambia nada).
-- Pegar en el SQL Editor DESPUÉS de todos los archivos anteriores. Cada fila debe decir «ok».
-- Si alguna dice FALTA o REVISAR: para y manda la captura. No da error aunque falte algo: lo marca FALTA.
-- Generado por tools/build-produccion.mjs (no editar a mano).
with t(orden, que, bien) as (values
  -- plataforma
  (1,  'acceso: access_info, my_access, has_full_access, is_premium', to_regprocedure('public.access_info(uuid)') is not null and to_regprocedure('public.my_access()') is not null and to_regprocedure('public.has_full_access()') is not null and to_regprocedure('public.is_premium(uuid)') is not null),
  (2,  'prueba de 24 h al confirmar el correo (disparador)', exists (select 1 from pg_trigger where tgname = 'on_auth_email_confirmed' and tgrelid = 'auth.users'::regclass)),
  (3,  'regla de registro (hook) solo para Supabase Auth', case when to_regprocedure('public.hook_before_user_created(jsonb)') is null then false else has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute') and not has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute') end),
  (4,  'dominios desechables bloqueados: al menos ${domains}', case when to_regclass('public.blocked_email_domains') is null then false else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.blocked_email_domains', false, true, '')))[1]::text::int >= ${domains} end),
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
`;

export function build() {
  const files = {};
  ORDER.forEach(([src, what, kind], i) => {
    const n = String(i + 1).padStart(2, '0');
    const name = `${n}-${src.startsWith('seed-') ? 'dominios-bloqueados-' : ''}${path.basename(src)}`;
    const how = kind === 'lectura' ? 'SOLO LECTURA: no cambia nada.' : kind === 'manual' ? 'Dos partes: lee la explicación de abajo antes de ejecutar.' : 'Pegar ENTERO y ejecutar una vez. Es una sola transacción: si falla, no se aplica nada de este archivo.';
    const head = `-- PRODUCCIÓN · archivo ${n} de ${ORDER.length + 1} · ${what}\n-- ${how}\n-- Copia exacta de supabase/${src} (generado por tools/build-produccion.mjs; no editar a mano).\n\n`;
    files[name] = head + fs.readFileSync(path.join(SB, src), 'utf8');
  });
  files[`${String(ORDER.length + 1).padStart(2, '0')}-read-only-checks.sql`] = CHECKS;
  const list = Object.keys(files).map((f, i) => `${i + 1}. \`${f}\` — ${i < ORDER.length ? ORDER[i][1] : 'Comprobación final (paso 13): todas las filas «ok».'}`).join('\n');
  files['00-LEEME.md'] = `# Archivos SQL para el día del lanzamiento (producción)

Generados por \`node tools/build-produccion.mjs\` a partir de \`supabase/migrations/\`, \`supabase/admin/\` y
\`supabase/seed-blocked-email-domains/\`. **No los edites a mano**: si cambia una migración, vuelve a generarlos.
La prueba \`tests/sim/prod-files.mjs\` los aplica en este orden sobre un Postgres real y falla si están desactualizados.

Pasos del plan (\`docs/plan-migracion.md\`): archivo 01 = paso 11 · archivos 02–${String(ORDER.length - 4).padStart(2, '0')} = paso 12 ·
archivos ${String(ORDER.length - 3).padStart(2, '0')}–${String(ORDER.length).padStart(2, '0')} = paso 12b (juego) · archivo ${String(ORDER.length + 1).padStart(2, '0')} = paso 13.

**Cómo pegarlos:** Supabase (producción) → SQL Editor → New query → copiar el archivo **entero** → Run. Uno a uno, en
este orden. Los de «SOLO LECTURA» no cambian nada: si alguna fila no dice «ok», **para** y manda la captura.

${list}
`;
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const files = build();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const [f, c] of Object.entries(files)) fs.writeFileSync(path.join(OUT, f), c);
  console.log(`${Object.keys(files).length} archivos en supabase/produccion/`);
}
