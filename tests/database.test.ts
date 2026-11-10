import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { publicationList, publicationPreview } from "../src/lib/publication";

const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const unverified = "00000000-0000-4000-8000-000000000003";
const avatar = "00000000-0000-4000-8000-000000000011";

describe("real SQL migrations on embedded PostgreSQL", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    // The embedded database provides PostgreSQL. These adapters supply the Supabase
    // roles, identity accessor and bucket catalogue normally provided by the local stack.
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(bucket_id text, name text, created_at timestamptz);
      insert into auth.users values ('${alice}', now()), ('${bob}', now()), ('${unverified}', null);
    `);
    const migrations = await readdir(new URL("../supabase/migrations/", import.meta.url));
    for (const filename of migrations.filter((entry) => entry.endsWith(".sql")).sort()) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8"));
    }
  });

  afterAll(async () => { await db?.close(); });

  beforeEach(async () => {
    await db.exec("reset role; truncate snoozer.profiles, snoozer.profile_revision_floor, snoozer.avatar_cleanup, storage.objects cascade;");
  });

  async function act(role: "anon" | "authenticated" | "service_role", id = "") {
    await db.exec(`set role ${role};`);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  }

  async function result<T = unknown>(sql: string, args: unknown[] = []) {
    return (await db.query<{ value: T }>(sql, args)).rows[0]?.value;
  }

  const claim = (name: string) => db.query("select public.claim_profile($1)", [name]);
  const published = (name: string) => result("select public.get_published_profile($1) as value", [name]);
  const draft = () => result("select public.get_draft() as value");
  const save = (expected: number, display: string, links: unknown, publish: boolean) =>
    result("select public.save_profile($1,$2,'Bio','lagoon',false,$3,$4,false) as value", [expected, display, JSON.stringify(links), publish]);

  it("protects reserved names and restricts claim to verified users", async () => {
    await act("anon");
    expect(await result("select public.username_available('studio') as value")).toBe(false);
    await expect(claim("alice")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", unverified);
    await expect(claim("alice")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    await expect(claim("studio")).rejects.toMatchObject({ code: "23505" });
    await expect(claim("Alice")).rejects.toMatchObject({ code: "23505" });
  });

  it("enforces global uniqueness and one address per owner", async () => {
    await act("authenticated", alice);
    await claim("alice");
    await expect(claim("second")).rejects.toMatchObject({ code: "23505" });
    await act("authenticated", bob);
    await expect(claim("alice")).rejects.toMatchObject({ code: "23505" });
    expect(await draft()).toBeNull();
    await expect(db.query("select * from snoozer.profiles")).rejects.toMatchObject({ code: "42501" });
  });

  it("publishes ordered links atomically and protects private revisions", async () => {
    const links = [{ label: "Work", url: "https://example.com/work" }, { label: "Other", url: "https://example.com/" }];
    await act("authenticated", alice);
    await claim("alice");
    expect(await published("alice")).toBeNull();
    expect(await result("select public.published_profile_exists('alice') as value")).toBe(false);
    await save(0, "Published Alice", links, true);
    expect(await result("select public.published_profile_exists('alice') as value")).toBe(true);
    await save(1, "Private Alice", [...links].reverse(), false);
    await expect(save(1, "Stale write", links, true)).rejects.toMatchObject({ code: "40001" });
    expect(await draft()).toMatchObject({ display_name: "Private Alice", revision: 2, links: [...links].reverse() });
    await act("authenticated", bob);
    expect(await draft()).toBeNull();
    await expect(save(2, "Cross-user overwrite", [], true)).rejects.toMatchObject({ code: "40001" });
    await act("anon");
    expect(await published("alice")).toEqual({
      username: "alice", display_name: "Published Alice", bio: "Bio", theme: "lagoon", avatar: null, indexable: false, links,
    });
    await expect(draft()).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    await db.query("select public.unpublish_profile(2)");
    await act("anon");
    expect(await published("alice")).toBeNull();
  });

  it("rejects unsafe links from direct RPC clients without changing the revision", async () => {
    await act("authenticated", alice);
    await claim("alice");
    for (const url of ["javascript:alert(1)", "https://127.0.0.1/", "https://foo.local", "https://example.com:70000", "https://example.com/a\\b"]) {
      await expect(save(0, "Unsafe", [{ label: "Bad", url }], true)).rejects.toMatchObject({ code: "22023" });
    }
    expect(await draft()).toMatchObject({ revision: 0, links: [] });
    expect(await published("alice")).toBeNull();
  });

  it("restricts avatar mutation and public file lookup to the service role and active publication", async () => {
    await act("authenticated", alice);
    await claim("alice");
    await expect(db.query("select public.set_avatar($1,0,$2)", [alice, avatar])).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    expect(await result("select public.begin_avatar_processing($1,0) as value", [alice])).toBe(true);
    expect(await result("select public.begin_avatar_processing($1,0) as value", [alice])).toBe(false);
    expect(await result("select public.set_avatar($1,0,$2) as value", [alice, avatar])).toBe(true);
    const owner = () => result("select public.published_avatar_owner('alice',$1) as value", [avatar]);
    expect(await owner()).toBeNull();
    await act("authenticated", alice);
    await save(1, "Alice", [], true);
    await act("service_role");
    expect(await owner()).toBe(alice);
    await act("authenticated", alice);
    await db.query("select public.unpublish_profile(2)");
    await act("service_role");
    expect(await owner()).toBeNull();
  });

  it("deletes only the current owner’s confirmed revision and isolates a replacement", async () => {
    await act("authenticated", alice);
    await claim("retire-alice");
    const scope = await result("select public.draft_media_scope(0) as value");
    expect(scope).toBeTruthy();
    await save(0, "Published Alice", [{ label: "Work", url: "https://example.com/" }], true);
    await act("authenticated", bob);
    await expect(db.query("select public.delete_profile(1, 'retire-alice')")).rejects.toMatchObject({ code: "40001" });
    await act("authenticated", alice);
    await expect(db.query("select public.delete_profile(0, 'retire-alice')")).rejects.toMatchObject({ code: "40001" });
    await expect(db.query("select public.delete_profile(1, 'wrong-name')")).rejects.toMatchObject({ code: "40001" });
    await db.query("select public.delete_profile(1, 'retire-alice')");
    expect(await draft()).toBeNull();
    expect(await published("retire-alice")).toBeNull();
    await act("authenticated", bob);
    await expect(claim("retire-alice")).rejects.toMatchObject({ code: "23505" });
    await act("authenticated", alice);
    await claim("alice-again");
    expect(await draft()).toMatchObject({ username: "alice-again", revision: 2, links: [] });
    expect(await result("select public.draft_media_scope(2) as value")).not.toBe(scope);
    await expect(save(1, "Stale", [], true)).rejects.toMatchObject({ code: "40001" });
    await db.query("select public.delete_profile(2, 'alice-again')");
    await expect(claim("alice-third")).rejects.toMatchObject({ code: "P1001" });
    await db.exec("reset role");
    const { rows } = await db.query("select * from snoozer.published_profiles");
    expect(rows).toHaveLength(0);
  });

  it("queues cleanup durably, delays for signed uploads, leases and retries safely", async () => {
    await act("authenticated", alice);
    await claim("cleanup-alice");
    const scope = await result("select public.draft_media_scope(0) as value");
    await db.query("select public.delete_profile(0, 'cleanup-alice')");
    await expect(db.query("select public.claim_avatar_cleanup()")).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    const lease = () => result<{ scope: string; lease_token: string }>("select public.claim_avatar_cleanup() as value");
    const finish = (token: string, success: boolean) =>
      result("select public.complete_avatar_cleanup($1,$2,$3) as value", [scope, token, success]);
    const makeDue = async () => {
      await db.exec("reset role; update snoozer.avatar_cleanup set available_at = clock_timestamp();");
      await act("service_role");
    };
    expect(await lease()).toBeNull();
    await makeDue();
    const first = (await lease())!;
    expect(first.scope).toBe(scope);
    expect(await lease()).toBeNull();
    await makeDue(); // Simulate a crashed worker whose lease expired.
    const second = (await lease())!;
    expect(second.lease_token).not.toBe(first.lease_token);
    expect(await finish(first.lease_token, true)).toBe(false);
    expect(await finish(second.lease_token, false)).toBe(true);
    expect(await lease()).toBeNull();
    for (let i = 1; i < 8; i++) {
      await makeDue();
      expect(await finish((await lease())!.lease_token, false)).toBe(true);
    }
    await makeDue();
    expect(await lease()).toBeNull();
    expect(await result("select public.retry_avatar_cleanup() as value")).toBe(1);
    expect(await finish((await lease())!.lease_token, true)).toBe(true);
    expect(await lease()).toBeNull();
  });

  it("scopes publication history to its owner and restores only the draft", async () => {
    const links = [{ label: "Original", url: "https://example.com/original" }];
    await act("authenticated", alice);
    await claim("history-alice");
    await save(0, "First publication", links, true);
    await save(1, "Second publication", [], true);
    const getVersion = () => result("select public.get_publication(1) as value");
    const restore = (expected: number) => db.query("select public.restore_publication(1,$1)", [expected]);
    expect(publicationList.parse(await result("select public.list_publications() as value"))).toMatchObject([
      { revision: 2, live: true }, { revision: 1, live: false },
    ]);
    expect(publicationPreview.parse(await getVersion())).toMatchObject({ display_name: "First publication", draft_revision: 2, links });
    await act("authenticated", bob);
    await claim("history-bob");
    expect(await getVersion()).toBeNull();
    await expect(restore(0)).rejects.toMatchObject({ code: "P1002" });
    await act("anon");
    await expect(getVersion()).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    await expect(restore(1)).rejects.toMatchObject({ code: "40001" });
    await restore(2);
    expect(await draft()).toMatchObject({ revision: 3, published_revision: 2, display_name: "First publication", links });
    expect(await published("history-alice")).toMatchObject({ display_name: "Second publication", links: [] });
    expect(await getVersion()).toMatchObject({ revision: 1, display_name: "First publication", links });
    await save(3, "First publication", links, true);
    expect(await published("history-alice")).toMatchObject({ display_name: "First publication", links });
  });

  it("sweeps only old processed avatars outside the draft and every retained publication", async () => {
    const draftAvatar = "00000000-0000-4000-8000-000000000012";
    const orphan = "00000000-0000-4000-8000-000000000013";
    const fresh = "00000000-0000-4000-8000-000000000014";
    const draftOnly = "00000000-0000-4000-8000-000000000015";
    await act("authenticated", alice);
    await claim("sweep-alice");
    const scope = await result<string>("select public.draft_media_scope(0) as value");
    await act("service_role");
    await db.query("select public.set_avatar($1,0,$2)", [alice, avatar]);
    await act("authenticated", alice);
    await save(1, "Old publication", [], true);
    await act("service_role");
    await db.query("select public.set_avatar($1,2,$2)", [alice, draftAvatar]);
    await act("authenticated", alice);
    await save(3, "Current publication", [], true);
    await act("service_role");
    await db.query("select public.set_avatar($1,4,$2)", [alice, draftOnly]);
    await act("authenticated", alice);
    await expect(db.query("select public.find_orphan_avatars()")).rejects.toMatchObject({ code: "42501" });

    await db.exec("reset role");
    await db.query(`insert into storage.objects values
      ('avatar-images', $1, now() - interval '2 days'),
      ('avatar-images', $2, now() - interval '2 days'),
      ('avatar-images', $3, now() - interval '2 days'),
      ('avatar-images', $4, now()),
      ('avatar-images', $5, now() - interval '2 days'),
      ('avatar-images', $6, now() - interval '2 days'),
      ('avatar-incoming', $7, now() - interval '2 days')`,
    [avatar, draftAvatar, orphan, fresh].map((id) => `${scope}/${id}.webp`)
      .concat([`${scope}/unexpected.webp`, `${scope}/${draftOnly}.webp`, `${scope}/pending`]));
    await act("service_role");
    expect(await result("select public.find_orphan_avatars() as value")).toEqual([`${scope}/${orphan}.webp`]);
  });
});
