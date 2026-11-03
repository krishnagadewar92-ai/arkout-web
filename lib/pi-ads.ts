export function piAdsBase() {
  return (process.env.ARKOUT_ADS_API_BASE_URL || "https://api2.arkout.in")
    .replace(/\/+$/, "");
}

export function piAdsToken() {
  return process.env.ARKOUT_ADS_API_TOKEN || "";
}

export async function piAdsFetch(path: string, init: RequestInit = {}) {
  const token = piAdsToken();
  if (!token) {
    throw new Error("Pi advertisement API token is not configured.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(`${piAdsBase()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
