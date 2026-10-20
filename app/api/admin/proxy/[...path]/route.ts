import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, isValidAdminSession, isSameAdminOrigin, isAdminGatewayConfigured } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

const ALLOWED: Record<string, string[]> = {
  GET: [
    "/api/status",
    "/api/admin/maintenance",
    "/api/printer/telemetry",
    "/api/printer/queue",
    "/api/printer/history",
    "/api/paper-stock",
    "/api/revenue/history",
    "/api/revenue/export.csv",
    "/api/revenue/report.pdf",
    "/api/uploads/recent",
  ],
  POST: [
    "/api/admin/maintenance",
    "/api/ink",
    "/api/paper-stock",
    "/api/printer/cancel-job",
    "/api/uploads/cleanup-now",
    "/api/backup/run",
    "/api/printer/reprint",
  ],
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

async function proxy(request: NextRequest, context: RouteContext) {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!isValidAdminSession(cookie)) return jsonError("Sign in to use the admin console.", 401);

  if (request.method !== "GET" && !isSameAdminOrigin(request)) {
    return jsonError("Request origin rejected.", 403);
  }

  const params = await context.params;
  const path = "/" + (params.path || []).join("/");
  if (!(ALLOWED[request.method] || []).includes(path)) {
    return jsonError("This admin action is not available through the web portal.", 404);
  }

  if (!isAdminGatewayConfigured()) {
    return jsonError("Secure Raspberry Pi admin connection is not configured.", 503);
  }

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET") {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return jsonError("Only JSON admin actions are accepted.", 415);
    }
    const raw = await request.arrayBuffer();
    if (raw.byteLength > 1024 * 1024) return jsonError("Admin request is too large.", 413);
    body = raw;
  }

  const origin = (process.env.ARKOUT_ADMIN_UPSTREAM_URL || "").replace(/\/+$/, "");
  const destination = new URL(origin + path + request.nextUrl.search);
  const username = process.env.ARKOUT_ADMIN_UPSTREAM_USERNAME || "";
  const password = process.env.ARKOUT_ADMIN_UPSTREAM_PASSWORD || "";
  const authorization = "Basic " + Buffer.from(username + ":" + password).toString("base64");

  try {
    const upstream = await fetch(destination, {
      method: request.method,
      headers: {
        Authorization: authorization,
        "CF-Access-Client-Id": process.env.ARKOUT_ADMIN_ACCESS_CLIENT_ID || "",
        "CF-Access-Client-Secret": process.env.ARKOUT_ADMIN_ACCESS_CLIENT_SECRET || "",
        Accept: "application/json, text/csv, application/pdf",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });

    if (upstream.status === 401 || upstream.status === 403) {
      return jsonError("The private admin gateway rejected its upstream credentials. Check deployment settings.", 502);
    }
    const type = upstream.headers.get("content-type") || "application/json";
    const permittedType = /^(application\/json|text\/csv|application\/pdf)(;|$)/i.test(type);
    if (!permittedType) return jsonError("The admin gateway returned an unsupported response type.", 502);

    const headers = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": type,
    });
    const disposition = upstream.headers.get("content-disposition");
    if (disposition && /^(attachment|inline);/i.test(disposition)) {
      headers.set("Content-Disposition", disposition);
    }
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers });
  } catch {
    return jsonError("The Raspberry Pi admin service could not be reached. Verify the secure tunnel and try again.", 502);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}
