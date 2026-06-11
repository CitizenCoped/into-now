export async function sendPushoverAlert(title: string, message: string) {
  const token = process.env.PUSHOVER_API_KEY;
  const user = process.env.PUSHOVER_USER_KEY;

  if (!token || !user) {
    return;
  }

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token,
      user,
      title,
      message,
      priority: "0",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Pushover alert failed:", res.status, text);
  }
}

export function pushoverAlert(title: string, message: string) {
  void sendPushoverAlert(title, message).catch((error) => {
    console.error("Pushover alert error:", error);
  });
}