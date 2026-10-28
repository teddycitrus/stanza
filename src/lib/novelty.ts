import { cosine, embed } from "./embed";
import { callTool, FAST_MODEL, hasKey } from "./llm";
import { posts } from "./seed";
import { uid } from "./store";
import type { AppState, HeldIdea, Idea, LedgerEntry } from "./types";

// Calibrated on MiniLM: paraphrased ideas land around 0.70-0.85, related-but-new ideas 0.35-0.55.
export const DUPLICATE_THRESHOLD = 0.66;
// Fallback only. Embeddings are weak at policy ("sunrise yoga" vs "no morning routine" scores 0.35),
// so constraints go through an LLM classifier when a key is available.
export const AVOID_THRESHOLD = 0.5;

// Returns, per candidate, the index of the avoid rule it breaks, or -1.
async function checkAvoid(rules: string[], ruleVecs: number[][], candidates: Idea[], candVecs: number[][]): Promise<{ rule: number; score: number }[]> {
  if (rules.length === 0) return candidates.map(() => ({ rule: -1, score: 0 }));
  const byVector = () =>
    candVecs.map((v) => {
      const sims = ruleVecs.map((r) => cosine(v, r));
      const best = sims.indexOf(Math.max(...sims));
      return sims[best] >= AVOID_THRESHOLD ? { rule: best, score: sims[best] } : { rule: -1, score: 0 };
    });
  if (!hasKey()) return byVector();
  try {
    const { verdicts } = await callTool<{ verdicts: { idea: number; rule: number }[] }>({
      model: FAST_MODEL,
      system: "You enforce a creator's explicit 'never suggest' rules on post ideas. For each idea return the index of the rule it violates, or -1. Judge the substance of the idea, not shared words: an idea violates a rule if the creator would reasonably say 'I told you not to pitch that'.",
      messages: [{ role: "user", content: `Rules:\n${rules.map((r, i) => `${i}. ${r}`).join("\n")}\n\nIdeas:\n${candidates.map((c, i) => `${i}. ${ideaText(c)}`).join("\n")}` }],
      tool: {
        name: "verdicts",
        description: "One verdict per idea.",
        schema: {
          type: "object",
          properties: { verdicts: { type: "array", items: { type: "object", properties: { idea: { type: "integer" }, rule: { type: "integer" } }, required: ["idea", "rule"] } } },
          required: ["verdicts"],
        },
      },
      maxTokens: 600,
    });
    return candidates.map((_, i) => {
      const rule = verdicts.find((v) => v.idea === i)?.rule ?? -1;
      return { rule: rule >= 0 && rule < rules.length ? rule : -1, score: 1 };
    });
  } catch (err) {
    console.warn("[novelty] avoid classifier failed, using vectors:", (err as Error).message);
    return byVector();
  }
}

export const ideaText = (i: Pick<Idea, "title" | "hook">) => `${i.title}. ${i.hook}`;

let postedVectors: Promise<LedgerEntry[]> | null = null;

function seedPosted(): Promise<LedgerEntry[]> {
  return (postedVectors ??= embed(posts.map((p) => p.text)).then((vs) =>
    posts.map((p, i) => ({ id: p.id, text: p.text.split("\n")[0], source: "posted" as const, vector: vs[i], at: p.date })),
  ));
}

export interface GuardResult {
  kept: Idea[];
  held: HeldIdea[];
}

export async function guard(state: AppState, candidates: Idea[], limit = 5): Promise<GuardResult> {
  const avoid = state.memories.filter((m) => m.kind === "avoid");
  const posted = state.memories.filter((m) => m.kind === "posted");
  const [cv, av, pv, seed] = await Promise.all([
    embed(candidates.map(ideaText)),
    embed(avoid.map((m) => m.text)),
    embed(posted.map((m) => m.text)),
    seedPosted(),
  ]);

  const history: { text: string; source: HeldIdea["matchedSource"]; vector: number[] }[] = [
    ...seed,
    ...state.ledger,
    ...posted.map((m, i) => ({ text: m.text, source: "posted" as const, vector: pv[i] })),
  ];

  const kept: Idea[] = [];
  const held: HeldIdea[] = [];
  const keptVectors: number[][] = [];
  const policy = await checkAvoid(avoid.map((m) => m.text), av, candidates, cv);

  candidates.forEach((idea, i) => {
    const v = cv[i];
    let best = { sim: 0, text: "", source: "suggested" as HeldIdea["matchedSource"] };
    if (policy[i].rule >= 0) best = { sim: policy[i].score, text: avoid[policy[i].rule].text, source: "avoid" };
    else {
      for (const h of history) {
        const sim = cosine(v, h.vector);
        if (sim > best.sim) best = { sim, text: h.text, source: h.source };
      }
      keptVectors.forEach((kv, j) => {
        const sim = cosine(v, kv);
        if (sim > best.sim) best = { sim, text: ideaText(kept[j]), source: "suggested" };
      });
    }
    const blocked = best.source === "avoid" || best.sim >= DUPLICATE_THRESHOLD;
    if (blocked) held.push({ ...idea, matchedText: best.text, matchedSource: best.source, similarity: round(best.sim) });
    else if (kept.length < limit) {
      kept.push(idea);
      keptVectors.push(v);
    }
  });

  const now = new Date().toISOString();
  kept.forEach((idea, i) => state.ledger.push({ id: uid("led"), text: ideaText(idea), source: "suggested", vector: keptVectors[i], at: now }));
  state.stats.suggested += kept.length;
  state.stats.held += held.length;
  return { kept, held };
}

// Measures (does not block) repeats in the baseline lane, with the same threshold the guard uses.
export async function shadowCheck(state: AppState, ideas: Idea[]): Promise<void> {
  const [vs, seed] = await Promise.all([embed(ideas.map(ideaText)), seedPosted()]);
  const now = new Date().toISOString();
  ideas.forEach((idea, i) => {
    let best = { sim: 0, text: "", source: "suggested" as "suggested" | "posted" };
    for (const h of [...seed, ...state.shadow]) {
      const sim = cosine(vs[i], h.vector);
      if (sim > best.sim) best = { sim, text: h.text, source: h.source };
    }
    if (best.sim >= DUPLICATE_THRESHOLD) {
      idea.repeatOf = { text: best.text, source: best.source, similarity: round(best.sim) };
      state.stats.baselineRepeats += 1;
    }
    state.shadow.push({ id: uid("shd"), text: ideaText(idea), source: "suggested", vector: vs[i], at: now });
  });
}

const round = (x: number) => Math.round(x * 100) / 100;
