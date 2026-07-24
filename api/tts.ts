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

// Stock voice, overridable via ELEVENLABS_VOICE_ID once a real key exists and
// the voice can actually be auditioned.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

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

export default async function (req: Request): Promise<Response> {
  let text = "";
  if (req.method === "POST") {
    try {
      ({ text } = (await req.json()) as TtsParams);
    } catch {
      return json({ error: "bad json" }, 400);
    }
  } else {
    text = new URL(req.url).searchParams.get("text") ?? "";
  }
  return handleTts({ text });
}
