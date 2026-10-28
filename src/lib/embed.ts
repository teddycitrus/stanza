// Local sentence embeddings (all-MiniLM-L6-v2, 384 dims) with a lexical fallback,
// so the novelty guard keeps working if the ONNX runtime is unavailable.

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

let extractor: Promise<Extractor | null> | null = null;

async function load(): Promise<Extractor | null> {
  try {
    const { pipeline } = await import("@huggingface/transformers");
    return (await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" })) as unknown as Extractor;
  } catch (err) {
    console.warn("[embed] falling back to lexical vectors:", (err as Error).message);
    return null;
  }
}

const DIM = 384;

function lexical(text: string): number[] {
  const v = new Array(DIM).fill(0);
  const words = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  for (const w of words) {
    let h = 2166136261;
    for (const c of w) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    v[Math.abs(h) % DIM] += 1;
  }
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ex = await (extractor ??= load());
  if (!ex) return texts.map(lexical);
  return (await ex(texts, { pooling: "mean", normalize: true })).tolist();
}

export function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
