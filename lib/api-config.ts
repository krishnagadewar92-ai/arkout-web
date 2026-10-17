const PRIMARY_PRODUCTION_API = "https://api.arkout.in";
const TERMINAL_02_PRODUCTION_API = "https://api2.arkout.in";
const ADMIN_PRODUCTION_API = "https://api.arkout.in";

function normalizeBaseUrl(value: string | undefined): string {
  return typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
}

export function isPreviewDeployment(): boolean {
  return process.env.NEXT_PUBLIC_DEPLOYMENT_STAGE === "preview";
}

/**
 * Resolve the endpoint for a terminal.
 * Preview builds are fail-closed: they may only use explicit preview endpoints.
 * Production keeps the historical endpoint routing unchanged.
 */
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

/**
 * A recovered URL comes from browser storage, so never trust it as an arbitrary
 * network destination. Require it to match the endpoint selected for this terminal.
 * An empty result disables network recovery but leaves the order/payment reference
 * available on screen for manual support handling.
 */
export function validateRecoveryApiBaseUrl(sessionId: string, storedUrl: string): string {
  const expectedUrl = getTerminalApiBaseUrl(sessionId);
  const candidateUrl = normalizeBaseUrl(storedUrl);
  if (!expectedUrl || !candidateUrl || candidateUrl !== expectedUrl) return "";
  return expectedUrl;
}

/** Keep preview admin requests away from the live kiosk. */
export function getAdminApiBaseUrl(): string {
  if (isPreviewDeployment()) {
    return normalizeBaseUrl(process.env.NEXT_PUBLIC_PREVIEW_KIOSK_API_URL);
  }
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_KIOSK_API) || ADMIN_PRODUCTION_API;
}
