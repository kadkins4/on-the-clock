// ElevenLabs text-to-speech proxy for the TV-mode draft announcer.
//
// Exists so the API key stays server-side: the browser posts a sentence here
// and gets audio back, never seeing the credential. Same shape as api/adp.ts —
// a testable handler with injected fetch/env, plus a thin default export for
// the edge runtime, and a dev-only mirror wired up in vite.config.ts.

export const config = { runtime: "edge" };

// The model the credit math assumes: 1 character = 1 credit on the free tier
// (verified against elevenlabs.io/pricing). Changing this changes the budget.
const MODEL_ID = "eleven_multilingual_v2";

// A default premade voice (Daniel). Verified working on a free-tier key;
// most catalogue voices are NOT — the API answers 402 paid_plan_required with
// "Free users cannot use library voices via the API". If you change this,
// re-check it against a free key or the announcer silently falls back to the
// browser voice in dev. Overridable via ELEVENLABS_VOICE_ID.
const DEFAULT_VOICE_ID = "onwK4e9ZLuTAKqWW03F9";

export interface TtsParams {
  text: string;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleTts(
  { text }: TtsParams,
  fetchImpl: typeof fetch = fetch,
  env: Record<string, string | undefined> = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env ?? {},
): Promise<Response> {
  const key = env.ELEVENLABS_API_KEY;

  // No key is the normal production path, not a failure: the deployed site
  // ships without one so visitors can't spend Kenny's credits. The client
  // reads 503 as "use the browser's speechSynthesis voice instead".
  if (!key) return json({ error: "tts unconfigured" }, 503);

  if (!text?.trim()) return json({ error: "empty text" }, 400);

  const voiceId = env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;

  try {
    const upstream = await fetchImpl(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key, // header, never the URL — URLs get logged
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({ text, model_id: MODEL_ID }),
      },
    );

    if (!upstream.ok) {
      return json(
        { error: `elevenlabs ${upstream.status}: ${await upstream.text()}` },
        502,
      );
    }

    return new Response(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        // Announcements repeat heavily across mocks; let the browser keep them.
        "cache-control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }
}

async function readText(req: Request): Promise<string | null> {
  if (req.method !== "POST") {
    return new URL(req.url).searchParams.get("text") ?? "";
  }
  try {
    const { text } = (await req.json()) as TtsParams;
    return text;
  } catch {
    return null; // malformed body
  }
}

export default async function (req: Request): Promise<Response> {
  const text = await readText(req);
  if (text === null) return json({ error: "bad json" }, 400);
  return handleTts({ text });
}
