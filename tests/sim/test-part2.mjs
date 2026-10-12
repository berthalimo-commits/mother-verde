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
  const grant = async () => { try { await db.exec(await read('admin/grant-admin.sql')); return 'ok'; } catch (e) { try { await db.exec('rollback'); } catch {} return e.message; } };
  const admins = async () => (await q('select u.email from admin_users a join auth.users u on u.id = a.user_id order by 1')).map((r) => r.email);
  let g = await grant();
  check('grant-admin.sql sin la cuenta hello@ -> se detiene con mensaje claro y no da el rol a nadie', g.includes('no existe ninguna cuenta con hello@motherverdeny.com') && (await admins()).length === 0, g);
  const ADMIN = '7a000001-0000-4000-8000-000000000000';
  await db.exec(`insert into auth.users (id, email) values ('${ADMIN}', 'hello@motherverdeny.com')`);
  g = await grant();
  check('grant-admin.sql con hello@ sin confirmar -> se detiene, nadie es admin', g.includes('no está confirmado') && (await admins()).length === 0, g);
  await db.exec(`update auth.users set email_confirmed_at = now() where id = '${ADMIN}'`);
  await db.exec(`insert into admin_users (user_id, note) values ('${BETIAN}', 'por error')`);
  g = await grant();
  check('grant-admin.sql con hello@ confirmada -> SOLO hello@ es admin (Betian, si lo era, deja de serlo)', g === 'ok' && JSON.stringify(await admins()) === '["hello@motherverdeny.com"]', JSON.stringify(await admins()));
  check('…y queda en el registro de auditoría', (await q(`select count(*)::int c from admin_audit_log where action = 'admin_granted' and target_email = 'hello@motherverdeny.com'`))[0].c === 1);
  g = await grant();
  check('pegarlo dos veces no duplica nada', g === 'ok' && (await admins()).length === 1);
  // A freshly registered admin: 24 h trial over, no full access — the panel must still work.
  await db.exec(`update profiles set trial_ends_at = now() - interval '1 hour' where id = '${ADMIN}'`);
  check('admin con la prueba terminada NO tiene acceso completo (has_full_access = false)', await hfa(ADMIN) === false);
  check('…pero con MFA es admin y usa el panel (no depende de has_full_access)', (await as('authenticated', ADMIN, 'select is_admin_aal2() v', [], 'aal2')).rows?.[0]?.v === true && !(await as('authenticated', ADMIN, 'select * from admin_list_claims()', [], 'aal2')).error && !(await as('authenticated', ADMIN, 'select * from admin_list_gift_codes(10)', [], 'aal2')).error);
  check('Betian (berthalimo@gmail.com) con MFA NO es admin', (await as('authenticated', BETIAN, 'select is_admin_aal2() v', [], 'aal2')).rows?.[0]?.v === false);
  const isAdm = async (u, aal) => (await as('authenticated', u, 'select is_admin_aal2() v', [], aal)).rows?.[0]?.v;
  check('admin SIN MFA (aal1) -> no cuenta como admin', await isAdm(ADMIN, 'aal1') === false);
  check('admin CON MFA (aal2) -> admin', await isAdm(ADMIN, 'aal2') === true);
  check('cuenta normal con MFA (aal2) -> no admin', await isAdm(THIRD, 'aal2') === false);
  check('admin sin MFA NO lista avisos', err(await as('authenticated', ADMIN, `select * from admin_list_claims()`, [], 'aal1')).includes('not_allowed'));
  check('usuario normal NO lista avisos', err(await as('authenticated', THIRD, `select * from admin_list_claims()`, [], 'aal2')).includes('not_allowed'));
  check('admin con MFA SÍ lista avisos', !(await as('authenticated', ADMIN, `select * from admin_list_claims()`, [], 'aal2')).error);
  check('SQL Editor SÍ lista avisos', !(await as(null, null, `select * from admin_list_claims()`)).error);
  check('service_role (API) NO pasa por "SQL Editor"', err(await as('service_role', null, `select * from admin_list_claims()`)).includes('not_allowed'));

  console.log('11. Avisos de aporte con monto único:');
  const U1 = await newUser(1), UNCONF = await newUser(2, false);
  const create = (u, n) => as('authenticated', u, `select * from create_support_claim(${n})`);
  check('correo sin confirmar -> no puede pedir monto', err(await create(UNCONF, 1)).includes('email_not_confirmed'));
  check('supporter -> no necesita pedir monto', err(await create(MV, 1)).includes('already_supporter'));
  check('0 flores -> rechazado', err(await create(U1, 0)).includes('bad_flowers'));
  check('21 flores -> rechazado (máximo 20 = 200 USDC)', err(await create(U1, 21)).includes('bad_flowers'));
  check('la base rechaza flores > 20 aunque se escriba directo (restricción)', !!(await as(null, null, `insert into support_claims (user_id, flowers, amount_units, expires_at) values ('${U1}', 21, 210000100, now())`)).error);
  for (const [n, k] of [[1, 300], [10, 301], [11, 302], [20, 303]]) {
    const r = (await create(await newUser(k), n)).rows?.[0];
    const suf = r ? r.amount_units - n * 10000000 : -1;
    check(`${n} flor(es) -> ${n * 10},0001–${n * 10},0099 USDC, 4 decimales (${r ? (r.amount_units / 1e6).toFixed(4) : '—'})`, r && r.flowers === n && suf >= 100 && suf <= 9900 && suf % 100 === 0, JSON.stringify(r));
  }
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
  check('la 100.ª con el mismo número de flores -> error claro no_free_amount (nunca repite)', err(await create(await newUser(200), 3)).includes('no_free_amount'));
  check('…con 3 flores llenas, otra cantidad (4 flores) sigue funcionando', !!(await create(await newUser(201), 4)).rows?.[0]);
  for (let i = 0; i < 99; i++) { await create(await newUser(400 + i), 20); }
  check('20 flores: también 99 montos distintos (200,0001–200,0099) y la 100.ª -> no_free_amount', (await q(`select count(distinct amount_units)::int c from support_claims where flowers = 20 and status = 'awaiting_payment'`))[0].c === 99 && err(await create(await newUser(499), 20)).includes('no_free_amount'));
  check('ningún monto abierto se repite entre todas las cantidades de flores', (await q(`select count(*)::int a, count(distinct amount_units)::int b from support_claims where status in ('awaiting_payment','submitted','manual_review')`)).map((r) => r.a === r.b)[0]);
  // Two simultaneous requests: a test-only trigger takes the chosen amount for another person a
  // moment before the insert (as a competing request would). The function must notice, retry
  // with another amount and succeed; the trigger counts the attempts (sequences ignore rollbacks).
  const RX = await newUser(510), RY = await newUser(511);
  await db.exec(`create sequence test_race_seq;
    create function test_race() returns trigger language plpgsql as $t$ begin
      if new.user_id = '${RX}' then
        if nextval('test_race_seq') = 1 then
          insert into support_claims (user_id, flowers, amount_units, expires_at)
          values ('${RY}', new.flowers, new.amount_units, now() + interval '1 day');
        end if;
      end if;
      return new;
    end $t$;
    create trigger test_race before insert on support_claims for each row execute function test_race();`);
  const pa = await create(RX, 7);
  const tries = (await q('select last_value::int v from test_race_seq'))[0].v;
  await db.exec('drop trigger test_race on support_claims; drop function test_race(); drop sequence test_race_seq;');
  check('dos solicitudes a la vez con el mismo monto -> la función lo detecta, reintenta con otro y no falla', !!pa.rows?.[0] && tries === 2 && pa.rows[0].status === 'awaiting_payment', JSON.stringify({ pa, tries }));
  check('la base impide dos solicitudes abiertas con el mismo monto (índice único)', err(await as(null, null, `insert into support_claims (user_id, flowers, amount_units, expires_at) values ('${await newUser(512)}', 7, ${pa.rows[0].amount_units}, now() + interval '1 day')`)).includes('support_claims_amount_open'));
  // 98 of the 99 suffixes of 9 flowers taken: the next one gets exactly the last free one
  await db.exec(`insert into support_claims (user_id, flowers, amount_units, expires_at) select '${await newUser(513)}'::uuid, 9, 90000000 + s * 100, now() + interval '1 day' from generate_series(1, 1) s`);
  for (let i = 2; i <= 98; i++) await db.exec(`insert into support_claims (user_id, flowers, amount_units, expires_at) values ('${await newUser(600 + i)}', 9, ${90000000 + i * 100}, now() + interval '1 day')`);
  const last = (await create(await newUser(514), 9)).rows?.[0];
  check('con 98 de 99 montos de 9 flores ocupados -> recibe justo el que queda (90,0099)', last && last.amount_units === 90009900, JSON.stringify(last));
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
  check('admin sin MFA NO aprueba', err(await as('authenticated', ADMIN, `select * from admin_approve_claim(${c1b.id}, 'motivo largo')`, [], 'aal1')).includes('not_allowed'));
  check('aprobar sin motivo cuando la verificación falló -> exige motivo', err(await as('authenticated', ADMIN, `select * from admin_approve_claim(${c1b.id})`, [], 'aal2')).includes('reason_required'));
  await db.exec(`update profiles set trial_ends_at = now() - interval '1 hour' where id = '${U1}'`);
  check('antes de aprobar (prueba de 24 h ya vencida): sin acceso', await hfa(U1) === false);
  const ap = await as('authenticated', ADMIN, `select status from admin_approve_claim(${c1b.id}, 'Comprobado a mano en Basescan')`, [], 'aal2');
  check('admin con MFA aprueba con motivo -> approved', ap.rows?.[0]?.status === 'approved', JSON.stringify(ap));
  check('…y la cuenta pasa a supporter con acceso', await hfa(U1) === true && (await q(`select subscription_status s from profiles where id='${U1}'`))[0].s === 'supporter');
  check('…y queda en el registro de auditoría (quién, cuenta, motivo)', (await q(`select count(*)::int c from admin_audit_log where action='claim_approved' and target_user_id='${U1}' and actor_label='hello@motherverdeny.com' and reason like 'Comprobado%'`))[0].c === 1);
  check('rechazar exige motivo', err(await as(null, null, `select * from admin_reject_claim(${c3.id}, '')`)).includes('reason_required'));
  const U4 = await newUser(4); const c4 = (await create(U4, 1)).rows[0];
  await as('authenticated', U4, `select * from submit_support_claim_tx(${c4.id}, '0x${'ef'.repeat(32)}')`);
  await as('service_role', null, `select * from svc_record_claim_check(${c4.id}, '{"all_pass": true}'::jsonb, false, null)`);
  const auto = await as('service_role', null, `select status from svc_approve_claim(${c4.id}, null, 'auto-verify', 'all checks passed')`);
  check('verificación automática (service_role) aprueba cuando todo pasa', auto.rows?.[0]?.status === 'approved' && await hfa(U4) === true);
  { const cx = (await as('service_role', null, `select svc_claim_context(${c4.id}) v`)).rows?.[0]?.v; check('svc_claim_context: aviso + correo + idioma + ajustes (auto OFF por defecto)', cx?.email === 'u4@example.org' && cx.lang === 'es' && cx.auto_enabled === false && cx.min_confirmations === 30 && cx.auto_max_usdc === 201, JSON.stringify(cx)); }
  check('el navegador NO llama svc_claim_context', !!(await as('authenticated', U4, `select svc_claim_context(${c4.id})`)).error);
  check('cada persona ve solo sus solicitudes', (await cnt('authenticated', U1, 'select id, status from support_claims')) === 2 && (await cnt('authenticated', THIRD, 'select id, status from support_claims')) === 0);

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
  const send = (email) => as('service_role', null, `select svc_reserve_sent_gift_code(encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'), '${email}', 7, 7, '${ADMIN}', 'hello@motherverdeny.com') v`);
  const s1 = await send('amiga@example.org'); await send('Amiga@example.org'); await send('amiga@example.org');
  check('correo con formato inválido -> rechazado', err(await send('no-es-correo')).includes('bad_email'));
  { const dom = (await q('select domain from blocked_email_domains limit 1'))[0].domain; check('dominio desechable bloqueado (' + dom + ') -> rechazado', err(await send('x@' + dom)).includes('blocked_domain')); }
  check('3 códigos al mismo correo -> el 4.º se rechaza', err(await send('amiga@example.org')).includes('email_limit_3'));
  await as('service_role', null, `select svc_finish_sent_gift_code(${s1.rows[0].v}, false, 'SMTP 535', '${ADMIN}', 'hello@motherverdeny.com')`);
  check('si el correo falla, el código queda anulado y se registra', (await q(`select status, send_status from gift_codes where id=${s1.rows[0].v}`))[0].status === 'revoked' && (await q(`select count(*)::int c from admin_audit_log where action='gift_code_send_failed'`))[0].c === 1);
  check('el registro del envío no contiene el código', !(await q(`select details::text d from admin_audit_log where action like 'gift_code%'`)).some(r => /[A-Z2-9]{4}-[A-Z2-9]{4}/.test(r.d)));
  const today = (await q(`select count(*)::int c from gift_codes where created_at >= date_trunc('day', now())`))[0].c;
  for (let i = today; i < 20; i++) await send(`otro${i}@example.org`);
  check('21.º código del día -> rechazado (envío)', err(await send('nuevo@example.org')).includes('daily_limit_20'));
  check('21.º código del día -> rechazado (creación)', err(await as(null, null, `select * from admin_create_gift_codes(1)`)).includes('daily_limit_20'));
  check('el navegador NO llama svc_reserve_sent_gift_code', !!(await as('authenticated', ADMIN, `select svc_reserve_sent_gift_code('x','a@b.c',7,7,null,'x')`, [], 'aal2')).error);
  check('lista de códigos con estados (admin MFA)', (await as('authenticated', ADMIN, `select state from admin_list_gift_codes(500)`, [], 'aal2')).rows?.some(r => r.state === 'anulado'));

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
  check('auditoría legible por admin con MFA', (await as('authenticated', ADMIN, `select * from admin_list_audit(500)`, [], 'aal2')).rows?.length >= 4);
  check('auditoría NO legible por usuario normal ni editable', err(await as('authenticated', THIRD, `select * from admin_list_audit()`, [], 'aal2')).includes('not_allowed') && !!(await as('authenticated', ADMIN, `delete from admin_audit_log`, [], 'aal2')).error);
  check('auditoría registra quién, qué, cuenta y motivo', (await q(`select count(*)::int c from admin_audit_log where action='access_revoked' and target_email='u9@example.org' and reason like 'Fraude%' and actor_label='sql-editor'`))[0].c === 1);

  console.log('14. Reintentos de traducción (columnas):');
  check('publicaciones con contador de intentos (0) y estado gave_up permitido', !(await as(null, null, `update community_posts set translation_status='gave_up', translation_attempts=5 where id = (select id from community_posts limit 1)`)).error);
  check('estado inválido rechazado', !!(await as(null, null, `update community_posts set translation_status='xyz' where id = (select id from community_posts limit 1)`)).error);
  check('el navegador NO toca intentos ni estado de traducción', !!(await as('authenticated', MV, `update community_posts set translation_attempts=0 where user_id='${MV}'`)).error);
  await (await import('./test-part3.mjs')).run({ db, as, q, check, newUser, ADMIN });
}
