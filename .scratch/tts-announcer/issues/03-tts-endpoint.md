# T3 — /api/tts edge function + dev middleware

**Blocks:** T5 · **Blocked by:** nothing · **Est:** M

Copy the `api/adp.ts` shape exactly — it's the established convention.

`api/tts.ts`:
- `export const config = { runtime: "edge" }`
- Exported testable handler (`handleTts`) + default `Request -> Response`, same
  split as `handleAdp`
- Reads `ELEVENLABS_API_KEY` **unprefixed** (server-only per `.env.local.example`)
- **No key set -> 503.** The client treats this as "use the fallback voice",
  which is the normal prod path. Not an error condition.
- Plain `fetch` to ElevenLabs REST. **No SDK** — repo has 9 deps deliberately.
- Returns `audio/mpeg`

`vite.config.ts` — add `ttsDevApi()` plugin mirroring `adpDevApi()` so dev hits
a same-origin proxy.

`.env.local.example` — add `ELEVENLABS_API_KEY=` with a comment pointing at
elevenlabs.io and noting free tier is non-commercial.

TDD: inject `fetchImpl` and `env` like `handleAdp` does. Test the no-key 503,
a success path, and an upstream failure.
