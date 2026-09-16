import {
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  S3Client,
  type CORSRule,
} from "@aws-sdk/client-s3";
import { loadEnv } from "./loadEnv";

loadEnv();

const ORIGINS = [
  "https://thebestdrug.com",
  "https://www.thebestdrug.com",
  "https://into-now.vercel.app",
  "http://localhost:3000",
];

const PHOTO_RULE_ID = "intonow-photo-uploads";

function getClient() {
  const key = process.env.DO_SPACES_KEY;
  const secret = process.env.DO_SPACES_SECRET;
  if (!key || !secret) {
    throw new Error("DO_SPACES_KEY / DO_SPACES_SECRET are not set");
  }
  return new S3Client({
    region: process.env.DO_SPACES_REGION ?? "sfo3",
    endpoint: process.env.DO_SPACES_ENDPOINT ?? "https://sfo3.digitaloceanspaces.com",
    credentials: { accessKeyId: key, secretAccessKey: secret },
  });
}

function getBucket() {
  return process.env.DO_SPACES_BUCKET ?? "thebestdrug";
}

const photoRule: CORSRule = {
  ID: PHOTO_RULE_ID,
  AllowedOrigins: ORIGINS,
  AllowedMethods: ["PUT", "GET", "HEAD"],
  AllowedHeaders: ["*"],
  ExposeHeaders: ["ETag", "etag"],
  MaxAgeSeconds: 3600,
};

async function main() {
  const client = getClient();
  const Bucket = getBucket();

  let existing: CORSRule[] = [];
  try {
    const current = await client.send(new GetBucketCorsCommand({ Bucket }));
    existing = current.CORSRules ?? [];
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name !== "NoSuchCORSConfiguration") throw error;
  }

  const kept = existing.filter((rule) => rule.ID !== PHOTO_RULE_ID);
  const CORSRules = [...kept, photoRule];

  await client.send(
    new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: { CORSRules },
    })
  );

  const verify = await client.send(new GetBucketCorsCommand({ Bucket }));
  console.log(`Updated CORS on ${Bucket} (${verify.CORSRules?.length ?? 0} rules)`);
  for (const origin of ORIGINS) {
    const allowed = (verify.CORSRules ?? []).some((rule) =>
      (rule.AllowedOrigins ?? []).includes(origin)
    );
    console.log(`  ${allowed ? "ok" : "MISSING"}  ${origin}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
