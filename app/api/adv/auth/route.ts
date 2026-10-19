import { NextRequest, NextResponse } from "next/server";
import {
  ADV_COOKIE_NAME,
  ADV_SESSION_TTL_SECONDS,
  createAdvSession,
  isAdvAuthConfigured,
  isSameOrigin,
  isValidAdvSession,
  matchesAdvCredentials,
} from "@/lib/adv-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const configured = isAdvAuthConfigured();
  return json({
    configured,
    authenticated:
      configured && isValidAdvSession(request.cookies.get(ADV_COOKIE_NAME)?.value),
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Request origin rejected." }, 403);
  if (!isAdvAuthConfigured()) {
    return json({ error: "Marketing portal setup is incomplete." }, 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ error: "Invalid request body." }, 400);
  }

  const username = (body as Record<string, unknown>).username;
  const password = (body as Record<string, unknown>).password;
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    username.length > 200 ||
    password.length > 512 ||
    !matchesAdvCredentials(username, password)
  ) {
    return json({ error: "Username or password is incorrect." }, 401);
  }

  const response = json({ ok: true });
  response.cookies.set(ADV_COOKIE_NAME, createAdvSession(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADV_SESSION_TTL_SECONDS,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "Request origin rejected." }, 403);
  const response = json({ ok: true });
  response.cookies.set(ADV_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
