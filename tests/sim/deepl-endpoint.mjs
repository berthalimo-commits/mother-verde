// B.4 — DeepL: every function that translates picks the right address from
// the key, using the real code of each function (extracted from its index.ts):
// a Free key (ends in ":fx") → api-free.deepl.com, a Pro key → api.deepl.com.
// The key is read only from the secret DEEPL_API_KEY and sent as
// "DeepL-Auth-Key …"; no key is written anywhere in the code.
import fs from 'fs';

const APP = new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
let pass = 0, fail = 0; const failures = [];
const check = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ', n); } else { fail++; failures.push(n); console.log('  FALLA', n, d); } };
const FNS = ['community-translate', 'community-publish-post', 'community-publish-comment', 'community-retranslate'];
const FREE = 'abcdef12-3456-7890-abcd-ef1234567890:fx', PRO = 'abcdef12-3456-7890-abcd-ef1234567890';

for (const name of FNS) {
  const src = fs.readFileSync(`${APP}/supabase/functions/${name}/index.ts`, 'utf8');
  // the selection as written in the function (TypeScript types removed)
  let pick;
  const fnDef = src.match(/function deeplEndpoint\(key: string\): string \{[\s\S]*?\n\}/);
  if (fnDef) pick = new Function(`${fnDef[0].replace('(key: string): string', '(key)')}; return deeplEndpoint;`)();
  else {
    const expr = src.match(/const endpoint = (key\.endsWith\(":fx"\) \? "[^"]+" : "[^"]+");/);
    pick = expr ? new Function('key', `return ${expr[1]};`) : null;
  }
  check(`${name}: tiene la regla de dirección`, typeof pick === 'function');
  if (!pick) continue;
  check(`${name}: clave gratuita (…:fx) → https://api-free.deepl.com/v2/translate`, pick(FREE) === 'https://api-free.deepl.com/v2/translate', pick(FREE));
  check(`${name}: clave Pro → https://api.deepl.com/v2/translate`, pick(PRO) === 'https://api.deepl.com/v2/translate', pick(PRO));
  check(`${name}: la clave sale solo del secreto DEEPL_API_KEY y va como «DeepL-Auth-Key»`, /Deno\.env\.get\("DEEPL_API_KEY"\)/.test(src) && /DeepL-Auth-Key \$\{/.test(src)
    && !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(:fx)?/i.test(src));
}

console.log(`\nRESULTADO: ${pass} ok, ${fail} fallas${fail ? ' -> ' + failures.join(' | ') : ''}`);
process.exit(0);
