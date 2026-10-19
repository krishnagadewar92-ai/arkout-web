import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADV_COOKIE_NAME = "arkout_adv_session";
export const ADV_SESSION_TTL_SECONDS = 8 * 60 * 60;

function secret() {
  return process.env.ADV_SESSION_SECRET || "";
}

export function isAdvAuthConfigured() {
  return Boolean(
    process.env.ADV_PORTAL_USERNAME &&
      process.env.ADV_PORTAL_PASSWORD &&
      secret().length >= 32,
  );
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function matchesAdvCredentials(username: string, password: string) {
  if (!isAdvAuthConfigured()) return false;
  return (
    safeEqual(username, process.env.ADV_PORTAL_USERNAME || "") &&
    safeEqual(password, process.env.ADV_PORTAL_PASSWORD || "")
  );
}

export function createAdvSession(username: string) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: username,
      exp: Math.floor(Date.now() / 1000) + ADV_SESSION_TTL_SECONDS,
      nonce: randomBytes(12).toString("hex"),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function isValidAdvSession(token?: string | null) {
  if (!token || !isAdvAuthConfigured()) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown;
      exp?: unknown;
    };
    return (
      parsed.sub === process.env.ADV_PORTAL_USERNAME &&
      typeof parsed.exp === "number" &&
      parsed.exp > Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
