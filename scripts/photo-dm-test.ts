import { loadEnv } from "./loadEnv";

loadEnv();

const BASE = process.env.PHOTO_TEST_BASE ?? "http://localhost:3000";
const BIRTH = "1990-06-15";
const FIXTURE_URL =
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=640&q=80";
const BLUR_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wAAAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//Z";

async function loadFixtureJpeg(): Promise<Buffer> {
  const res = await fetch(FIXTURE_URL, {
    headers: { "User-Agent": "into-now-photo-dm-test/1.0" },
  });
  if (!res.ok) throw new Error(`Fixture download HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 1000) throw new Error("Fixture JPEG too small");
  return bytes;
}

type Actor = {
  label: string;
  kind: "anonymous" | "registered";
  id: string;
  cookie: string;
};

function cookieHeader(res: Response): string {
  const cookies =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const auth = cookies.find((c) => c.startsWith("intonow_auth="));
  if (!auth) throw new Error("No intonow_auth cookie");
  return auth.split(";")[0];
}

async function json(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

async function api(
  path: string,
  init: RequestInit & { cookie?: string } = {}
): Promise<{ status: number; data: Record<string, unknown>; res: Response }> {
  const { cookie, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (cookie) headers.set("Cookie", cookie);
  if (rest.body && !headers.has("Content-Type") && typeof rest.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE}${path}`, { ...rest, headers });
  return { status: res.status, data: await json(res), res };
}

async function createAnonymous(label: string): Promise<Actor> {
  const { status, data, res } = await api("/api/auth/anonymous", {
    method: "POST",
    body: JSON.stringify({ birthDate: BIRTH }),
  });
  if (status !== 200) throw new Error(`${label} anonymous failed ${status} ${JSON.stringify(data)}`);
  const user = data.user as { id: string };
  return { label, kind: "anonymous", id: user.id, cookie: cookieHeader(res) };
}

async function createRegistered(label: string): Promise<Actor> {
  const { getDb } = await import("../src/lib/db");
  const { createAuthToken, AUTH_MAX_AGE_SEC } = await import("../src/lib/auth");
  const { users } = await import("../src/lib/schema");
  const email = `${label.replace(/\s+/g, "-")}-${Date.now()}@test.intonow.local`;
  const [row] = await getDb()
    .insert(users)
    .values({
      email,
      authMethod: "email",
      isAnonymous: false,
      birthDate: BIRTH,
      ageVerifiedAt: new Date(),
      displayName: label,
    })
    .returning();
  const token = await createAuthToken(
    { userId: row.id, authMethod: "email", isAnonymous: false },
    AUTH_MAX_AGE_SEC
  );
  return { label, kind: "registered", id: row.id, cookie: `intonow_auth=${token}` };
}

async function uploadReadyPhoto(actor: Actor, jpeg: Buffer): Promise<string> {
  const created = await api("/api/photos", {
    method: "POST",
    cookie: actor.cookie,
    body: JSON.stringify({
      contentType: "image/jpeg",
      sizeBytes: jpeg.length,
      isLive: false,
      blurDataUrl: BLUR_DATA_URL,
      aspectRatio: 1,
    }),
  });
  if (created.status !== 201) {
    throw new Error(
      `${actor.label} POST /api/photos ${created.status} ${JSON.stringify(created.data)}`
    );
  }
  const photoId = created.data.photoId as string;

  const put = await api(`/api/photos/${photoId}/content`, {
    method: "PUT",
    cookie: actor.cookie,
    headers: { "Content-Type": "image/jpeg" },
    body: new Uint8Array(jpeg),
  });
  if (put.status !== 200) {
    throw new Error(`${actor.label} content PUT ${put.status} ${JSON.stringify(put.data)}`);
  }

  let scan = await api(`/api/photos/${photoId}/scan`, {
    method: "POST",
    cookie: actor.cookie,
  });
  if (scan.status === 502) {
    scan = await api(`/api/photos/${photoId}/scan`, {
      method: "POST",
      cookie: actor.cookie,
    });
  }
  if (scan.status !== 200 || scan.data.status !== "ready") {
    throw new Error(`${actor.label} scan ${scan.status} ${JSON.stringify(scan.data)}`);
  }

  const library = await api("/api/photos", { cookie: actor.cookie });
  const photos = (library.data.photos as { id: string }[]) ?? [];
  if (!photos.some((p) => p.id === photoId)) {
    throw new Error(`${actor.label} library missing ready photo ${photoId}`);
  }
  return photoId;
}

type PhotoView = {
  photoId: string;
  revealed: boolean;
  url?: string | null;
  blurDataUrl?: string;
};

async function sendAndReceive(sender: Actor, recipient: Actor, photoId: string) {
  const convo = await api("/api/conversations", {
    method: "POST",
    cookie: sender.cookie,
    body: JSON.stringify({ participantId: recipient.id }),
  });
  if (convo.status !== 201 && convo.status !== 200) {
    throw new Error(
      `${sender.label}→${recipient.label} start convo ${convo.status} ${JSON.stringify(convo.data)}`
    );
  }
  const conversationId = convo.data.conversationId as string;

  const sent = await api(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    cookie: sender.cookie,
    body: JSON.stringify({ body: `photo from ${sender.label}`, photoIds: [photoId] }),
  });
  if (sent.status !== 201 && sent.status !== 200) {
    throw new Error(
      `${sender.label}→${recipient.label} send ${sent.status} ${JSON.stringify(sent.data)}`
    );
  }
  const message = sent.data.message as { id: string; photos: PhotoView[] };
  if (!message?.photos?.[0]?.photoId) {
    throw new Error(`${sender.label} send response missing photos ${JSON.stringify(sent.data)}`);
  }
  if (!message.photos[0].url) {
    throw new Error(`${sender.label} sender view missing presigned URL`);
  }

  const inbox = await api(`/api/conversations/${conversationId}/messages`, {
    cookie: recipient.cookie,
  });
  if (inbox.status !== 200) {
    throw new Error(
      `${recipient.label} inbox ${inbox.status} ${JSON.stringify(inbox.data)}`
    );
  }
  const rows = (inbox.data.messages as { id: string; photos: PhotoView[] }[]) ?? [];
  const received = rows.find((m) => m.id === message.id);
  if (!received) throw new Error(`${recipient.label} did not receive message`);
  const photo = received.photos[0];
  if (!photo) throw new Error(`${recipient.label} message has no photo`);
  if (photo.revealed) throw new Error(`${recipient.label} saw photo revealed before tap`);
  if (photo.url) throw new Error(`${recipient.label} got a URL before reveal`);
  if (!photo.blurDataUrl) throw new Error(`${recipient.label} missing blur placeholder`);

  const reveal = await api(`/api/messages/${message.id}/photos/${photo.photoId}/reveal`, {
    method: "POST",
    cookie: recipient.cookie,
  });
  if (reveal.status !== 200 || !reveal.data.url) {
    throw new Error(
      `${recipient.label} reveal ${reveal.status} ${JSON.stringify(reveal.data)}`
    );
  }

  const after = await api(`/api/conversations/${conversationId}/messages`, {
    cookie: recipient.cookie,
  });
  const afterRows = (after.data.messages as { id: string; photos: PhotoView[] }[]) ?? [];
  const afterPhoto = afterRows.find((m) => m.id === message.id)?.photos[0];
  if (!afterPhoto?.revealed || !afterPhoto.url) {
    throw new Error(`${recipient.label} photo not persisted as revealed`);
  }

  const img = await fetch(afterPhoto.url);
  if (!img.ok) {
    throw new Error(`${recipient.label} revealed URL HTTP ${img.status}`);
  }

  const removed = await api(`/api/photos/${photoId}`, {
    method: "DELETE",
    cookie: sender.cookie,
  });
  if (removed.status !== 200) {
    throw new Error(
      `${sender.label} gallery delete ${removed.status} ${JSON.stringify(removed.data)}`
    );
  }
  const library = await api("/api/photos", { cookie: sender.cookie });
  const remaining = (library.data.photos as { id: string }[]) ?? [];
  if (remaining.some((p) => p.id === photoId)) {
    throw new Error(`${sender.label} gallery still lists deleted photo`);
  }

  const kept = await api(`/api/conversations/${conversationId}/messages`, {
    cookie: recipient.cookie,
  });
  const keptPhoto = ((kept.data.messages as { id: string; photos: PhotoView[] }[]) ?? []).find(
    (m) => m.id === message.id
  )?.photos[0];
  if (!keptPhoto?.revealed || !keptPhoto.url) {
    throw new Error(`${recipient.label} lost sent photo after sender gallery delete`);
  }
}

async function probeSpacesCors() {
  const origin = process.env.PHOTO_TEST_CORS_ORIGIN ?? "https://thebestdrug.com";
  const url = "https://thebestdrug.sfo3.digitaloceanspaces.com/intonow-photos/cors-probe.jpg";
  const res = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  const allow = res.headers.get("access-control-allow-origin");
  const ok = res.ok && (allow === origin || allow === "*");
  console.log(
    `Spaces CORS ${origin}: ${ok ? "PASS" : `WARN HTTP ${res.status} allow=${allow ?? "none"}`}\n`
  );
}

async function cleanup(actors: Actor[]) {
  const { getDb } = await import("../src/lib/db");
  const { users } = await import("../src/lib/schema");
  const { inArray } = await import("drizzle-orm");
  await getDb()
    .delete(users)
    .where(
      inArray(
        users.id,
        actors.map((a) => a.id)
      )
    );
}

async function main() {
  console.log(`Photo DM matrix against ${BASE}\n`);
  await probeSpacesCors();
  const jpeg = await loadFixtureJpeg();
  console.log(`Fixture JPEG ${jpeg.length} bytes\n`);

  const probe = await api("/api/photos", { method: "POST", body: JSON.stringify({}) });
  if (probe.status === 403) {
    throw new Error("Photos are disabled (NEXT_PUBLIC_FEATURE_PHOTO_BLUR is not true)");
  }

  const actors: Actor[] = [];
  let failed = 0;
  try {
    const anonA = await createAnonymous("anon-A");
    const anonB = await createAnonymous("anon-B");
    const regC = await createRegistered("reg-C");
    const regD = await createRegistered("reg-D");
    actors.push(anonA, anonB, regC, regD);

    const pairs: [Actor, Actor][] = [
      [anonA, anonB],
      [anonA, regC],
      [regC, anonB],
      [regC, regD],
    ];

    for (const [sender, recipient] of pairs) {
      const name = `${sender.kind} ${sender.label} → ${recipient.kind} ${recipient.label}`;
      try {
        const photoId = await uploadReadyPhoto(sender, jpeg);
        await sendAndReceive(sender, recipient, photoId);
        console.log(`PASS  ${name}`);
      } catch (error) {
        failed += 1;
        console.log(`FAIL  ${name}`);
        console.log(`      ${error instanceof Error ? error.message : error}`);
      }
    }
  } finally {
    if (actors.length > 0) {
      try {
        await cleanup(actors);
      } catch (error) {
        console.log(`cleanup warning: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
  console.log("\nAll four send/receive paths passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
