export async function sendPushoverAlert(
  title: string,
  message: string,
  extras?: { url?: string; urlTitle?: string }
) {
  const token = process.env.PUSHOVER_API_KEY;
  const user = process.env.PUSHOVER_USER_KEY;

  if (!token || !user) {
    return;
  }

  const body: Record<string, string> = {
    token,
    user,
    title,
    message,
    priority: "0",
  };
  if (extras?.url) body.url = extras.url;
  if (extras?.urlTitle) body.url_title = extras.urlTitle;

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Pushover alert failed:", res.status, text);
  }
}

export function pushoverAlert(
  title: string,
  message: string,
  extras?: { url?: string; urlTitle?: string }
) {
  void sendPushoverAlert(title, message, extras).catch((error) => {
    console.error("Pushover alert error:", error);
  });
}