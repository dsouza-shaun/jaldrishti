function isOpenMeteoHost(hostname: string): boolean {
  return hostname === "open-meteo.com" || hostname.endsWith(".open-meteo.com");
}

export function getOpenMeteoUrl(
  environmentVariable: string,
  publicDefaultUrl: string,
  customerDefaultUrl: string,
): URL {
  const configured = process.env[environmentVariable]?.trim();
  const apiKey = process.env.OPEN_METEO_API_KEY?.trim();
  const url = new URL(configured || (apiKey ? customerDefaultUrl : publicDefaultUrl));

  if (apiKey && isOpenMeteoHost(url.hostname) && !url.hostname.startsWith("customer-")) {
    throw new Error(
      `${environmentVariable} must use the matching customer Open-Meteo host when OPEN_METEO_API_KEY is configured`,
    );
  }

  return url;
}

export function addOpenMeteoApiKey(url: URL): void {
  const apiKey = process.env.OPEN_METEO_API_KEY?.trim();
  if (apiKey) url.searchParams.set("apikey", apiKey);
}
