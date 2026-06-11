export function previewMessage(body: string, maxSentences = 2) {
  const trimmed = body.trim();
  if (!trimmed) {
    return { preview: "", isTruncated: false };
  }

  const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [trimmed];
  if (sentences.length <= maxSentences) {
    return { preview: trimmed, isTruncated: false };
  }

  const preview = sentences.slice(0, maxSentences).join("").trim();
  return { preview, isTruncated: true };
}

export function formatRelativeTime(value: string | Date) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d`;
}