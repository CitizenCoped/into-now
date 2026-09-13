import { loadEnv } from "./loadEnv";

loadEnv();

async function main() {
  const { getAppUrl } = await import("../src/lib/appUrl");
  const { getDb } = await import("../src/lib/db");
  const { generateInviteToken, hashToken, INVITE_TTL_MS } = await import(
    "../src/lib/managementAuth"
  );
  const { adminInvites } = await import("../src/lib/schema");

  const raw = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await getDb().insert(adminInvites).values({
    tokenHash: hashToken(raw),
    expiresAt,
  });

  const url = `${getAppUrl()}/management/setup?token=${encodeURIComponent(raw)}`;

  console.log("");
  console.log("Single-use admin setup URL (expires in 1 hour, shown once):");
  console.log("");
  console.log(url);
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
