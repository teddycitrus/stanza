import { NextResponse } from "next/server";
import { publicState, withState } from "@/lib/server";

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  return NextResponse.json(
    await withState(async (s) => {
      s.memories = s.memories.filter((m) => m.id !== id);
      return publicState(s);
    }),
  );
}
