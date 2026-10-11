// Part 2 of the DB tests: admins (MFA), unique-amount claims, gift codes,
// access admin, audit log, retry columns.
const REPO = new URL('../../supabase', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
export async function run({ db, as, q, check, cnt, hfa, BETIAN, MV, THIRD }) {
  const read = async (p) => (await import('fs')).readFileSync(REPO + '/' + p, 'utf8');
  const uid = (n) => `9${String(n).padStart(7, '0')}-0000-4000-8000-000000000000`;
  const newUser = async (n, confirmed = true) => {
    await db.exec(`insert into auth.users (id, email) values ('${uid(n)}', 'u${n}@example.org')`);
    if (confirmed) await db.exec(`update auth.users set email_confirmed_at = now() where id = '${uid(n)}'`);
    return uid(n);
  };
  const err = (r) => (r.error || '').replace(/^.*?:\s*/, '');

  console.log('10. Administración (rol admin + MFA AAL2):');
  check('el navegador NO puede escribir admin_users', !!(await as('authenticated', THIRD, `insert into admin_users (user_id) values ('${THIRD}')`)).error);
  check('el navegador NO puede leer admin_users', !!(await as('authenticated', THIRD, `select * from admin_users`)).error);
  check('nadie se asciende: admin_whoami de una cuenta normal = no admin', (await as('authenticated', THIRD, `select admin_whoami() v`)).rows?.[0]?.v?.admin === false);
  await db.exec((await read('admin/grant-admin.sql')).split('\n').filter(l => l.startsWith('insert')).join('\n'));
  check('grant-admin.sql (SQL Editor) da el rol a berthalimo@gmail.com', (await q(`select count(*)::int c from admin_users where user_id='${BETIAN}'`))[0].c === 1);
  const isAdm = async (u, aal) => (await as('authenticated', u, 'select is_admin_aal2() v', [], aal)).rows?.[0]?.v;
  check('admin SIN MFA (aal1) -> no cuenta como admin', await isAdm(BETIAN, 'aal1') === false);
  check('admin CON MFA (aal2) -> admin', await isAdm(BETIAN, 'aal2') === true);
  check('cuenta normal con MFA (aal2) -> no admin', await isAdm(THIRD, 'aal2') === false);
  check('admin sin MFA NO lista avisos', err(await as('authenticated', BETIAN, `select * from admin_list_claims()`, [], 'aal1')).includes('not_allowed'));
  check('usuario normal NO lista avisos', err(await as('authenticated', THIRD, `select * from admin_list_claims()`, [], 'aal2')).includes('not_allowed'));
  check('admin con MFA SÍ lista avisos', !(await as('authenticated', BETIAN, `select * from admin_list_claims()`, [], 'aal2')).error);
  check('SQL Editor SÍ lista avisos', !(await as(null, null, `select * from admin_list_claims()`)).error);
  check('service_role (API) NO pasa por "SQL Editor"', err(await as('service_role', null, `select * from admin_list_claims()`)).includes('not_allowed'));

  console.log('11. Avisos de aporte con monto único:');
  const U1 = await newUser(1), UNCONF = await newUser(2, false);
  const create = (u, n) => as('authenticated', u, `select * from create_support_claim(${n})`);
  check('correo sin confirmar -> no puede pedir monto', err(await create(UNCONF, 1)).includes('email_not_confirmed'));
  check('supporter -> no necesita pedir monto', err(await create(MV, 1)).includes('already_supporter'));
  check('flores fuera de 1–10 -> rechazado', err(await create(U1, 11)).includes('bad_flowers'));
  const c1 = (await create(U1, 2)).rows[0];
  const frac = c1.amount_units - 20000000;
  check('2 flores -> 20,0001–20,0099 USDC (4 decimales)', frac >= 100 && frac <= 9900 && frac % 100 === 0, String(c1.amount_units));
  const hrs = (new Date(c1.expires_at) - new Date(c1.created_at)) / 3600000;
  check('vence a las 72 h', Math.round(hrs) === 72 && c1.status === 'awaiting_payment');
  check('pedir otra vez lo mismo -> la misma solicitud', (await create(U1, 2)).rows[0].id === c1.id);
  const c1b = (await create(U1, 3)).rows[0];
  check('cambiar a 3 flores -> nueva solicitud, la anterior cancelada', c1b.id !== c1.id && (await q(`select status from support_claims where id=${c1.id}`))[0].status === 'canceled');
  const amounts = new Set([c1b.amount_units]);
  for (let i = 10; i < 108; i++) { const u = await newUser(i); const r = await create(u, 3); if (r.rows) amounts.add(r.rows[0].amount_units); }
  check('99 solicitudes abiertas de 3 flores -> 99 montos distintos', amounts.size === 99, String(amounts.size));
  check('la 100.ª con el mismo número de flores -> "ocupado, prueba más tarde"', err(await create(await newUser(200), 3)).includes('busy_try_later'));
  check('el navegador NO escribe support_claims directamente', !!(await as('authenticated', U1, `insert into support_claims (user_id, flowers, amount_units, expires_at) values ('${U1}', 1, 1, now())`)).error && !!(await as('authenticated', U1, `update support_claims set status='approved'`)).error);
  check('el navegador NO llama funciones internas (svc_*)', !!(await as('authenticated', U1, `select svc_approve_claim(${c1b.id}, null, 'x', 'x')`)).error);
  const TX = '0x' + 'ab'.repeat(32);
  check('código con formato inválido -> rechazado', err(await as('authenticated', U1, `select * from submit_support_claim_tx(${c1b.id}, '0x123')`)).includes('bad_tx_format'));
  check('no puede enviar código en la solicitud de otra persona', err(await as('authenticated', THIRD, `select * from submit_support_claim_tx(${c1b.id}, '${TX}')`)).includes('not_found'));
  const sub = await as('authenticated', U1, `select * from submit_support_claim_tx(${c1b.id}, '${TX.toUpperCase().replace('0X', '0x')}')`);
  check('código válido -> submitted (guardado en minúsculas)', sub.rows?.[0]?.status === 'submitted' && sub.rows[0].tx_hash === TX, JSON.stringify(sub));
  const U3 = await newUser(3); const c3 = (await create(U3, 1)).rows[0];
  check('TXID repetido (otra cuenta) -> rechazado', err(await as('authenticated', U3, `select * from submit_support_claim_tx(${c3.id}, '${TX}')`)).includes('tx_already_used'));
  await db.exec(`update support_claims set expires_at = now() - interval '1 minute' where id = ${c3.id}`);
  check('solicitud vencida -> no acepta código', err(await as('authenticated', U3, `select * from submit_support_claim_tx(${c3.id}, '0x${'cd'.repeat(32)}')`)).includes('expired'));
  // automatic check says "wrong amount" -> manual review with the reason
  const rec = await as('service_role', null, `select * from svc_record_claim_check(${c1b.id}, '{"all_pass": false, "checks": {"amount": false}}'::jsonb, true, 'monto distinto: llegaron 29.9 USDC')`);
  check('verificación con monto incorrecto -> revisión manual con motivo', rec.rows?.[0]?.status === 'manual_review' && rec.rows[0].review_reason.includes('monto'));
  check('admin sin MFA NO aprueba', err(await as('authenticated', BETIAN, `select * from admin_approve_claim(${c1b.id}, 'motivo largo')`, [], 'aal1')).includes('not_allowed'));
  check('aprobar sin motivo cuando la verificación falló -> exige motivo', err(await as('authenticated', BETIAN, `select * from admin_approve_claim(${c1b.id})`, [], 'aal2')).includes('reason_required'));
  await db.exec(`update profiles set trial_ends_at = now() - interval '1 hour' where id = '${U1}'`);
  check('antes de aprobar (prueba de 24 h ya vencida): sin acceso', await hfa(U1) === false);
  const ap = await as('authenticated', BETIAN, `select status from admin_approve_claim(${c1b.id}, 'Comprobado a mano en Basescan')`, [], 'aal2');
  check('admin con MFA aprueba con motivo -> approved', ap.rows?.[0]?.status === 'approved', JSON.stringify(ap));
  check('…y la cuenta pasa a supporter con acceso', await hfa(U1) === true && (await q(`select subscription_status s from profiles where id='${U1}'`))[0].s === 'supporter');
  check('…y queda en el registro de auditoría (quién, cuenta, motivo)', (await q(`select count(*)::int c from admin_audit_log where action='claim_approved' and target_user_id='${U1}' and actor_label='berthalimo@gmail.com' and reason like 'Comprobado%'`))[0].c === 1);
  check('rechazar exige motivo', err(await as(null, null, `select * from admin_reject_claim(${c3.id}, '')`)).includes('reason_required'));
  const U4 = await newUser(4); const c4 = (await create(U4, 1)).rows[0];
  await as('authenticated', U4, `select * from submit_support_claim_tx(${c4.id}, '0x${'ef'.repeat(32)}')`);
  await as('service_role', null, `select * from svc_record_claim_check(${c4.id}, '{"all_pass": true}'::jsonb, false, null)`);
  const auto = await as('service_role', null, `select status from svc_approve_claim(${c4.id}, null, 'auto-verify', 'all checks passed')`);
  check('verificación automática (service_role) aprueba cuando todo pasa', auto.rows?.[0]?.status === 'approved' && await hfa(U4) === true);
  { const cx = (await as('service_role', null, `select svc_claim_context(${c4.id}) v`)).rows?.[0]?.v; check('svc_claim_context: aviso + correo + idioma + ajustes (auto OFF por defecto)', cx?.email === 'u4@example.org' && cx.lang === 'es' && cx.auto_enabled === false && cx.min_confirmations === 30 && cx.auto_max_usdc === 100, JSON.stringify(cx)); }
  check('el navegador NO llama svc_claim_context', !!(await as('authenticated', U4, `select svc_claim_context(${c4.id})`)).error);
  check('cada persona ve solo sus solicitudes', (await cnt('authenticated', U1, 'select * from support_claims')) === 2 && (await cnt('authenticated', THIRD, 'select * from support_claims')) === 0);

  console.log('12. Códigos de regalo:');
  const mk = await as(null, null, `select * from admin_create_gift_codes(2, 7, 30)`);
  const codes = mk.rows.map(r => r.code);
  check('crear códigos (SQL Editor): formato XXXX-XXXX-XXXX sin letras confusas', codes.length === 2 && codes.every(c => /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(c)), JSON.stringify(codes));
  const stored = await q(`select * from gift_codes`);
  check('se guarda solo la huella, nunca el código', stored.every(r => !JSON.stringify(r).includes(codes[0]) && !JSON.stringify(r).includes(codes[0].replace(/-/g, ''))));
  check('el navegador NO lee gift_codes', !!(await as('authenticated', U1, 'select * from gift_codes')).error);
  check('usuario normal NO crea códigos', err(await as('authenticated', THIRD, `select * from admin_create_gift_codes(1)`, [], 'aal2')).includes('not_allowed'));
  const R1 = await newUser(5);
  const redeem = (u, code) => as('authenticated', u, `select redeem_gift_code('${code}') v`);
  check('correo sin confirmar -> no canjea', err(await redeem(UNCONF, codes[0])).includes('email_not_confirmed'));
  const trialBefore = (await q(`select trial_started_at from profiles where id='${R1}'`))[0].trial_started_at;
  const rd = (await redeem(R1, codes[0].toLowerCase().replace(/-/g, ' '))).rows?.[0]?.v;
  check('canje válido (minúsculas y espacios también) -> 7 días de acceso', rd?.ok === true && rd.days === 7 && await hfa(R1) === true, JSON.stringify(rd));
  check('…sin tocar la prueba (trial_started_at igual)', String((await q(`select trial_started_at from profiles where id='${R1}'`))[0].trial_started_at) === String(trialBefore));
  check('código reutilizado -> error genérico', (await redeem(await newUser(6), codes[0])).rows?.[0]?.v?.error === 'invalid_code');
  const sup = (await redeem(MV, codes[1])).rows?.[0]?.v;
  check('cuenta supporter -> avisa y NO consume el código', sup?.error === 'already_full_access' && (await q(`select status from gift_codes where code_hash = encode(sha256(convert_to('${codes[1].replace(/-/g, '')}','UTF8')),'hex')`))[0].status === 'active');
  await db.exec(`update gift_codes set expires_at = now() - interval '1 minute' where code_hash = encode(sha256(convert_to('${codes[1].replace(/-/g, '')}','UTF8')),'hex')`);
  check('código vencido -> error genérico', (await redeem(await newUser(7), codes[1])).rows?.[0]?.v?.error === 'invalid_code');
  const LOCK = await newUser(8);
  for (let i = 0; i < 5; i++) await redeem(LOCK, 'ZZZZ-ZZZZ-ZZZ' + i);
  const fresh = (await as(null, null, `select * from admin_create_gift_codes(1, 7, 30)`)).rows[0].code;
  check('tras 5 intentos fallidos en 24 h -> bloqueado (aunque el código sea válido)', err(await redeem(LOCK, fresh)).includes('too_many_attempts'));
  // sending by e-mail (Edge Function path): per-address limit and failure voids the code
  const send = (email) => as('service_role', null, `select svc_reserve_sent_gift_code(encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'), '${email}', 7, 7, '${BETIAN}', 'berthalimo@gmail.com') v`);
  const s1 = await send('amiga@example.org'); await send('Amiga@example.org'); await send('amiga@example.org');
  check('correo con formato inválido -> rechazado', err(await send('no-es-correo')).includes('bad_email'));
  { const dom = (await q('select domain from blocked_email_domains limit 1'))[0].domain; check('dominio desechable bloqueado (' + dom + ') -> rechazado', err(await send('x@' + dom)).includes('blocked_domain')); }
  check('3 códigos al mismo correo -> el 4.º se rechaza', err(await send('amiga@example.org')).includes('email_limit_3'));
  await as('service_role', null, `select svc_finish_sent_gift_code(${s1.rows[0].v}, false, 'SMTP 535', '${BETIAN}', 'berthalimo@gmail.com')`);
  check('si el correo falla, el código queda anulado y se registra', (await q(`select status, send_status from gift_codes where id=${s1.rows[0].v}`))[0].status === 'revoked' && (await q(`select count(*)::int c from admin_audit_log where action='gift_code_send_failed'`))[0].c === 1);
  check('el registro del envío no contiene el código', !(await q(`select details::text d from admin_audit_log where action like 'gift_code%'`)).some(r => /[A-Z2-9]{4}-[A-Z2-9]{4}/.test(r.d)));
  const today = (await q(`select count(*)::int c from gift_codes where created_at >= date_trunc('day', now())`))[0].c;
  for (let i = today; i < 20; i++) await send(`otro${i}@example.org`);
  check('21.º código del día -> rechazado (envío)', err(await send('nuevo@example.org')).includes('daily_limit_20'));
  check('21.º código del día -> rechazado (creación)', err(await as(null, null, `select * from admin_create_gift_codes(1)`)).includes('daily_limit_20'));
  check('el navegador NO llama svc_reserve_sent_gift_code', !!(await as('authenticated', BETIAN, `select svc_reserve_sent_gift_code('x','a@b.c',7,7,null,'x')`, [], 'aal2')).error);
  check('lista de códigos con estados (admin MFA)', (await as('authenticated', BETIAN, `select state from admin_list_gift_codes(500)`, [], 'aal2')).rows?.some(r => r.state === 'anulado'));

  console.log('13. Dar días / quitar acceso / auditoría:');
  const G = await newUser(9);
  const until = (await as(null, null, `select admin_grant_days('u9@example.org', 10, 'Compensación por un error') v`)).rows?.[0]?.v;
  const gEnd = (await q(`select trial_ends_at t from profiles where id='${G}'`))[0].t;
  check('dar 10 días en prueba -> 10 días que empiezan al acabar la prueba', Math.round((new Date(until) - new Date(gEnd)) / 86400000) === 10 && await hfa(G) === true, String(until));
  const G2 = await newUser(11000); await db.exec(`update profiles set trial_ends_at = now() - interval '1 day' where id = '${G2}'`);
  const u2 = (await as(null, null, `select admin_grant_days('u11000@example.org', 3, 'Regalo de prueba') v`)).rows?.[0]?.v;
  check('dar 3 días con la prueba vencida -> 3 días desde ahora, prueba intacta', Math.round((new Date(u2) - Date.now()) / 86400000) === 3 && await hfa(G2) === true);
  check('dar días exige motivo', err(await as(null, null, `select admin_grant_days('u9@example.org', 10, '')`)).includes('reason_required'));
  await as(null, null, `select admin_revoke_access('u9@example.org', 'Fraude: TXID ajeno')`);
  check('quitar acceso (fraude) -> sin acceso, cuenta intacta', await hfa(G) === false && (await q(`select subscription_status s from profiles where id='${G}'`))[0].s === 'revoked' && (await q(`select count(*)::int c from auth.users where id='${G}'`))[0].c === 1);
  await db.exec(`insert into gift_codes (code_hash, days, expires_at, created_label) values (encode(sha256(convert_to('REVOKEDTEST2','UTF8')),'hex'), 7, now() + interval '1 day', 'test')`);
  const rv = (await redeem(G, 'REVO-KEDT-EST2')).rows?.[0]?.v;
  check('cuenta con acceso quitado no se reactiva con un regalo (error genérico, código intacto)', rv?.error === 'invalid_code' && (await q(`select status from gift_codes where code_hash = encode(sha256(convert_to('REVOKEDTEST2','UTF8')),'hex')`))[0].status === 'active' && await hfa(G) === false);
  check('auditoría legible por admin con MFA', (await as('authenticated', BETIAN, `select * from admin_list_audit(500)`, [], 'aal2')).rows?.length >= 4);
  check('auditoría NO legible por usuario normal ni editable', err(await as('authenticated', THIRD, `select * from admin_list_audit()`, [], 'aal2')).includes('not_allowed') && !!(await as('authenticated', BETIAN, `delete from admin_audit_log`, [], 'aal2')).error);
  check('auditoría registra quién, qué, cuenta y motivo', (await q(`select count(*)::int c from admin_audit_log where action='access_revoked' and target_email='u9@example.org' and reason like 'Fraude%' and actor_label='sql-editor'`))[0].c === 1);

  console.log('14. Reintentos de traducción (columnas):');
  check('publicaciones con contador de intentos (0) y estado gave_up permitido', !(await as(null, null, `update community_posts set translation_status='gave_up', translation_attempts=5 where id = (select id from community_posts limit 1)`)).error);
  check('estado inválido rechazado', !!(await as(null, null, `update community_posts set translation_status='xyz' where id = (select id from community_posts limit 1)`)).error);
  check('el navegador NO toca intentos ni estado de traducción', !!(await as('authenticated', MV, `update community_posts set translation_attempts=0 where user_id='${MV}'`)).error);
}
