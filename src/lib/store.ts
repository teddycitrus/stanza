import { promises as fs } from "fs";
import path from "path";
import type { AppState } from "./types";

// JSON file store. Swappable for Postgres + pgvector; the agent only sees AppState.
const FILE = path.join(process.cwd(), ".data", "state.json");

export function emptyState(): AppState {
  return {
    lanes: { stateless: { messages: [] }, memory: { messages: [] } },
    memories: [],
    ledger: [],
    shadow: [],
    stats: { suggested: 0, held: 0, revised: 0, baselineRepeats: 0 },
  };
}

export async function load(): Promise<AppState> {
  try {
    const base = emptyState();
    const s = JSON.parse(await fs.readFile(FILE, "utf8")) as Partial<AppState>;
    return { ...base, ...s, stats: { ...base.stats, ...s.stats } };
  } catch {
    return emptyState();
  }
}

export async function save(state: AppState): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(state));
}

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
