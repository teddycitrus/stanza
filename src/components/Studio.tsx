"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicState } from "@/lib/server";
import { SCRIPT } from "@/lib/script";
import type { ChatMessage, Draft, Flag, Lane, Memory, MemoryKind } from "@/lib/types";

const LANES: { id: Lane; name: string; sub: string; watch: string[] }[] = [
  {
    id: "stateless",
    name: "Baseline",
    sub: "Rolling 4-message window. No memory store, no guard, no voice loop.",
    watch: [
      "Ideas it already pitched, or Maya already posted, tagged in red",
      "Her two rules from step 1 slipping once they leave the window",
      "Step 6: does it still know the launch date and buyer goal?",
    ],
  },
  {
    id: "memory",
    name: "With memory",
    sub: "Same window and model, plus memory, novelty guard and voice loop.",
    watch: [
      "Memories appear on the right with the quote they came from",
      "Repeats and rule breaks are held back, struck through, with the reason",
      "Drafts are scored for her voice and rewritten when they read as AI",
    ],
  },
];

const KIND_LABEL: Record<MemoryKind, string> = {
  avoid: "Never suggest",
  posted: "Already posted",
  fact: "Facts",
  goal: "Goals",
  preference: "How she works",
};
const KIND_ORDER: MemoryKind[] = ["avoid", "posted", "goal", "fact", "preference"];

export function Studio() {
  const [state, setState] = useState<PublicState | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    fetch("/api/state").then((r) => r.json()).then(setState).catch(() => setError("Could not load state."));
  }, []);

  async function send(text: string) {
    if (!text.trim() || pending) return;
    setPending(text);
    setError(null);
    setInput("");
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Request failed");
      setState(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function reset() {
    setState(await (await fetch("/api/reset", { method: "POST" })).json());
  }

  async function forget(id: string) {
    setState(await (await fetch(`/api/memory?id=${id}`, { method: "DELETE" })).json());
  }

  const turns = state ? state.lanes.memory.messages.filter((m) => m.role === "user").length : 0;
  const nextStep = SCRIPT.findIndex((s) => !state?.lanes.memory.messages.some((m) => m.role === "user" && m.text === s.text));
  const baselineRepeats = state?.stats.baselineRepeats ?? 0;

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Studio</h1>
          <p className="finding">
            {turns === 0 ? (
              <>Same model, same prompt, same 4-message window. The only difference on the right is a memory layer. Run the script below.</>
            ) : (
              <>
                With memory: <b>{state!.stats.held} ideas held back</b> as repeats or rule breaks and <b>{state!.stats.revised} drafts rewritten</b> for voice.
                Baseline re-pitched <b>{baselineRepeats}</b> ideas it had already given.
              </>
            )}
          </p>
        </div>
        <div className="actions">
          <a className="btn" href="/evals">Open eval report</a>
          <button className="btn" onClick={reset} disabled={!!pending || turns === 0}>Reset session</button>
        </div>
      </div>

      {state && !state.hasKey && (
        <div className="banner">
          Add <code>ANTHROPIC_API_KEY</code> to <code>.env.local</code> and restart the dev server to run live turns.
        </div>
      )}

      <div className="studio">
        {LANES.map((lane) => (
          <LaneCard key={lane.id} lane={lane} messages={state?.lanes[lane.id].messages ?? []} pending={pending} />
        ))}

        <section className="card composer" aria-label="Message both lanes">
          <div className="steps">
            <span>Demo script</span>
            {SCRIPT.map((s, i) => (
              <button
                key={s.label}
                className={`step${i === nextStep ? " next" : ""}${nextStep === -1 || i < nextStep ? " done" : ""}`}
                onClick={() => send(s.text)}
                disabled={!!pending || !state?.hasKey}
                title={s.text}
              >
                <span className="k">{i + 1}</span>
                {s.label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Message Stanley as Maya. Both lanes get the same message."
              rows={1}
              aria-label="Message"
            />
            <button className="btn btn-primary" type="submit" disabled={!!pending || !input.trim() || !state?.hasKey}>
              Send to both
            </button>
          </form>
          {error && <div className="error">{error}</div>}
        </section>

        <div className="side">
          <MemoryPanel memories={state?.memories ?? []} onForget={forget} />
          <section className="card">
            <div className="card-head">
              <h2>Idea ledger</h2>
              <p>Every idea pitched in the memory lane, embedded and checked before the next pitch.</p>
            </div>
            {state && state.ledger.length > 0 && (
              <ol className="recent">
                {state.ledger
                  .slice(-4)
                  .reverse()
                  .map((l) => (
                    <li key={l.id}>{truncate(l.text, 80)}</li>
                  ))}
              </ol>
            )}
            <dl className="kv">
              <dt>Pitched</dt>
              <dd>{state?.stats.suggested ?? 0}</dd>
              <dt>Held back</dt>
              <dd>{state?.stats.held ?? 0}</dd>
              <dt>Drafts rewritten</dt>
              <dd>{state?.stats.revised ?? 0}</dd>
              <dt>Published posts indexed</dt>
              <dd>{state?.synced.posts ?? 0}</dd>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}

function LaneCard({ lane, messages, pending }: { lane: (typeof LANES)[number]; messages: ChatMessage[]; pending: string | null }) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.scrollTo({ top: body.current.scrollHeight });
  }, [messages.length, pending]);

  return (
    <section className="card" aria-label={lane.name}>
      <div className="card-head">
        <h2>
          {lane.name}
          {lane.id === "memory" && <span className="pill pill-accent">memory on</span>}
        </h2>
        <p>{lane.sub}</p>
      </div>
      <div className="lane-body" ref={body}>
        {messages.length === 0 && !pending && (
          <div className="lane-empty">
            <h3>What to watch for</h3>
            <ol>
              {lane.watch.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ol>
          </div>
        )}
        {messages.map((m) => (m.role === "user" ? <UserMsg key={m.id} m={m} /> : <AssistantMsg key={m.id} m={m} />))}
        {pending && (
          <>
            <div className="msg-user">{pending}</div>
            <div className="thinking">
              <span className="dot" /> {lane.id === "memory" ? "Updating memory, then drafting" : "Drafting"}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function UserMsg({ m }: { m: ChatMessage }) {
  return (
    <>
      <div className="msg-user">{m.text}</div>
      {m.memoryOps?.length ? (
        <div className="msg-ops">
          {m.memoryOps.map((op, i) => (
            <span key={i} className="pill pill-accent" title={op.text}>
              {op.op === "add" ? "Remembered" : op.op === "update" ? "Updated" : "Forgot"}
              {op.kind ? `: ${KIND_LABEL[op.kind].toLowerCase()}` : ""}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}

function AssistantMsg({ m }: { m: ChatMessage }) {
  return (
    <div className="msg-assistant">
      <p>{m.text}</p>
      {m.ideas?.length ? (
        <ol className="ideas">
          {m.ideas.map((idea, i) => (
            <li key={idea.id}>
              <span className="n">{i + 1}</span>
              <span className="t">{idea.title}</span>
              {idea.repeatOf ? (
                <span className="pill pill-negative" title={`${idea.repeatOf.text} (similarity ${idea.repeatOf.similarity.toFixed(2)})`}>
                  {idea.repeatOf.source === "posted" ? "Already posted" : "Repeat"}
                </span>
              ) : (
                <span className="pill pill-neutral">{idea.format}</span>
              )}
              <span className="h">
                {idea.hook}
                {idea.repeatOf && <em className="repeat-of"> Matches: &ldquo;{truncate(idea.repeatOf.text, 60)}&rdquo; ({idea.repeatOf.similarity.toFixed(2)})</em>}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {m.held?.length ? (
        <details className="held" open>
          <summary>Held back {m.held.length}</summary>
          <ul>
            {m.held.map((h) => (
              <li key={h.id}>
                <s>{h.title}</s>
                <small>
                  {h.matchedSource === "avoid"
                    ? `Breaks her rule: ${h.matchedText}`
                    : `${h.matchedSource === "posted" ? "Already posted" : "Already pitched"}: "${truncate(h.matchedText, 70)}" (similarity ${h.similarity.toFixed(2)})`}
                </small>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {m.draft && <DraftCard d={m.draft} />}
    </div>
  );
}

function DraftCard({ d }: { d: Draft }) {
  const r = d.report;
  const tone = r.score >= 75 ? "pill-positive" : r.score >= 55 ? "pill-warning" : "pill-negative";
  return (
    <div className="draft">
      <div className="draft-text">{highlight(d.text, r.flags)}</div>
      <div className="draft-score">
        <span className="big">
          {r.score}
          <small>/100 voice</small>
        </span>
        <span className={`pill ${tone}`}>{r.score >= 75 ? "Sounds like her" : r.score >= 55 ? "Borderline" : "Reads as AI"}</span>
        <span className="meta">
          style <b>{r.stylometric}</b> · judge <b>{r.judge ?? "-"}</b>/10 · <b>{r.flags.length}</b> slop flags
        </span>
        {d.revisedFrom && <span className="pill pill-accent">Rewritten from {d.revisedFrom.report.score}</span>}
      </div>
      <details>
        <summary>Why this score</summary>
        {r.judgeReason && <p style={{ margin: "6px 0" }}>{r.judgeReason}</p>}
        <table className="feat">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Her posts</th>
              <th>Draft</th>
            </tr>
          </thead>
          <tbody>
            {r.features.map((f) => (
              <tr key={f.name}>
                <td>{f.name}</td>
                <td>
                  {f.creator} {f.unit}
                </td>
                <td className={Math.abs(f.draft - f.creator) > Math.max(2, f.creator * 0.5) ? "off" : undefined}>
                  {f.draft} {f.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {d.revisedFrom && (
          <>
            <p style={{ margin: "10px 0 0" }}>First draft ({d.revisedFrom.report.score}/100):</p>
            <div className="orig">{highlight(d.revisedFrom.text, d.revisedFrom.report.flags)}</div>
          </>
        )}
      </details>
    </div>
  );
}

function MemoryPanel({ memories, onForget }: { memories: Memory[]; onForget: (id: string) => void }) {
  return (
    <section className="card">
      <div className="card-head">
        <h2>Memory</h2>
        <p>What Stanley knows about Maya, each with the quote it came from. Delete anything wrong.</p>
      </div>
      {memories.length === 0 ? (
        <p className="side-empty">Empty. Memories appear here as Maya tells Stanley things worth keeping.</p>
      ) : (
        KIND_ORDER.filter((k) => memories.some((m) => m.kind === k)).map((k) => (
          <div className="mem-group" key={k}>
            <h3>{KIND_LABEL[k]}</h3>
            <ul>
              {memories
                .filter((m) => m.kind === k)
                .map((m) => (
                  <li key={m.id}>
                    <span>{m.text}</span>
                    <button className="mem-del" onClick={() => onForget(m.id)} aria-label={`Forget: ${m.text}`}>
                      Forget
                    </button>
                    {m.evidence && <q>{m.evidence}</q>}
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function highlight(text: string, flags: Flag[]) {
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const f of flags) {
    const i = text.indexOf(f.match, Math.max(at, f.index - 2));
    if (i < at || i === -1) continue;
    out.push(text.slice(at, i), <mark key={i} title={f.rule}>{f.match}</mark>);
    at = i + f.match.length;
  }
  out.push(text.slice(at));
  return out;
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);
