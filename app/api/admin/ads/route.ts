import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  isSameAdminOrigin,
  isValidAdminSession,
} from "@/lib/admin-auth";
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
  return isValidAdminSession(
    request.cookies.get(ADMIN_COOKIE_NAME)?.value,
  );
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return json({ error: "Sign in to the admin panel to review advertisements." }, 401);
  }

  try {
    const response = await piAdsFetch("/api/ads/manage");
    const data = await response.json();

    if (!response.ok) {
      return json({ error: data.error || "Could not load advertisements from Pi." }, response.status);
    }

    const ads = Array.isArray(data.ads)
      ? data.ads.filter((ad: { enabled?: boolean; approvalStatus?: string }) =>
          ad.enabled !== true && ad.approvalStatus !== "approved")
      : [];

    return json({ ads });
  } catch {
    return json({ error: "Could not connect to Pi advertisement storage." }, 502);
  }
}

export async function POST(request: NextRequest) {
  if (!isSameAdminOrigin(request)) {
    return json({ error: "Request origin rejected." }, 403);
  }
  if (!authorized(request)) {
    return json({ error: "Sign in to the admin panel first." }, 401);
  }

  let body: { action?: unknown; pathname?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (
    (body.action !== "approve" && body.action !== "reject") ||
    typeof body.pathname !== "string" ||
    !/^arkout-ads\/[0-9a-f]{32}\.(jpg|jpeg|png|webp|gif|avif|heic|heif|mp4|m4v|mov|webm)$/i.test(body.pathname)
  ) {
    return json({ error: "Invalid advertisement action or identifier." }, 400);
  }

  try {
    const listResponse = await piAdsFetch("/api/ads/manage");
    const list = await listResponse.json();

    if (!listResponse.ok) {
      return json({ error: "Could not load advertisements from Pi." }, 502);
    }

    const ad = Array.isArray(list.ads)
      ? list.ads.find((item: { pathname?: string; id?: string }) =>
          item.pathname === body.pathname && typeof item.id === "string")
      : undefined;

    if (!ad) {
      return json({ error: "Advertisement not found." }, 404);
    }

    const response = await piAdsFetch("/api/ads/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: body.action,
        id: ad.id,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      return json({ error: result.error || "Could not update advertisement." }, response.status);
    }

    return json({
      ok: true,
      action: body.action === "approve" ? "approved" : "rejected",
    });
  } catch {
    return json({ error: "Could not update the advertisement on Pi." }, 502);
  }
}
