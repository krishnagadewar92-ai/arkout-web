import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "arkout_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

function sessionSecret() {
  return process.env.ARKOUT_WEB_ADMIN_SESSION_SECRET || "";
}

export function isAdminAuthConfigured() {
  return Boolean(
    process.env.ARKOUT_WEB_ADMIN_USERNAME &&
      process.env.ARKOUT_WEB_ADMIN_PASSWORD &&
      sessionSecret().length >= 32,
  );
}

export function isAdminGatewayConfigured() {
  const origin = process.env.ARKOUT_ADMIN_UPSTREAM_URL || "";
  const username = process.env.ARKOUT_ADMIN_UPSTREAM_USERNAME || "";
  const password = process.env.ARKOUT_ADMIN_UPSTREAM_PASSWORD || "";
  const accessClientId = process.env.ARKOUT_ADMIN_ACCESS_CLIENT_ID || "";
  const accessClientSecret = process.env.ARKOUT_ADMIN_ACCESS_CLIENT_SECRET || "";
  if (!origin || !username || !password || !accessClientId || !accessClientSecret) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && parsed.pathname === "/" && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function matchesAdminCredentials(username: string, password: string) {
  if (!isAdminAuthConfigured()) return false;
  return (
    safeEqual(username, process.env.ARKOUT_WEB_ADMIN_USERNAME || "") &&
    safeEqual(password, process.env.ARKOUT_WEB_ADMIN_PASSWORD || "")
  );
}

export function createAdminSession(username: string) {
  const payload = Buffer.from(JSON.stringify({
    sub: username,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
    nonce: randomBytes(12).toString("hex"),
  })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return payload + "." + signature;
}

export function isValidAdminSession(token?: string | null) {
  if (!token || !isAdminAuthConfigured()) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown; exp?: unknown;
    };
    return parsed.sub === process.env.ARKOUT_WEB_ADMIN_USERNAME &&
      typeof parsed.exp === "number" && parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function isSameAdminOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
