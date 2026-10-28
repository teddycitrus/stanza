import { callTool, FAST_MODEL } from "./llm";
import { uid } from "./store";
import type { AppState, Memory, MemoryKind, MemoryOp } from "./types";

const KINDS: MemoryKind[] = ["fact", "goal", "preference", "avoid", "posted"];

const SYSTEM = `You maintain long-term memory for Stanley, an AI Head of Content, about one creator.
Read the creator's latest message (with Stanley's previous reply for context) and emit memory operations.

Kinds:
- fact: durable facts about the creator or business (schedule, product, launch date, audience).
- goal: what they are trying to achieve, with numbers or dates if given.
- preference: how they want Stanley to work or write (tone, format, length, "just ideas, no full scripts").
- avoid: topics, angles or formats they do NOT want suggested again. Phrase as the topic to avoid plus why.
- posted: an idea or post they say they already published. Include enough to recognise it later.

Rules:
- Only store what the creator states or clearly confirms. Never store Stanley's suggestions as facts.
- Prefer "update" over "add" when a new statement refines or contradicts an existing memory. Use "remove" when they retract something.
- evidence must be a short verbatim quote from the creator's message.
- Small talk and requests ("give me ideas") produce no operations. Return an empty list when nothing is worth remembering.`;

export async function extract(state: AppState, userText: string, prevAssistant?: string): Promise<MemoryOp[]> {
  const existing = state.memories.map((m) => `${m.id} [${m.kind}] ${m.text}`).join("\n") || "(none)";
  const { ops } = await callTool<{ ops: MemoryOp[] }>({
    model: FAST_MODEL,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Existing memories:\n${existing}\n\nStanley's previous reply:\n${prevAssistant ?? "(none)"}\n\nCreator's latest message:\n${userText}`,
      },
    ],
    tool: {
      name: "memory_ops",
      description: "Apply memory operations.",
      schema: {
        type: "object",
        properties: {
          ops: {
            type: "array",
            items: {
              type: "object",
              properties: {
                op: { type: "string", enum: ["add", "update", "remove"] },
                id: { type: "string", description: "Existing memory id, for update/remove." },
                kind: { type: "string", enum: KINDS },
                text: { type: "string" },
                evidence: { type: "string" },
              },
              required: ["op"],
            },
          },
        },
        required: ["ops"],
      },
    },
    maxTokens: 800,
  });
  return ops ?? [];
}

export function apply(state: AppState, ops: MemoryOp[], sourceMessageId: string): MemoryOp[] {
  const now = new Date().toISOString();
  const applied: MemoryOp[] = [];
  for (const op of ops) {
    if (op.op === "add" && op.kind && op.text) {
      const id = uid("mem");
      state.memories.push({ id, kind: op.kind, text: op.text, evidence: op.evidence ?? "", sourceMessageId, createdAt: now, updatedAt: now });
      applied.push({ ...op, id });
    } else if (op.op === "update" && op.id) {
      const m = state.memories.find((x) => x.id === op.id);
      if (!m) continue;
      Object.assign(m, { text: op.text ?? m.text, kind: op.kind ?? m.kind, evidence: op.evidence ?? m.evidence, sourceMessageId, updatedAt: now });
      applied.push(op);
    } else if (op.op === "remove" && op.id) {
      const before = state.memories.length;
      state.memories = state.memories.filter((x) => x.id !== op.id);
      if (state.memories.length < before) applied.push(op);
    }
  }
  return applied;
}

const LABEL: Record<MemoryKind, string> = {
  fact: "Facts",
  goal: "Goals",
  preference: "How they want you to work",
  avoid: "Never suggest (they asked you to stop)",
  posted: "Already posted (do not re-pitch)",
};

export function render(memories: Memory[]): string {
  if (memories.length === 0) return "No memories yet.";
  return KINDS.filter((k) => memories.some((m) => m.kind === k))
    .map((k) => `${LABEL[k]}:\n${memories.filter((m) => m.kind === k).map((m) => `- ${m.text}`).join("\n")}`)
    .join("\n\n");
}
