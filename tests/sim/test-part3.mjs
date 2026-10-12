// Part 3 of the DB tests: optional contact fields in claims, admin Users /
// user file / Summary / CSV export (permissions, audit, BOM, accents, formula
// injection, row limit) and what is deleted with an account.
export async function run({ db, as, q, check, newUser, ADMIN }) {
  const err = (r) => (r.error || '').replace(/^.*?:\s*/, '');
  const A2 = (sql) => as('authenticated', ADMIN, sql, [], 'aal2');
  console.log('15. Contacto opcional en el aviso de aporte:');
  const P = await newUser(700);
  await db.exec(`update profiles set trial_ends_at = now() - interval '1 hour' where id = '${P}'`);
  await db.exec(`insert into community_members (user_id, display_name, country) values ('${P}', 'José Núñez', 'PE')`);
  const c = (await as('authenticated', P, 'select * from create_support_claim(2)')).rows[0];
  const sub = (name, phone, tx = 'aa') => as('authenticated', P, `select * from submit_support_claim_tx(${c.id}, '0x${tx.repeat(32)}', $1, $2)`, [name, phone]);
  check('teléfono con formato inválido -> bad_contact_phone', err(await sub('María', 'llámame')).includes('bad_contact_phone'));
  check('nombre de más de 80 caracteres -> bad_contact_name', err(await sub('x'.repeat(81), null)).includes('bad_contact_name'));
  check('nombre con < > (HTML) -> bad_contact_name', err(await sub('<b>hola</b>', null)).includes('bad_contact_name'));
  const ok = await sub('  María   López ', ' +51 987 654 321 ');
  check('nombre y teléfono válidos (espacios normalizados) -> guardados', ok.rows?.[0]?.contact_name === 'María López' && ok.rows[0].contact_phone === '+51 987 654 321', JSON.stringify(ok));
  const Q = await newUser(701);
  check('otra cuenta NO puede leer los campos de contacto', !!(await as('authenticated', Q, `select contact_name, contact_phone from support_claims`)).error);
  check('ni la propia persona los lee directamente de la tabla (solo admin)', !!(await as('authenticated', P, `select contact_phone from support_claims`)).error && !(await as('authenticated', P, `select id, status from support_claims`)).error);
  check('otra cuenta no ve los avisos de otra persona', (await as('authenticated', Q, `select id from support_claims`)).rows?.length === 0);
  const lc = (await A2(`select contact_name, contact_phone from admin_list_claims(array['submitted']) where user_id = '${P}'`)).rows?.[0];
  check('el panel (admin con MFA) sí ve nombre y teléfono', lc?.contact_name === 'María López' && lc.contact_phone === '+51 987 654 321', JSON.stringify(lc));
  const sub2 = (await as('authenticated', Q, 'select * from create_support_claim(1)')).rows[0];
  check('los campos son opcionales (enviar sin contacto funciona)', (await as('authenticated', Q, `select * from submit_support_claim_tx(${sub2.id}, '0x${'ce'.repeat(32)}')`)).rows?.[0]?.status === 'submitted');

  console.log('16. Panel: Usuarios, ficha, Resumen, exportar CSV:');
  for (const [name, sql] of [['admin_list_users', `select * from admin_list_users()`], ['admin_get_user', `select admin_get_user('${P}')`], ['admin_summary', `select admin_summary()`], ['admin_export_csv', `select admin_export_csv('users')`]]) {
    check(`${name}: persona normal (con MFA) -> not_allowed`, err(await as('authenticated', Q, sql, [], 'aal2')).includes('not_allowed'));
    check(`${name}: admin SIN MFA -> not_allowed`, err(await as('authenticated', ADMIN, sql, [], 'aal1')).includes('not_allowed'));
  }
  const auditN = async (action) => (await q(`select count(*)::int c from admin_audit_log where action = '${action}'`))[0].c;
  const before = await auditN('user_viewed');
  const lu = (await A2(`select * from admin_list_users('josé')`)).rows;
  check('Usuarios: búsqueda por nombre (con acentos) encuentra a la persona, con país, idioma, estado y contacto', lu?.length === 1 && lu[0].display_name === 'José Núñez' && lu[0].country === 'PE' && lu[0].lang === 'es' && lu[0].state === 'prueba_vencida' && lu[0].contact_phone === '+51 987 654 321', JSON.stringify(lu));
  check('Usuarios: búsqueda por correo', (await A2(`select * from admin_list_users('u700@')`)).rows?.length === 1);
  const byState = (await A2(`select state, total from admin_list_users(null, 'acceso_completo', 1, 0)`)).rows;
  check('Usuarios: filtro por estado + paginación (total de filas)', byState.length === 1 && byState[0].state === 'acceso_completo' && Number(byState[0].total) >= 2, JSON.stringify(byState));
  check('Usuarios: estado desconocido -> bad_state', err(await A2(`select * from admin_list_users(null, 'xyz')`)).includes('bad_state'));
  check('cargar la lista NO se registra', (await auditN('user_viewed')) === before);
  const f = (await A2(`select admin_get_user('${P}') v`)).rows?.[0]?.v;
  check('ficha: datos de cuenta, avisos de aporte y contacto', f?.email === 'u700@example.org' && f.claims?.length === 1 && f.contact_name === 'María López', JSON.stringify(f).slice(0, 200));
  check('ficha: SIN contenido privado (ni Bitácora, ni fotos, ni publicaciones)', !/bitacora|photo|post|comment|body/i.test(Object.keys(f || {}).join(',')));
  check('abrir la ficha SÍ se registra (user_viewed, quién y a quién)', (await auditN('user_viewed')) === before + 1 && (await q(`select count(*)::int c from admin_audit_log where action = 'user_viewed' and target_email = 'u700@example.org' and actor_label = 'hello@motherverdeny.com'`))[0].c === 1);
  const s = (await A2(`select admin_summary() v`)).rows?.[0]?.v;
  check('Resumen: cuentas, altas 7 días, estados, avisos por estado y USDC activado', s && s.accounts > 0 && s.new_7d > 0 && s.states?.prueba_vencida >= 1 && s.claims?.pendiente >= 1 && s.claims?.activado >= 1 && Number(s.usdc_activated) > 0, JSON.stringify(s));

  // CSV
  await db.exec(`insert into community_members (user_id, display_name) values ('${Q}', '=HYPERLINK("http://malo.example","clic")')`);
  const ex = (await A2(`select admin_export_csv('users', '{"search":"", "state":""}'::jsonb) v`)).rows?.[0]?.v;
  const csv = ex?.csv || '';
  check('CSV: empieza con BOM UTF-8 (Excel abre bien los acentos)', csv.charCodeAt(0) === 0xfeff);
  check('CSV: acentos intactos (José Núñez, María López)', csv.includes('"José Núñez"') && csv.includes('"María López"'));
  check('CSV: inyección de fórmulas neutralizada (=HYPERLINK -> \'=HYPERLINK)', csv.includes(`"'=HYPERLINK(""http://malo.example"",""clic"")"`) && !/(^|,)"=HYPERLINK/m.test(csv));
  check('CSV Usuarios: solo las columnas permitidas', csv.split('\r\n')[0] === '﻿email,display_name,country,language,access_state,created_utc,trial_ends_utc,access_until_utc,contact_name,contact_phone');
  const au = (await q(`select actor_label, reason, details from admin_audit_log where action = 'csv_export' order by at desc limit 1`))[0];
  check('exportación registrada: quién, pestaña, filtros, filas y si se cortó', au?.actor_label === 'hello@motherverdeny.com' && au.reason === 'users' && au.details.rows === ex.rows && au.details.truncated === false && 'filters' in au.details, JSON.stringify(au));
  check('…sin datos exportados en el registro (ni correos, ni nombres, ni teléfonos)', !/@example|José|María|\+51/.test(JSON.stringify(au)));
  await db.exec(`update app_config set value = 2 where key = 'csv_export_max_rows'`);
  const ex2 = (await A2(`select admin_export_csv('audit') v`)).rows?.[0]?.v;
  check('límite de filas por exportación (aquí 2) -> se corta y lo indica', ex2.rows === 2 && ex2.truncated === true && ex2.csv.split('\r\n').filter(Boolean).length === 3);
  await db.exec(`update app_config set value = 5000 where key = 'csv_export_max_rows'`);
  for (const tab of ['claims', 'gifts', 'audit']) check(`exportar ${tab} funciona`, !(await A2(`select admin_export_csv('${tab}')`)).error);
  check('pestaña desconocida -> bad_tab', err(await A2(`select admin_export_csv('bitacora')`)).includes('bad_tab'));

  console.log('17. Al borrar la cuenta:');
  await db.exec(`delete from auth.users where id = '${P}'`);
  check('sus avisos de aporte (con nombre y teléfono) se borran en cascada', (await q(`select count(*)::int c from support_claims where user_id = '${P}'`))[0].c === 0 && (await q(`select count(*)::int c from support_claims where contact_phone = '+51 987 654 321'`))[0].c === 0);
  const kept = (await q(`select count(*)::int c from admin_audit_log where target_email = 'u700@example.org'`))[0].c;
  check(`el registro de auditoría conserva el correo en ${kept} anotación(es) (a tener en cuenta en la Política)`, kept >= 1);
}
