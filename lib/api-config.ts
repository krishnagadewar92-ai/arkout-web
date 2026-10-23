const PRIMARY_PRODUCTION_API = "https://api.arkout.in";
const TERMINAL_02_PRODUCTION_API = "https://api2.arkout.in";

function normalizeBaseUrl(value: string | undefined): string {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

/**
 * Production APIs are selected only when the build explicitly says "production".
 * Preview, local development, and misconfigured builds fail closed and may use
 * only a separately provisioned preview/staging backend.
 */
export function isPreviewDeployment(): boolean {
  return process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE !== "production";
}

export function getTerminalApiBaseUrl(sessionId: string): string {
  const isTerminal02 = sessionId.length === 6 && sessionId.startsWith("02");

  if (isPreviewDeployment()) {
    return normalizeBaseUrl(
      isTerminal02
        ? process.env.NEXT_PUBLIC_PREVIEW_TERMINAL_02_API_URL
        : process.env.NEXT_PUBLIC_PREVIEW_API_URL,
    );
  }

  return isTerminal02 ? TERMINAL_02_PRODUCTION_API : PRIMARY_PRODUCTION_API;
}

/** A browser-stored URL is untrusted; allow only the endpoint configured for this terminal. */
export function validateRecoveryApiBaseUrl(sessionId: string, storedUrl: string): string {
  const expectedUrl = getTerminalApiBaseUrl(sessionId);
  const candidateUrl = normalizeBaseUrl(storedUrl);
  if (!expectedUrl || !candidateUrl || candidateUrl !== expectedUrl) return "";
  return expectedUrl;
}
