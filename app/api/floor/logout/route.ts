import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  cookies().delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
