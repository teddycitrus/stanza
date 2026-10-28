import { callTool, FAST_MODEL, hasKey } from "./llm";
import { posts, engagement } from "./seed";
import type { Flag, VoiceReport } from "./types";

const SLOP: [string, RegExp][] = [
  ["em dash", /\u2014|\s--\s/g],
  ["delve", /\bdelv(e|es|ing)\b/gi],
  ["game-changer", /\bgame[- ]?changer\b/gi],
  ["unlock", /\bunlock(s|ing|ed)?\b/gi],
  ["elevate", /\belevat(e|es|ing)\b/gi],
  ["leverage", /\bleverag(e|es|ing)\b/gi],
  ["navigate", /\bnavigat(e|es|ing)\b/gi],
  ["landscape", /\blandscape\b/gi],
  ["tapestry", /\btapestry\b/gi],
  ["seamless", /\bseamless(ly)?\b/gi],
  ["empower", /\bempower(s|ing|ment)?\b/gi],
  ["harness", /\bharness(es|ing)?\b/gi],
  ["foster", /\bfoster(s|ing)?\b/gi],
  ["journey", /\bjourney\b/gi],
  ["embark", /\bembark(s|ing)?\b/gi],
  ["transformative", /\btransformative\b/gi],
  ["supercharge", /\bsupercharg(e|es|ing)\b/gi],
  ["level up", /\blevel[- ]up\b/gi],
  ["in today's world", /\bin today'?s (fast-paced|digital|busy)?\s?(world|age|landscape)?/gi],
  ["let's dive in", /\blet'?s dive in\b/gi],
  ["here's the thing", /\bhere'?s the thing\b/gi],
  ["buckle up", /\bbuckle up\b/gi],
  ["picture this", /\bpicture this\b/gi],
  ["not just X, it's Y", /\b(it'?s|this is) not (just )?(about )?[^.\n]{1,40}[.,]\s*(it'?s|this is)\b/gi],
  ["not only... but also", /\bnot only\b[^.\n]{1,60}\bbut also\b/gi],
  ["at the end of the day", /\bat the end of the day\b/gi],
  ["whether you're X or Y", /\bwhether you'?re\b[^.\n]{1,50}\bor\b/gi],
  ["stop scrolling", /\bstop scrolling\b/gi],
  ["emoji", /[\u{1F300}-\u{1FAFF}\u{2728}\u{2705}]/gu],
  ["hashtag", /(^|\s)#[A-Za-z]\w+/g],
];

export function slopFlags(text: string): Flag[] {
  const flags: Flag[] = [];
  for (const [rule, re] of SLOP) {
    for (const m of text.matchAll(re)) flags.push({ rule, match: m[0].trim(), index: m.index ?? 0 });
  }
  return flags.sort((a, b) => a.index - b.index);
}

interface Features {
  wordsPerSentence: number;
  wordsPerLine: number;
  firstPerson: number;
  secondPerson: number;
  questionClose: number;
  words: number;
}

function features(text: string): Features {
  const words = text.match(/[A-Za-z0-9']+/g) ?? [];
  const n = Math.max(words.length, 1);
  const sentences = text.split(/[.!?]+(\s|$)|\n+/).filter((s) => /[A-Za-z]/.test(s ?? ""));
  const lines = text.split(/\n+/).filter((l) => l.trim());
  const per100 = (re: RegExp) => ((text.match(re) ?? []).length / n) * 100;
  return {
    wordsPerSentence: n / Math.max(sentences.length, 1),
    wordsPerLine: n / Math.max(lines.length, 1),
    firstPerson: per100(/\b(i|i'm|i've|my|me)\b/gi),
    secondPerson: per100(/\b(you|your|you're)\b/gi),
    questionClose: /\?\s*(\(.*\))?\s*$/.test(text.trim()) ? 1 : 0,
    words: n,
  };
}

const FEATURE_META: { key: keyof Features; name: string; unit: string; floor: number }[] = [
  { key: "wordsPerSentence", name: "Words per sentence", unit: "w", floor: 1.5 },
  { key: "wordsPerLine", name: "Words per line", unit: "w", floor: 1.5 },
  { key: "firstPerson", name: "First person", unit: "/100w", floor: 1.5 },
  { key: "secondPerson", name: "Second person", unit: "/100w", floor: 1.5 },
  { key: "questionClose", name: "Ends on a question", unit: "rate", floor: 0.3 },
  { key: "words", name: "Length", unit: "w", floor: 12 },
];

const corpus = posts.map((p) => features(p.text));

function stat(key: keyof Features) {
  const xs = corpus.map((f) => f[key]);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { mean, sd };
}

export function stylometric(text: string): { score: number; features: VoiceReport["features"] } {
  const f = features(text);
  let penalty = 0;
  const out: VoiceReport["features"] = [];
  for (const m of FEATURE_META) {
    const { mean, sd } = stat(m.key);
    const spread = Math.max(sd, m.floor);
    penalty += Math.min(1, Math.abs(f[m.key] - mean) / (2.5 * spread));
    out.push({ name: m.name, creator: round(mean), draft: round(f[m.key]), unit: m.unit });
  }
  return { score: Math.round(100 * (1 - penalty / FEATURE_META.length)), features: out };
}

const round = (x: number) => Math.round(x * 10) / 10;

const exemplars = [...posts].sort((a, b) => engagement(b) - engagement(a)).slice(0, 5);

async function judge(text: string): Promise<{ score: number; reason: string } | null> {
  if (!hasKey()) return null;
  try {
    return await callTool<{ score: number; reason: string }>({
      model: FAST_MODEL,
      system:
        "You are a blind voice-authenticity judge for a creator's social posts. Rate how likely the creator's own followers would believe she wrote the draft herself, 1 (obviously AI or someone else) to 10 (indistinguishable from her). Be strict: generic motivational phrasing, polished corporate cadence, or structure she never uses should score low.",
      messages: [
        {
          role: "user",
          content: `Her real posts:\n\n${exemplars.map((p, i) => `[${i + 1}] ${p.text}`).join("\n\n")}\n\nDraft to judge:\n\n${text}`,
        },
      ],
      tool: {
        name: "verdict",
        description: "Return the authenticity score and a one-sentence reason.",
        schema: {
          type: "object",
          properties: { score: { type: "integer", minimum: 1, maximum: 10 }, reason: { type: "string" } },
          required: ["score", "reason"],
        },
      },
      maxTokens: 300,
    });
  } catch (err) {
    console.warn("[voice] judge failed:", (err as Error).message);
    return null;
  }
}

export async function scoreDraft(text: string, opts: { useJudge?: boolean } = {}): Promise<VoiceReport> {
  const flags = slopFlags(text);
  const s = stylometric(text);
  const j = opts.useJudge === false ? null : await judge(text);
  const blended = j ? 0.5 * s.score + 0.5 * j.score * 10 : s.score;
  const score = Math.max(0, Math.min(100, Math.round(blended - 6 * flags.length)));
  return { score, stylometric: s.score, judge: j?.score ?? null, judgeReason: j?.reason ?? null, flags, features: s.features };
}

export const VOICE_THRESHOLD = 75;
