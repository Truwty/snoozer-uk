import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set the target Supabase URL and server credential.");
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== "--retry-failed")) {
  throw new Error("Usage: npm run cleanup:avatars -- [--retry-failed]");
}

const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
});

async function rpc(name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`Cleanup database operation failed (${name}).`);
  return data;
}

async function removeObjects(scope, bucketName, validName) {
  const bucket = client.storage.from(bucketName);
  for (let batch = 0; batch < 5; batch++) {
    const { data, error } = await bucket.list(scope, { limit: 100 });
    if (error || !data || data.some(({ name }) => !validName.test(name))) return false;
    if (data.length === 0) return true;
    const { error: removeError } = await bucket.remove(data.map(({ name }) => scope + "/" + name));
    if (removeError) return false;
  }
  const { data: remaining, error: listError } = await bucket.list(scope, { limit: 1 });
  return !listError && remaining?.length === 0;
}

if (args.includes("--retry-failed")) {
  console.log(`Requeued ${await rpc("retry_avatar_cleanup")} failed jobs.`);
}

let completed = 0;
let failed = 0;
for (let index = 0; index < 10; index++) {
  const job = await rpc("claim_avatar_cleanup");
  if (!job) break;
  let success = false;
  try {
    const results = await Promise.all([
      removeObjects(job.scope, "avatar-incoming", /^(?:pending|[0-9a-f-]{36}\.upload)$/),
      removeObjects(job.scope, "avatar-images", /^[0-9a-f-]{36}\.webp$/),
      removeObjects(job.scope, "gallery-incoming", /^[0-9a-f-]{36}\.upload$/),
      removeObjects(job.scope, "gallery-images", /^[0-9a-f-]{36}\.webp$/),
    ]);
    success = results.every(Boolean);
  } catch {
    // A transient storage failure is retryable even if one bucket was already cleaned.
  }
  const recorded = await rpc("complete_avatar_cleanup", {
    p_scope: job.scope, p_lease: job.lease_token, p_success: success,
  });
  if (recorded && success) completed++;
  else failed++;
}
console.log(`Avatar cleanup completed: ${completed}; retry or operator attention required: ${failed}.`);
for (const [operation, bucket] of [
  ["find_orphan_avatars", "avatar-images"],
  ["find_abandoned_avatar_uploads", "avatar-incoming"],
]) {
  const keys = await rpc(operation);
  if (!keys.length) continue;
  const { error } = await client.storage.from(bucket).remove(keys);
  if (error) throw new Error("Couldn’t finish the avatar sweep. Run cleanup again to retry.");
  console.log(`Avatar sweep processed ${keys.length} objects in ${bucket}.`);
}
await rpc("collect_gallery_garbage");
for (const bucket of ["gallery-incoming", "gallery-images"]) {
  const keys = await rpc("find_orphan_gallery_objects", { p_bucket: bucket });
  if (!keys.length) continue;
  const { error } = await client.storage.from(bucket).remove(keys);
  if (error) throw new Error("Couldn’t finish the gallery sweep. Run cleanup again to retry.");
  console.log("Gallery sweep processed " + keys.length + " objects in " + bucket + ".");
}
if (failed) process.exitCode = 1;
