import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authenticate } from "@/lib/auth/authenticate";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Username and password required." }, { status: 400 });
  }
  const user = await authenticate(username.trim(), password);
  if (!user) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  const token = await createSession(user.id);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({ ok: true, role: user.role });
}
