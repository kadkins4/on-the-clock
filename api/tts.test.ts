import { describe, it, expect } from "vitest";
import { handleTts } from "./tts";

function audioResponse(bytes = [1, 2, 3]): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
    text: async () => "",
  } as unknown as Response;
}

function errorResponse(status: number, body = "nope"): Response {
  return {
    ok: false,
    status,
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => body,
  } as unknown as Response;
}

const KEY = { ELEVENLABS_API_KEY: "sk-test" };

describe("handleTts", () => {
  it("503s when no API key is configured", async () => {
    const called: string[] = [];
    const fakeFetch = (async (url: string) => {
      called.push(String(url));
      return audioResponse();
    }) as unknown as typeof fetch;

    const res = await handleTts(
      { text: "With pick 1, quarterback Josh Allen." },
      fakeFetch,
      {},
    );

    // 503 is the NORMAL production path — prod ships without the key and the
    // client falls back to speechSynthesis. Not an error condition.
    expect(res.status).toBe(503);
    expect(called).toEqual([]); // never reaches ElevenLabs
  });

  it("400s on empty text rather than burning a credit", async () => {
    const fakeFetch = (async () => audioResponse()) as unknown as typeof fetch;
    const res = await handleTts({ text: "   " }, fakeFetch, KEY);
    expect(res.status).toBe(400);
  });

  it("returns audio/mpeg on success", async () => {
    const fakeFetch = (async () =>
      audioResponse([9, 9, 9])) as unknown as typeof fetch;
    const res = await handleTts({ text: "Hello." }, fakeFetch, KEY);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
  });

  it("sends the key as a header and never in the URL", async () => {
    let seenUrl = "";
    let seenInit: RequestInit | undefined;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      seenUrl = String(url);
      seenInit = init;
      return audioResponse();
    }) as unknown as typeof fetch;

    await handleTts({ text: "Hello." }, fakeFetch, KEY);

    expect(seenUrl).not.toContain("sk-test");
    const headers = seenInit?.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe("sk-test");
  });

  it("requests the model the credit math assumes (1 char = 1 credit)", async () => {
    let body: Record<string, unknown> = {};
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return audioResponse();
    }) as unknown as typeof fetch;

    await handleTts({ text: "Hello." }, fakeFetch, KEY);
    expect(body.model_id).toBe("eleven_multilingual_v2");
    expect(body.text).toBe("Hello.");
  });

  it("honors an overridden voice id from env", async () => {
    let seenUrl = "";
    const fakeFetch = (async (url: string) => {
      seenUrl = String(url);
      return audioResponse();
    }) as unknown as typeof fetch;

    await handleTts({ text: "Hello." }, fakeFetch, {
      ...KEY,
      ELEVENLABS_VOICE_ID: "custom-voice",
    });
    expect(seenUrl).toContain("custom-voice");
  });

  it("502s when ElevenLabs rejects the request", async () => {
    const fakeFetch = (async () =>
      errorResponse(401)) as unknown as typeof fetch;
    const res = await handleTts({ text: "Hello." }, fakeFetch, KEY);
    expect(res.status).toBe(502);
  });

  it("502s rather than throwing when the network fails", async () => {
    const fakeFetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const res = await handleTts({ text: "Hello." }, fakeFetch, KEY);
    expect(res.status).toBe(502);
  });
});
