export type Lane = "stateless" | "memory";

export type MemoryKind = "fact" | "goal" | "preference" | "avoid" | "posted";

export interface Memory {
  id: string;
  kind: MemoryKind;
  text: string;
  evidence: string;
  sourceMessageId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Idea {
  id: string;
  title: string;
  hook: string;
  format: string;
  repeatOf?: { text: string; source: "suggested" | "posted"; similarity: number };
}

export interface HeldIdea extends Idea {
  matchedText: string;
  matchedSource: "suggested" | "posted" | "avoid";
  similarity: number;
}

export interface Flag {
  rule: string;
  match: string;
  index: number;
}

export interface VoiceReport {
  score: number;
  stylometric: number;
  judge: number | null;
  judgeReason: string | null;
  flags: Flag[];
  features: { name: string; creator: number; draft: number; unit: string }[];
}

export interface Draft {
  platform: string;
  text: string;
  report: VoiceReport;
  revisedFrom?: { text: string; report: VoiceReport };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  ideas?: Idea[];
  held?: HeldIdea[];
  draft?: Draft;
  memoryOps?: MemoryOp[];
  at: string;
}

export interface MemoryOp {
  op: "add" | "update" | "remove";
  id?: string;
  kind?: MemoryKind;
  text?: string;
  evidence?: string;
}

export interface LedgerEntry {
  id: string;
  text: string;
  source: "suggested" | "posted";
  vector: number[];
  at: string;
}

export interface LaneState {
  messages: ChatMessage[];
}

export interface AppState {
  lanes: Record<Lane, LaneState>;
  memories: Memory[];
  ledger: LedgerEntry[];
  // Baseline lane ideas, embedded only to measure its repeats. Never fed back into the baseline.
  shadow: LedgerEntry[];
  stats: { suggested: number; held: number; revised: number; baselineRepeats: number };
}
