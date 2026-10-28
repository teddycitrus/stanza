import { hasKey } from "./llm";
import { creator, lastPostDate, posts } from "./seed";
import { load, save } from "./store";
import type { AppState } from "./types";

let queue: Promise<unknown> = Promise.resolve();

// Serialises read-modify-write cycles on the state file.
export function withState<T>(fn: (s: AppState) => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const s = await load();
    const out = await fn(s);
    await save(s);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

export function publicState(s: AppState) {
  return {
    hasKey: hasKey(),
    creator,
    synced: { posts: posts.length, lastPost: lastPostDate() },
    lanes: s.lanes,
    memories: s.memories,
    ledger: s.ledger.map(({ vector: _v, ...rest }) => rest),
    stats: s.stats,
  };
}

export type PublicState = ReturnType<typeof publicState>;
