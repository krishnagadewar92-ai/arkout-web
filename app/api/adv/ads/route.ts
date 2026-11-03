import { NextRequest, NextResponse } from "next/server";
import { ADV_COOKIE_NAME, isSameOrigin, isValidAdvSession } from "@/lib/adv-auth";
import { piAdsFetch } from "@/lib/pi-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function authorized(request: NextRequest) {
  return isValidAdvSession(request.cookies.get(ADV_COOKIE_NAME)?.value);
}

const SAFE_PATH =
  /^arkout-ads\/[0-9a-f]{32}\.(jpg|jpeg|png|webp|gif|avif|heic|heif|mp4|m4v|mov|webm)$/i;

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return json({ error: "Sign in to manage advertisements." }, 401);
  }

  try {
    const upstream = await piAdsFetch("/api/ads/manage");
    const data = await upstream.json();
    return json(data, upstream.status);
  } catch {
    return json({ error: "Could not connect to Pi advertisement storage." }, 502);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return json({ error: "Request origin rejected." }, 403);
  }
  if (!authorized(request)) {
    return json({ error: "Sign in to upload advertisements." }, 401);
  }

  let body: { action?: unknown; maxBytes?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid upload request." }, 400);
  }

  if (body.action !== "create-upload-ticket") {
    return json({ error: "Unsupported upload action." }, 400);
  }

  const maxBytes = Number(body.maxBytes);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 50 * 1024 * 1024) {
    return json({ error: "Invalid upload size." }, 400);
  }

  try {
    const upstream = await piAdsFetch("/api/ads/manage/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxBytes }),
    });
    const data = await upstream.json();
    return json(data, upstream.status);
  } catch {
    return json({ error: "Could not obtain an upload ticket from the Pi." }, 502);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return json({ error: "Request origin rejected." }, 403);
  }
  if (!authorized(request)) {
    return json({ error: "Sign in to delete advertisements." }, 401);
  }

  const pathname = request.nextUrl.searchParams.get("pathname") || "";
  if (!SAFE_PATH.test(pathname)) {
    return json({ error: "Invalid advertisement identifier." }, 400);
  }

  try {
    const listResponse = await piAdsFetch("/api/ads/manage");
    const list = await listResponse.json();
    if (!listResponse.ok) {
      return json({ error: "Could not load advertisements from the Pi." }, 502);
    }

    const ad = Array.isArray(list.ads)
      ? list.ads.find((item: { pathname?: string }) => item.pathname === pathname)
      : undefined;

    if (!ad || typeof ad.id !== "string") {
      return json({ error: "Advertisement not found." }, 404);
    }

    const upstream = await piAdsFetch("/api/ads/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: ad.id }),
    });
    const data = await upstream.json();
    return json(data, upstream.status);
  } catch {
    return json({ error: "Could not delete the advertisement from the Pi." }, 502);
  }
}
