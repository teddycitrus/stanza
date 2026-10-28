import { NextResponse } from "next/server";
import { runTurn } from "@/lib/agent";
import { publicState, withState } from "@/lib/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "Message is empty." }, { status: 400 });
  try {
    const state = await withState(async (s) => {
      await Promise.all([runTurn(s, "stateless", text.trim()), runTurn(s, "memory", text.trim())]);
      return publicState(s);
    });
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
