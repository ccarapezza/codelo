import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

// Sale del modo borrador y vuelve a la nota publicada (o a la home).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") || "/";
  (await draftMode()).disable();
  redirect(to);
}
