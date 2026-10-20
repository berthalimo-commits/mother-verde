// A small PostgREST + GoTrue imitation on top of PGlite, enough for
// supabase-js calls used by our Edge Functions and the Vercel cron.
// Tokens: 'svc' = service_role, 'anon' = anon, 'u:<uid>:<aal>' = signed-in user.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

export const REPO = new URL('../../supabase/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

export async function makeDb() {
  const db = new PGlite();
  await db.exec(fs.readFileSync(new URL('./shim.sql', import.meta.url), 'utf8'));
  for (const f of fs.readdirSync(path.join(REPO, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) await db.exec(read('migrations/' + f));
  for (const p of fs.readdirSync(path.join(REPO, 'seed-blocked-email-domains')).sort()) await db.exec(read('seed-blocked-email-domains/' + p));
  return db;
}

const J = (d, st = 200, h = {}) => new Response(d === undefined ? null : JSON.stringify(d, (k, v) => (typeof v === 'bigint' ? Number(v) : v)), { status: st, headers: { 'content-type': 'application/json', ...h } });

function who(token) {
  if (token === 'svc') return { role: 'service_role' };
  if (!token || token === 'anon') return { role: 'anon' };
  const [k, uid, aal] = token.split(':');
  if (k !== 'u') return null;
  return { role: 'authenticated', uid, aal: aal || 'aal1' };
}

export function makeRest(db) {
  let queue = Promise.resolve();
  const lock = (fn) => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };
  async function run(w, sql, params) {
    const claims = JSON.stringify({ role: w.role, ...(w.uid ? { sub: w.uid, aal: w.aal } : {}) });
    await db.exec(`reset role; select set_config('request.jwt.claims', '${claims.replace(/'/g, "''")}', false); set role ${w.role};`);
    try { return await db.query(sql, params); } finally { await db.exec('reset role;'); }
  }
  const pgArray = (arr) => '{' + arr.map((x) => '"' + x.replace(/["\\]/g, (c) => '\\' + c) + '"').join(',') + '}';
  const val = (v) => (v === null || v === undefined ? null
    : Array.isArray(v) && v.every((x) => typeof x === 'string') ? pgArray(v)
    : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('bad ident ' + s); return '"' + s + '"'; };

  function where(u, params) {
    const conds = [];
    for (const [k, raw] of u.searchParams) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      const i = raw.indexOf('.'); const op = raw.slice(0, i); const v = raw.slice(i + 1);
      const ops = { eq: '=', neq: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=' };
      if (ops[op]) { params.push(v); conds.push(`${ident(k)} ${ops[op]} $${params.length}`); }
      else if (op === 'is') conds.push(`${ident(k)} is ${v === 'null' ? 'null' : v === 'true' ? 'true' : 'false'}`);
      else if (op === 'in') {
        const items = v.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));
        conds.push(`${ident(k)} in (${items.map((x) => { params.push(x); return '$' + params.length; }).join(',')})`);
      } else throw new Error('op ' + op);
    }
    return conds.length ? ' where ' + conds.join(' and ') : '';
  }
  const cols = (u) => { const s = u.searchParams.get('select'); return !s || s === '*' ? '*' : s.split(',').map((c) => ident(c.trim())).join(','); };

  async function handle(url, init) {
    const u = new URL(url); const m = (init.method || 'GET').toUpperCase();
    const hdr = new Headers(init.headers || {});
    const token = (hdr.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const w = who(token);
    if (u.pathname === '/auth/v1/user') {
      if (!w || !w.uid) return J({ msg: 'invalid JWT' }, 401);
      const r = await db.query('select id, email from auth.users where id = $1', [w.uid]);
      return r.rows[0] ? J({ id: r.rows[0].id, email: r.rows[0].email, aud: 'authenticated', role: 'authenticated' }) : J({ msg: 'user not found' }, 401);
    }
    // Password sign-in like GoTrue: password first, then "confirmed?".
    // Only for accounts whose password is known (globalThis.__pw).
    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'password' && globalThis.__pw) {
      const b = JSON.parse(init.body || '{}');
      (globalThis.__tokenCalls ||= []).push(b);
      const row = (await handle.q('select id, email, email_confirmed_at from auth.users where lower(email) = lower($1)', [b.email])).rows[0];
      if (!row || globalThis.__pw[row.id] !== b.password) return J({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
      if (!row.email_confirmed_at) return J({ code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' }, 400);
      return J({ access_token: `u:${row.id}:aal1`, token_type: 'bearer', expires_in: 3600, refresh_token: 'r', user: { id: row.id, email: row.email } });
    }
    if (u.pathname.startsWith('/auth/v1/logout')) { globalThis.__logouts = (globalThis.__logouts || 0) + 1; return new Response(null, { status: 204 }); }
    if (/^\/auth\/v1\/admin\/users\/[^/]+$/.test(u.pathname) && m === 'PUT') {
      if (w?.role !== 'service_role') return J({ msg: 'not admin' }, 403);
      const b = JSON.parse(init.body || '{}');
      const id = u.pathname.split('/').pop();
      if (globalThis.__adminUpdateFail) return J({ msg: 'boom' }, 500);
      const r = await handle.q('update auth.users set email = coalesce($2, email) where id = $1 returning id, email', [id, b.email ?? null]);
      return r.rows[0] ? J({ id, email: r.rows[0].email }) : J({ msg: 'User not found' }, 404);
    }
    if (!w) return J({ message: 'JWSError' }, 401);
    const body = init.body ? JSON.parse(init.body) : undefined;
    const wantsOne = (hdr.get('accept') || '').includes('vnd.pgrst.object');
    const repr = (hdr.get('prefer') || '').includes('return=representation');
    try {
      if (u.pathname.startsWith('/rest/v1/rpc/')) {
        const fn = u.pathname.slice('/rest/v1/rpc/'.length);
        const info = (await db.query(`select p.proretset, t.typtype, t.typname from pg_proc p join pg_type t on t.oid = p.prorettype join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`, [fn])).rows[0];
        if (!info) return J({ message: `Could not find the function public.${fn}`, code: 'PGRST202' }, 404);
        const args = Object.entries(body || {}); const params = args.map(([, v]) => val(v));
        const call = `public.${ident(fn)}(${args.map(([k], i) => `${ident(k)} => $${i + 1}`).join(', ')})`;
        if (info.proretset || info.typtype === 'c') {
          const r = await lock(() => run(w, `select * from ${call}`, params));
          if (info.proretset) return J(r.rows);
          return J(r.rows[0] && Object.values(r.rows[0]).every((x) => x === null) ? null : r.rows[0] ?? null);
        }
        const r = await lock(() => run(w, `select ${call} as v`, params));
        return info.typname === 'void' ? new Response(null, { status: 204 }) : J(r.rows[0].v);
      }
      const table = ident(u.pathname.replace('/rest/v1/', ''));
      const params = [];
      if (m === 'GET') {
        let sql = `select ${cols(u)} from public.${table}` + where(u, params);
        const ord = u.searchParams.get('order');
        if (ord) sql += ' order by ' + ord.split(',').map((o) => { const [c, d] = o.split('.'); return `${ident(c)} ${d === 'desc' ? 'desc' : 'asc'}`; }).join(',');
        if (u.searchParams.get('limit')) sql += ' limit ' + Number(u.searchParams.get('limit'));
        const r = await lock(() => run(w, sql, params));
        if (wantsOne) return r.rows.length === 1 ? J(r.rows[0]) : J({ code: 'PGRST116', message: `${r.rows.length} rows` }, 406);
        return J(r.rows);
      }
      if (m === 'POST') {
        const rows = Array.isArray(body) ? body : [body];
        const keys = Object.keys(rows[0]);
        const values = rows.map((row) => '(' + keys.map((k) => { params.push(val(row[k])); return '$' + params.length; }).join(',') + ')').join(',');
        let sql = `insert into public.${table} (${keys.map(ident).join(',')}) values ${values}`;
        if ((hdr.get('prefer') || '').includes('resolution=merge-duplicates')) {
          const pk = u.searchParams.get('on_conflict')?.split(',') ?? (await db.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = ('public.' || $1)::regclass and i.indisprimary`, [table.replace(/"/g, '')])).rows.map((r) => r.attname);
          sql += ` on conflict (${pk.map(ident).join(',')}) do update set ` + keys.filter((k) => !pk.includes(k)).map((k) => `${ident(k)} = excluded.${ident(k)}`).join(',');
        }
        if (repr) sql += ` returning ${cols(u)}`;
        const r = await lock(() => run(w, sql, params));
        if (!repr) return new Response(null, { status: 201 });
        return wantsOne ? J(r.rows[0]) : J(r.rows, 201);
      }
      if (m === 'PATCH' || m === 'DELETE') {
        let sql;
        if (m === 'PATCH') {
          const sets = Object.entries(body).map(([k, v]) => { params.push(val(v)); return `${ident(k)} = $${params.length}`; });
          sql = `update public.${table} set ${sets.join(',')}` + where(u, params);
        } else sql = `delete from public.${table}` + where(u, params);
        if (repr) sql += ` returning ${cols(u)}`;
        const r = await lock(() => run(w, sql, params));
        return repr ? J(r.rows) : new Response(null, { status: 204 });
      }
      return J({ message: 'method' }, 405);
    } catch (e) {
      return J({ message: e.message, code: e.code || 'P0001' }, 400);
    }
  }
  // Direct queries as superuser, queued with the role-switching ones.
  handle.q = (sql, params) => lock(() => db.query(sql, params));
  return handle;
}
