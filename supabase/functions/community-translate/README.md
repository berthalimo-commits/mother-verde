# community-translate

Translates one post/comment body into all four platform languages (es, en, de, fr)
at publish time, using **DeepL API**. Called by `src/mvCommunity.js`
(`createPost`, `updatePost`, `addComment`) via `supabase.functions.invoke`.

## Contract

```
POST  (Authorization: Bearer <supabase user jwt>)
body: { "text": "...", "sourceHint": "es" | "en" | "de" | "fr" }

200 → { "source_lang": "es", "body_i18n": { es, en, de, fr }, "status": "done" | "skipped" }
502 → { "error": "translation provider unavailable" }   // client publishes original-only, backfill later
```

- `sourceHint` is the author's UI language; DeepL's own detection overrides it
  when it lands on a platform language.
- Text that is only emoji / punctuation / links (< 3 letters or digits) is
  returned untranslated with `status: "skipped"` — no API call.
- Repeated text is served from the `translation_cache` table.
- English is requested from DeepL as `EN-US` (DeepL requires a regional variant
  for English as a *target* language); the platform still stores/serves it as `en`.

## One-time setup (after the DeepL account exists)

Get an API key from DeepL (Account → API Keys). Free-tier keys end in `:fx` and
are routed to the free endpoint automatically — no separate endpoint secret needed.

```bash
supabase secrets set DEEPL_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx:fx

supabase functions deploy community-translate
```

No CLI/browser login is available in this environment, so in practice: set the
secret via the Supabase dashboard (Edge Functions → Secrets), then paste
`index.ts` into the dashboard's function editor for `community-translate`.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
by the platform — do not set them.

## Backfill failed rows

Rows published while DeepL was unavailable (or the monthly free-tier quota was
exhausted) have `translation_status = 'failed'` and appear in the
`community_translation_backlog` view. Re-run them by calling this function again
with their `body` + `source_lang` and writing `body_i18n` back. Wire a `pg_cron`
+ `pg_net` job once the function URL and service key are in Vault (kept out of
the migration on purpose).
