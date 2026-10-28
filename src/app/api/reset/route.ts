import { NextResponse } from "next/server";
import { publicState, withState } from "@/lib/server";
import { emptyState } from "@/lib/store";

export async function POST() {
  return NextResponse.json(
    await withState(async (s) => {
      Object.assign(s, emptyState());
      return publicState(s);
    }),
  );
}
