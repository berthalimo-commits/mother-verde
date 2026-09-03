# community-translate

Translates one post/comment body into all four platform languages (es, en, de, fr)
at publish time, using **Azure AI Translator**. Called by `src/mvCommunity.js`
(`createPost`, `updatePost`, `addComment`) via `supabase.functions.invoke`.

## Contract

```
POST  (Authorization: Bearer <supabase user jwt>)
body: { "text": "...", "sourceHint": "es" | "en" | "de" | "fr" }

200 → { "source_lang": "es", "body_i18n": { es, en, de, fr }, "status": "done" | "skipped" }
502 → { "error": "translation provider unavailable" }   // client publishes original-only, backfill later
```

- `sourceHint` is the author's UI language; Azure's own detection overrides it
  when it lands on a platform language.
- Text that is only emoji / punctuation / links (< 3 letters or digits) is
  returned untranslated with `status: "skipped"` — no API call.
- Repeated text is served from the `translation_cache` table.

## One-time setup (after the Azure resource exists)

```bash
supabase secrets set \
  AZURE_TRANSLATOR_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  AZURE_TRANSLATOR_REGION=eastus
# optional, defaults to the global endpoint:
# supabase secrets set AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com

supabase functions deploy community-translate
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
by the platform — do not set them.

## Backfill failed rows

Rows published while Azure was unavailable have `translation_status = 'failed'`
and appear in the `community_translation_backlog` view. Re-run them by calling
this function again with their `body` + `source_lang` and writing `body_i18n`
back. Wire a `pg_cron` + `pg_net` job once the function URL and service key are
in Vault (kept out of the migration on purpose).
