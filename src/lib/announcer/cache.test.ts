import { describe, it, expect } from "vitest";
import { createAudioCache, memoryStore } from "./cache";

describe("createAudioCache without IndexedDB", () => {
  // jsdom has no IndexedDB, and neither does private browsing in some
  // browsers. The announcer must stay audible either way — a missing cache
  // means "always regenerate", never "throw into the announce path".
  const cache = createAudioCache(undefined);

  it("returns null on get rather than throwing", async () => {
    await expect(cache.get("anything")).resolves.toBeNull();
  });

  it("swallows put rather than throwing", async () => {
    await expect(
      cache.put("anything", new Blob(["x"])),
    ).resolves.toBeUndefined();
  });
});

describe("audio cache round-trip", () => {
  it("returns what was stored, keyed by exact sentence", async () => {
    const cache = createAudioCache(memoryStore());
    const blob = new Blob(["audio"]);

    expect(await cache.get("With pick 1, quarterback Josh Allen.")).toBeNull();
    await cache.put("With pick 1, quarterback Josh Allen.", blob);
    expect(await cache.get("With pick 1, quarterback Josh Allen.")).toBe(blob);
  });

  it("treats a different sentence as a different entry", async () => {
    const cache = createAudioCache(memoryStore());
    await cache.put("With pick 1, quarterback Josh Allen.", new Blob(["a"]));
    expect(await cache.get("With pick 2, quarterback Josh Allen.")).toBeNull();
  });

  it("does not collide on whitespace-only differences", async () => {
    const cache = createAudioCache(memoryStore());
    await cache.put("Hello.", new Blob(["a"]));
    expect(await cache.get("Hello. ")).toBeNull();
  });

  it("evicts the oldest entry past the cap so it cannot grow forever", async () => {
    const cache = createAudioCache(memoryStore(), 2);
    await cache.put("one", new Blob(["1"]));
    await cache.put("two", new Blob(["2"]));
    await cache.put("three", new Blob(["3"]));

    expect(await cache.get("one")).toBeNull();
    expect(await cache.get("two")).not.toBeNull();
    expect(await cache.get("three")).not.toBeNull();
  });

  it("survives a store that throws — cache failure is never fatal", async () => {
    const broken = {
      get: () => Promise.reject(new Error("disk full")),
      put: () => Promise.reject(new Error("disk full")),
      keys: () => Promise.reject(new Error("disk full")),
      del: () => Promise.reject(new Error("disk full")),
    };
    const cache = createAudioCache(broken);
    await expect(cache.get("x")).resolves.toBeNull();
    await expect(cache.put("x", new Blob(["x"]))).resolves.toBeUndefined();
  });
});
