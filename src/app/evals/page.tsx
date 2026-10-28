import { promises as fs } from "fs";
import path from "path";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

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
  ms: number;
  examples: { repeats: string[]; violations: string[]; recallReply: string; draft: string };
}

interface Report {
  at: string;
  promptVersion: string;
  models: { chat: string; fast: string };
  window: number;
  runs: number;
  script: string[];
  thresholds: { repeatRate: number; violationRate: number; recall: number; voice: number };
  stateless: LaneResult;
  memory: LaneResult;
  gates: Record<string, boolean>;
  pass: boolean;
}

async function read(): Promise<Report | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "evals", "latest.json"), "utf8"));
  } catch {
    return null;
  }
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Bar({ value, base }: { value: number; base?: boolean }) {
  return (
    <span className={`bar${base ? " base" : ""}`} aria-hidden="true">
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </span>
  );
}

export default async function EvalsPage() {
  const r = await read();
  if (!r) {
    return (
      <Shell active="evals">
        <div className="title-row">
          <div>
            <h1>Evals</h1>
            <p className="finding">No report yet. Run <b>npm run eval</b> to replay the scripted session through both lanes and write evals/latest.json.</p>
          </div>
        </div>
      </Shell>
    );
  }

  const rows: { name: string; note: string; key: string; fmt: (l: LaneResult) => string; bar: (l: LaneResult) => number; gate: string }[] = [
    { name: "Repeat rate", note: "Ideas within 0.66 cosine of an earlier idea", key: "repeatRate", fmt: (l) => `${pct(l.repeatRate)} (${l.repeats}/${l.ideas})`, bar: (l) => l.repeatRate, gate: `<= ${pct(r.thresholds.repeatRate)}` },
    { name: "Rule violations", note: "Ideas breaking a rule set in turn 1, judged by Haiku", key: "violationRate", fmt: (l) => `${pct(l.violationRate)} (${l.violations}/${l.ideas})`, bar: (l) => l.violationRate, gate: `<= ${pct(r.thresholds.violationRate)}` },
    { name: "Recall", note: "Launch date and buyer goal from turn 1, asked at turn 6", key: "recall", fmt: (l) => pct(l.recall), bar: (l) => l.recall, gate: `>= ${pct(r.thresholds.recall)}` },
    { name: "Voice score", note: "Stylometrics + blind judge - 6 per slop flag", key: "voice", fmt: (l) => `${Math.round(l.voice)}`, bar: (l) => l.voice / 100, gate: `>= ${r.thresholds.voice}` },
  ];
  const repeatDelta = Math.round((r.stateless.repeatRate - r.memory.repeatRate) * 100);

  return (
    <Shell active="evals">
      <div className="title-row">
        <div>
          <h1>Evals</h1>
          <p className="finding">
            Memory lane {r.pass ? "passes" : "fails"} all gates. Repeats down <b>{repeatDelta} points</b> against the baseline, same model and same {r.window}-message window.
          </p>
        </div>
        <div className="actions">
          <span className={`pill ${r.pass ? "pill-positive" : "pill-negative"}`}>{r.pass ? "Gate passed" : "Gate failed"}</span>
        </div>
      </div>

      <div className="evals-grid">
        <section className="card">
          <div className="card-head">
            <h2>Regression gates</h2>
            <p>
              {r.runs} run{r.runs > 1 ? "s" : ""} · prompt {r.promptVersion} · {r.models.chat} + {r.models.fast} · {new Date(r.at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Baseline</th>
                <th>With memory</th>
                <th>Gate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    {row.name}
                    <small>{row.note}</small>
                  </td>
                  <td>
                    {row.fmt(r.stateless)}
                    <Bar value={row.bar(r.stateless)} base />
                  </td>
                  <td>
                    {row.fmt(r.memory)}
                    <Bar value={row.bar(r.memory)} />
                  </td>
                  <td>
                    <span className={`pill ${r.gates[row.key] ? "pill-positive" : "pill-negative"}`}>{row.gate}</span>
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  Slop flags in draft<small>Em dashes, AI stock phrases, emoji, hashtags</small>
                </td>
                <td>{r.stateless.slopFlags}</td>
                <td>{r.memory.slopFlags}</td>
                <td>-</td>
              </tr>
              <tr>
                <td>
                  Wall time<small>Whole scripted session, per lane</small>
                </td>
                <td>{(r.stateless.ms / 1000).toFixed(0)} s</td>
                <td>{(r.memory.ms / 1000).toFixed(0)} s</td>
                <td>-</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>The script</h2>
            <p>Seven turns. Constraints are stated once, in turn 1.</p>
          </div>
          <ol className="script">
            {r.script.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>What the baseline got wrong</h2>
            <p>Examples from the latest run.</p>
          </div>
          <div className="pre">
            {r.stateless.examples.repeats.length ? `Repeats:\n${r.stateless.examples.repeats.map((x) => `- ${x}`).join("\n")}\n\n` : "No repeats this run.\n\n"}
            {r.stateless.examples.violations.length ? `Rule breaks:\n${r.stateless.examples.violations.map((x) => `- ${x}`).join("\n")}\n\n` : "No rule breaks this run.\n\n"}
            {`Recall answer:\n${r.stateless.examples.recallReply}`}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Memory lane answers</h2>
            <p>Recall and final draft.</p>
          </div>
          <div className="pre">{`${r.memory.examples.recallReply}\n\n${r.memory.examples.draft}`}</div>
        </section>
      </div>
    </Shell>
  );
}
