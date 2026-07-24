import { describe, it, expect, vi } from "vitest";
import { createSpeaker } from "./speak";
import { createAudioCache, memoryStore } from "./cache";

function okAudio(): Response {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob(["mp3"]),
    text: async () => "",
  } as unknown as Response;
}

function notOk(status: number): Response {
  return {
    ok: false,
    status,
    blob: async () => new Blob([]),
    text: async () => "",
  } as unknown as Response;
}

function harness(
  fetchImpl: typeof fetch,
  opts: { cache?: ReturnType<typeof createAudioCache> } = {},
) {
  const played: Blob[] = [];
  const spoken: string[] = [];
  const player = {
    play: vi.fn((b: Blob) => {
      played.push(b);
      return Promise.resolve();
    }),
    stop: vi.fn(),
  };
  const voice = {
    speak: vi.fn((t: string) => {
      spoken.push(t);
      return Promise.resolve();
    }),
    cancel: vi.fn(),
  };
  const speaker = createSpeaker({
    fetchImpl,
    cache: opts.cache ?? createAudioCache(memoryStore()),
    player,
    voice,
  });
  return { speaker, player, voice, played, spoken };
}

describe("createSpeaker fallback chain", () => {
  it("plays a cache hit without calling the network", async () => {
    const cache = createAudioCache(memoryStore());
    const cached = new Blob(["cached"]);
    await cache.put("Hello.", cached);
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    const { speaker, played } = harness(fetchImpl, { cache });
    await speaker.speak("Hello.");

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(played).toEqual([cached]);
  });

  it("fetches, plays and caches on a miss", async () => {
    const cache = createAudioCache(memoryStore());
    const fetchImpl = vi.fn(async () => okAudio()) as unknown as typeof fetch;

    const { speaker, played } = harness(fetchImpl, { cache });
    await speaker.speak("Hello.");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(played).toHaveLength(1);
    expect(await cache.get("Hello.")).not.toBeNull();
  });

  it("posts the sentence to /api/tts", async () => {
    let url = "";
    let body = "";
    const fetchImpl = vi.fn(async (u: string, init: RequestInit) => {
      url = String(u);
      body = init.body as string;
      return okAudio();
    }) as unknown as typeof fetch;

    const { speaker } = harness(fetchImpl);
    await speaker.speak("Hello.");

    expect(url).toBe("/api/tts");
    expect(JSON.parse(body)).toEqual({ text: "Hello." });
  });

  it("falls back to the browser voice on 503 (the normal prod path)", async () => {
    const fetchImpl = vi.fn(async () => notOk(503)) as unknown as typeof fetch;
    const { speaker, spoken, played } = harness(fetchImpl);

    await speaker.speak("Hello.");

    expect(spoken).toEqual(["Hello."]);
    expect(played).toHaveLength(0);
  });

  it("falls back to the browser voice when the network throws", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const { speaker, spoken } = harness(fetchImpl);

    await speaker.speak("Hello.");
    expect(spoken).toEqual(["Hello."]);
  });

  it("does not cache a failed generation", async () => {
    const cache = createAudioCache(memoryStore());
    const fetchImpl = vi.fn(async () => notOk(502)) as unknown as typeof fetch;

    const { speaker } = harness(fetchImpl, { cache });
    await speaker.speak("Hello.");

    expect(await cache.get("Hello.")).toBeNull();
  });

  it("stays silent rather than throwing when there is no voice at all", async () => {
    const fetchImpl = vi.fn(async () => notOk(503)) as unknown as typeof fetch;
    const speaker = createSpeaker({
      fetchImpl,
      cache: createAudioCache(memoryStore()),
      player: { play: () => Promise.resolve(), stop: () => {} },
      voice: null,
    });
    await expect(speaker.speak("Hello.")).resolves.toBeUndefined();
  });

  it("cancel stops both the audio element and the browser voice", async () => {
    const fetchImpl = vi.fn(async () => okAudio()) as unknown as typeof fetch;
    const { speaker, player, voice } = harness(fetchImpl);

    speaker.cancel();

    expect(player.stop).toHaveBeenCalled();
    expect(voice.cancel).toHaveBeenCalled();
  });

  it("a cancelled announcement does not play late", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetchImpl = vi.fn(async () => {
      await gate;
      return okAudio();
    }) as unknown as typeof fetch;

    const { speaker, played } = harness(fetchImpl);
    const inFlight = speaker.speak("Stale.");
    speaker.cancel(); // newer pick arrived while this was generating
    release();
    await inFlight;

    expect(played).toHaveLength(0);
  });
});
