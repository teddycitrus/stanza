import { callTool, CHAT_MODEL, type Turn } from "./llm";
import * as memory from "./memory";
import { guard, ideaText, shadowCheck } from "./novelty";
import { creator, engagement, lastPostDate, posts } from "./seed";
import { uid } from "./store";
import type { AppState, ChatMessage, Draft, Idea, Lane } from "./types";
import { scoreDraft, VOICE_THRESHOLD } from "./voice";

export const WINDOW = 4;
export const PROMPT_VERSION = "v2-memory";

interface Respond {
  reply: string;
  intent: "chat" | "ideas" | "draft";
  ideas?: Omit<Idea, "id">[];
  draft?: { platform: string; text: string };
}

const exemplars = [...posts].sort((a, b) => engagement(b) - engagement(a)).slice(0, 6);

function system(lane: Lane, state: AppState, ideaCount: number): string {
  const today = new Date().toISOString().slice(0, 10);
  const base = `You are Stanley, an AI Head of Content, working 1:1 with ${creator.name} (${creator.handle}).
${creator.bio}
Platforms: ${creator.platforms.join(", ")}. Sells "${creator.storeProduct.name}", ${creator.storeProduct.kind}, $${creator.storeProduct.price}.

Synced data (source of truth, do not contradict): today is ${today}; her last published post was ${lastPostDate()}; ${posts.length} posts synced.

Her best-performing posts, for voice:
${exemplars.map((p) => `--- ${p.platform} ${p.format}, ${p.date}\n${p.text}`).join("\n")}

How to respond:
- Keep "reply" short and conversational, like a sharp strategist texting her.
- intent "ideas": return exactly ${ideaCount} distinct post ideas (title, one-line hook, format). Each must be a genuinely different angle.
- intent "draft": write the full post in her voice: short lines, plain words, concrete nurse details, no hashtags, no emoji, no em dashes, no corporate cadence. Put it in draft.text.
- intent "chat": everything else.`;

  if (lane === "stateless") return base;

  const recent = state.ledger.slice(-30).map((l) => `- ${l.text}`).join("\n") || "(none yet)";
  return `${base}

Long-term memory about ${creator.name} (persisted across sessions, authoritative over your assumptions):
${memory.render(state.memories)}

Ideas you already pitched her (never re-pitch these or close variants):
${recent}`;
}

const RESPOND_TOOL = {
  name: "respond",
  description: "Reply to the creator.",
  schema: {
    type: "object",
    properties: {
      reply: { type: "string" },
      intent: { type: "string", enum: ["chat", "ideas", "draft"] },
      ideas: {
        type: "array",
        items: {
          type: "object",
          properties: { title: { type: "string" }, hook: { type: "string" }, format: { type: "string" } },
          required: ["title", "hook", "format"],
        },
      },
      draft: { type: "object", properties: { platform: { type: "string" }, text: { type: "string" } }, required: ["platform", "text"] },
    },
    required: ["reply", "intent"],
  },
};

function windowTurns(messages: ChatMessage[]): Turn[] {
  return messages.slice(-WINDOW).map((m) => ({
    role: m.role,
    content:
      m.text +
      (m.ideas?.length ? `\n\nIdeas:\n${m.ideas.map((i) => `- ${ideaText(i)}`).join("\n")}` : "") +
      (m.draft ? `\n\nDraft:\n${m.draft.text}` : ""),
  }));
}

async function generate(lane: Lane, state: AppState, history: ChatMessage[], userText: string, ideaCount: number, extra = ""): Promise<Respond> {
  return callTool<Respond>({
    model: CHAT_MODEL,
    system: system(lane, state, ideaCount) + extra,
    messages: [...windowTurns(history), { role: "user", content: userText }],
    tool: RESPOND_TOOL,
    maxTokens: 2500,
  });
}

async function revise(state: AppState, draft: Draft): Promise<Draft> {
  const r = draft.report;
  const issues = [
    ...r.flags.map((f) => `- remove "${f.match}" (${f.rule})`),
    ...r.features.filter((f) => Math.abs(f.draft - f.creator) > Math.max(2, f.creator * 0.5)).map((f) => `- ${f.name}: hers is ~${f.creator}${f.unit}, yours is ${f.draft}${f.unit}`),
    ...(r.judgeReason ? [`- judge: ${r.judgeReason}`] : []),
  ].join("\n");
  const out = await callTool<Respond>({
    model: CHAT_MODEL,
    system: system("memory", state, 0),
    messages: [{ role: "user", content: `Rewrite this ${draft.platform} draft so it sounds exactly like her. Keep the idea. Fix:\n${issues}\n\nDraft:\n${draft.text}` }],
    tool: RESPOND_TOOL,
    maxTokens: 1500,
  });
  const text = out.draft?.text ?? draft.text;
  const report = await scoreDraft(text);
  return report.score > r.score ? { platform: draft.platform, text, report, revisedFrom: { text: draft.text, report: r } } : draft;
}

export async function runTurn(state: AppState, lane: Lane, userText: string): Promise<ChatMessage> {
  const msgs = state.lanes[lane].messages;
  const history = [...msgs];
  const userMsg: ChatMessage = { id: uid("msg"), role: "user", text: userText, at: new Date().toISOString() };
  msgs.push(userMsg);

  if (lane === "memory") {
    const prev = [...history].reverse().find((m) => m.role === "assistant");
    const ops = memory.apply(state, await memory.extract(state, userText, prev?.text), userMsg.id);
    if (ops.length) userMsg.memoryOps = ops;
  }

  const ideaCount = lane === "memory" ? 8 : 5;
  let res = await generate(lane, state, history, userText, ideaCount);
  const out: ChatMessage = { id: uid("msg"), role: "assistant", text: res.reply, at: new Date().toISOString() };

  if (res.intent === "ideas" && res.ideas?.length) {
    const candidates = res.ideas.map((i) => ({ ...i, id: uid("idea") }));
    if (lane === "stateless") {
      out.ideas = candidates.slice(0, 5);
      await shadowCheck(state, out.ideas);
    } else {
      let g = await guard(state, candidates);
      if (g.kept.length < 3) {
        const avoid = g.held.map((h) => `- ${ideaText(h)}`).join("\n");
        res = await generate(lane, state, history, userText, ideaCount, `\n\nThese were rejected as repeats, go somewhere new:\n${avoid}`);
        const more = await guard(state, (res.ideas ?? []).map((i) => ({ ...i, id: uid("idea") })), 5 - g.kept.length);
        g = { kept: [...g.kept, ...more.kept], held: [...g.held, ...more.held] };
      }
      out.ideas = g.kept;
      out.held = g.held;
    }
  }

  if (res.intent === "draft" && res.draft?.text) {
    let draft: Draft = { platform: res.draft.platform, text: res.draft.text, report: await scoreDraft(res.draft.text) };
    if (lane === "memory" && (draft.report.score < VOICE_THRESHOLD || draft.report.flags.length > 0)) {
      draft = await revise(state, draft);
      if (draft.revisedFrom) state.stats.revised += 1;
    }
    out.draft = draft;
  }

  msgs.push(out);
  return out;
}
