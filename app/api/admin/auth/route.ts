import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSession,
  isAdminAuthConfigured,
  isAdminGatewayConfigured,
  isSameAdminOrigin,
  isValidAdminSession,
  matchesAdminCredentials,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const configured = isAdminAuthConfigured();
  return json({
    configured,
    authenticated: configured && isValidAdminSession(request.cookies.get(ADMIN_COOKIE_NAME)?.value),
    gatewayConfigured: isAdminGatewayConfigured(),
  });
}

export async function POST(request: NextRequest) {
  if (!isSameAdminOrigin(request)) return json({ error: "Request origin rejected." }, 403);
  if (!isAdminAuthConfigured()) return json({ error: "Admin portal setup is incomplete." }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid sign-in request." }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "Invalid sign-in request." }, 400);

  const value = body as Record<string, unknown>;
  if (
    typeof value.username !== "string" ||
    typeof value.password !== "string" ||
    value.username.length > 200 ||
    value.password.length > 512 ||
    !matchesAdminCredentials(value.username, value.password)
  ) {
    return json({ error: "Username or password is incorrect." }, 401);
  }

  const response = json({ ok: true, gatewayConfigured: isAdminGatewayConfigured() });
  response.cookies.set(ADMIN_COOKIE_NAME, createAdminSession(value.username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isSameAdminOrigin(request)) return json({ error: "Request origin rejected." }, 403);
  const response = json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
