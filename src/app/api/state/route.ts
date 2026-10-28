import { NextResponse } from "next/server";
import { publicState, withState } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await withState(async (s) => publicState(s)));
}
