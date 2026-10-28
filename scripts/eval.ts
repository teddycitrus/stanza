// Regression suite: replays a scripted creator session through both lanes and gates on the memory lane.
// Usage: npm run eval [-- --runs 2]
import { promises as fs } from "fs";
import path from "path";
import { CHAT_MODEL, FAST_MODEL, callTool, hasKey } from "../src/lib/llm";
import { PROMPT_VERSION, WINDOW, runTurn } from "../src/lib/agent";
import { cosine, embed } from "../src/lib/embed";
import { DUPLICATE_THRESHOLD, ideaText } from "../src/lib/novelty";
import { emptyState } from "../src/lib/store";
import { CONSTRAINTS, SCRIPT as STEPS } from "../src/lib/script";
import type { Idea, Lane } from "../src/lib/types";

const SCRIPT = STEPS.map((s) => s.text);

export const GATES = { repeatRate: 0.1, violationRate: 0.05, recall: 1, voice: 70 };

interface LaneResult {
  ideas: number;
  repeats: number;
  violations: number;
  repeatRate: number;
  violationRate: number;
  recall: number;
  voice: number;
  slopFlags: number;
  held: number;
  revised: boolean;
  ms: number;
  examples: { repeats: string[]; violations: string[]; recallReply: string; draft: string };
}

async function violations(ideas: Idea[]): Promise<boolean[]> {
  if (!ideas.length) return [];
  const { verdicts } = await callTool<{ verdicts: boolean[] }>({
    model: FAST_MODEL,
    system: "You check post ideas against a creator's explicit constraints. Mark an idea true only if it clearly violates one.",
    messages: [{ role: "user", content: `Constraints:\n${CONSTRAINTS.map((c) => `- ${c}`).join("\n")}\n\nIdeas:\n${ideas.map((i, n) => `${n}. ${ideaText(i)}`).join("\n")}` }],
    tool: {
      name: "verdicts",
      description: "One boolean per idea, in order.",
      schema: { type: "object", properties: { verdicts: { type: "array", items: { type: "boolean" } } }, required: ["verdicts"] },
    },
    maxTokens: 400,
  });
  return ideas.map((_, i) => Boolean(verdicts[i]));
}

async function runLane(lane: Lane): Promise<LaneResult> {
  const t = Date.now();
  const state = emptyState();
  const replies = [];
  for (const line of SCRIPT) replies.push(await runTurn(state, lane, line));

  const ideaTurns = replies.slice(1, 5).map((r) => r.ideas ?? []);
  const all = ideaTurns.flat();
  const vecs = await embed(all.map(ideaText));
  const repeatList: string[] = [];
  vecs.forEach((v, i) => {
    for (let j = 0; j < i; j++) {
      if (cosine(v, vecs[j]) >= DUPLICATE_THRESHOLD) {
        repeatList.push(`${all[i].title}  ~  ${all[j].title}`);
        break;
      }
    }
  });
  const v = await violations(all);
  const recallReply = replies[5].text;
  const recall = Number(/nov(ember)?\.?\s*17/i.test(recallReply)) * 0.5 + Number(/\b150\b/.test(recallReply)) * 0.5;
  const draft = replies[6].draft;
  return {
    ideas: all.length,
    repeats: repeatList.length,
    violations: v.filter(Boolean).length,
    repeatRate: all.length ? repeatList.length / all.length : 0,
    violationRate: all.length ? v.filter(Boolean).length / all.length : 0,
    recall,
    voice: draft?.report.score ?? 0,
    slopFlags: draft?.report.flags.length ?? 0,
    held: replies.reduce((s, r) => s + (r.held?.length ?? 0), 0),
    revised: Boolean(draft?.revisedFrom),
    ms: Date.now() - t,
    examples: {
      repeats: repeatList.slice(0, 4),
      violations: all.filter((_, i) => v[i]).map((i) => i.title).slice(0, 4),
      recallReply,
      draft: draft?.text ?? "",
    },
  };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function average(rs: LaneResult[]): LaneResult {
  const keys = ["ideas", "repeats", "violations", "repeatRate", "violationRate", "recall", "voice", "slopFlags", "held", "ms"] as const;
  const out = { ...rs[0] };
  for (const k of keys) out[k] = mean(rs.map((r) => r[k]));
  return out;
}

async function main() {
  if (!hasKey()) {
    console.error("ANTHROPIC_API_KEY is not set (put it in .env.local).");
    process.exit(2);
  }
  const runsArg = process.argv.indexOf("--runs");
  const runs = runsArg > -1 ? Number(process.argv[runsArg + 1]) : 1;
  const results: Record<Lane, LaneResult[]> = { stateless: [], memory: [] };
  for (let i = 0; i < runs; i++) {
    console.log(`run ${i + 1}/${runs}...`);
    const [s, m] = await Promise.all([runLane("stateless"), runLane("memory")]);
    results.stateless.push(s);
    results.memory.push(m);
  }
  const stateless = average(results.stateless);
  const memory = average(results.memory);
  const gates = {
    repeatRate: memory.repeatRate <= GATES.repeatRate,
    violationRate: memory.violationRate <= GATES.violationRate,
    recall: memory.recall >= GATES.recall,
    voice: memory.voice >= GATES.voice,
  };
  const pass = Object.values(gates).every(Boolean);
  const report = { at: new Date().toISOString(), promptVersion: PROMPT_VERSION, models: { chat: CHAT_MODEL, fast: FAST_MODEL }, window: WINDOW, runs, script: SCRIPT, thresholds: GATES, stateless, memory, gates, pass };

  await fs.mkdir(path.join(process.cwd(), "evals"), { recursive: true });
  await fs.writeFile(path.join(process.cwd(), "evals", "latest.json"), JSON.stringify(report, null, 2));

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  console.table({
    "Repeat rate": { stateless: pct(stateless.repeatRate), memory: pct(memory.repeatRate), gate: `<= ${pct(GATES.repeatRate)}` },
    "Constraint violations": { stateless: pct(stateless.violationRate), memory: pct(memory.violationRate), gate: `<= ${pct(GATES.violationRate)}` },
    "Recall (launch date + goal)": { stateless: pct(stateless.recall), memory: pct(memory.recall), gate: `>= ${pct(GATES.recall)}` },
    "Voice score": { stateless: Math.round(stateless.voice), memory: Math.round(memory.voice), gate: `>= ${GATES.voice}` },
    "Slop flags in draft": { stateless: stateless.slopFlags, memory: memory.slopFlags, gate: "-" },
  });
  console.log(pass ? "PASS" : "FAIL", "-> evals/latest.json");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
