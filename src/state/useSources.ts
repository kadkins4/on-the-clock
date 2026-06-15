import { useCallback, useState } from "react";
import { safeStorage } from "../lib/safeStorage";
import type {
  SourcesResponse,
  SourcesStore,
  SourcesMeta,
} from "../lib/sources/types";

const KEY = "otc:sources:v1";

interface Persisted {
  sources: SourcesStore;
  meta: SourcesMeta | null;
  fetchedAt: number;
}

function load(): Persisted {
  const raw = safeStorage.getItem(KEY);
  if (!raw) return { sources: {}, meta: null, fetchedAt: 0 };
  try {
    const p = JSON.parse(raw) as Persisted;
    return {
      sources: p.sources ?? {},
      meta: p.meta ?? null,
      fetchedAt: p.fetchedAt ?? 0,
    };
  } catch {
    return { sources: {}, meta: null, fetchedAt: 0 };
  }
}

// A persisted side store of third-party player data (Sleeper + FantasyCalc),
// kept out of the board/undo model. Lazily initialised from localStorage and
// refreshed on demand (see App's data refresh).
export function useSources() {
  const [state, setState] = useState<Persisted>(load);

  const setSources = useCallback((res: SourcesResponse) => {
    const next: Persisted = {
      sources: res.sources,
      meta: res.meta,
      fetchedAt: Date.now(),
    };
    setState(next);
    safeStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  return {
    sources: state.sources,
    sourcesMeta: state.meta,
    sourcesFetchedAt: state.fetchedAt,
    setSources,
  };
}
