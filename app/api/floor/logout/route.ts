import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(req: Request) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  cookies().delete(SESSION_COOKIE);
  // 303 → the browser re-requests the login page with GET after the form POST.
  return NextResponse.redirect(new URL("/floor/login", req.url), { status: 303 });
}
