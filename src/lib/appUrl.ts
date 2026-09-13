/** Public origin for invite links and Pushover deep links. */
export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || "https://thebestdrug.com";
  return raw.replace(/\/$/, "");
}
