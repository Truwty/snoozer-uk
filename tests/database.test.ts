import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { accountPlan, can } from "../src/lib/entitlements";
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
    await db.exec("reset role; truncate snoozer.entitlement_grants, snoozer.profiles, snoozer.profile_revision_floor, snoozer.avatar_cleanup, snoozer.gallery_takedowns, storage.objects cascade;");
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

  it("resolves private, active plan grants and evaluates owner allowances", async () => {
    const current = () => result("select public.get_my_plan() as value");
    await act("anon");
    await expect(current()).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", unverified);
    await expect(current()).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    const free = accountPlan.parse(await current());
    expect(free).toMatchObject({ plan: "free", version: 1, expiresAt: null, usage: { publishedProfiles: 0, draftLinks: 0 } });
    await claim("alice");
    await save(0, "Published Alice", [{ label: "Work", url: "https://example.com" }], true);
    await expect(db.query("select * from snoozer.entitlement_grants")).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
    await db.query(`
      insert into snoozer.entitlement_grants (owner_id,plan,plan_version,source,source_ref,starts_at,expires_at,revoked_at)
      values
        ($1,'plus',1,'gift','alice-plus',now(),now()+interval '2 days',null),
        ($1,'studio',1,'staff','expired',now()-interval '1 day',now(),null),
        ($1,'studio',1,'staff','future',now()+interval '1 day',now()+interval '2 days',null),
        ($1,'pro',1,'staff','revoked',now()-interval '1 day',now()+interval '1 day',now()),
        ($2,'pro',1,'gift','bob-pro',now(),now()+interval '1 day',null),
        ($2,'plus',1,'gift','bob-plus',now(),now()+interval '3 days',null)
    `, [alice, bob]);
    await act("authenticated", alice);
    const plan = accountPlan.parse(await current());
    expect(plan).toMatchObject({ plan: "plus", usage: { publishedProfiles: 1, draftLinks: 1 } });
    const user = { id: alice, plan };
    const resource = { ownerId: alice };
    const feature = { feature: "premiumLayouts" } as const;
    expect(can({ id: alice, plan: free }, feature, resource)).toBe(false);
    expect(can(user, feature, resource)).toBe(true);
    expect(can(user, feature, { ownerId: bob })).toBe(false);
    expect(can(user, feature, resource, Date.parse(plan.expiresAt!))).toBe(false);
    expect(can(user, { quota: "links", used: 99, increment: 1 }, resource)).toBe(true);
    expect(can(user, { quota: "links", used: 100, increment: 1 }, resource)).toBe(false);
    expect(can(user, { quota: "links", used: 100, increment: -1 }, resource)).toBe(false);
    await act("authenticated", bob);
    expect(accountPlan.parse(await current())).toMatchObject({ plan: "pro", usage: { publishedProfiles: 0, draftLinks: 0 } });
  });

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
      username: "alice", display_name: "Published Alice", bio: "Bio", theme: "lagoon", avatar: null, indexable: false, links, sections: [], gallery: [],
    });
    await expect(draft()).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    await db.query("select public.unpublish_profile(2)");
    await act("anon");
    expect(await published("alice")).toBeNull();
  });

  it("snapshots gallery order, authorizes images by publication, and preserves retained media", async () => {
    type Stage = { scope: string; id: string };
    const prepare = (revision: number, alt: string | null, id: string | null = null) =>
      result<Stage>("select public.prepare_gallery_upload($1,$2,$3,$4) as value", [alice, revision, alt, id]);
    const resolve = (id: string, name: string | null, owner: string | null) =>
      result("select public.gallery_object($1,$2,$3) as value", [id, name, owner]);
    const commit = (revision: number, id: string, variant: string) =>
      result("select public.commit_gallery_upload($1,$2,$3,$4,200,100) as value", [alice, revision, id, variant]);
    const add = (revision: number, id: string) => result("select public.add_library_image_to_gallery($1,$2) as value", [revision, id]);
    const edit = (revision: number, id: string, operation: string) =>
      result("select public.edit_gallery($1,$2,$3) as value", [revision, id, operation]);

    await act("authenticated", alice);
    await claim("alice");
    await expect(prepare(0, "First")).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    const first = await prepare(0, "First");
    expect(await resolve(first.id, null, alice)).toBeNull();
    expect(await commit(0, first.id, avatar)).toBe(false);
    expect(await prepare(0, null, first.id)).toMatchObject({ id: first.id });
    expect(await prepare(0, null, first.id)).toBeNull();
    expect(await commit(0, first.id, avatar)).toBe(true);
    expect(await prepare(0, "Stale")).toBeNull();
    const second = await prepare(1, "Second");
    await prepare(1, null, second.id);
    expect(await commit(1, second.id, bob)).toBe(true);
    expect(await resolve(first.id, "alice", null)).toBeNull();
    expect(await resolve(first.id, null, bob)).toBeNull();
    expect(await resolve(first.id, null, alice)).toMatchObject({ scope: first.scope, variant: avatar });

    await act("authenticated", bob);
    await claim("bobby");
    expect(await edit(0, first.id, "remove")).toBe(false);
    await act("authenticated", alice);
    expect(await edit(2, second.id, "earlier")).toBe(true);
    await save(3, "Published gallery", [], true);
    expect(await published("alice")).toMatchObject({ gallery: [
      { id: second.id, alt: "Second", width: 200, height: 100 }, { id: first.id, alt: "First" },
    ] });
    expect(await edit(3, first.id, "remove")).toBe(false);
    expect(await edit(4, first.id, "remove")).toBe(true);
    await save(5, "New gallery", [], true);
    expect(await published("alice")).toMatchObject({ gallery: [{ id: second.id }] });
    await act("service_role");
    expect(await resolve(first.id, "alice", null)).toBeNull();
    expect(await resolve(first.id, null, alice)).not.toBeNull();
    await db.exec("reset role; update snoozer.gallery_items set created_at = now() - interval '2 days';");
    await act("service_role");
    expect(await result("select public.collect_gallery_garbage() as value")).toBe(0);
    const abandoned = await prepare(6, "Abandoned");
    await db.exec("reset role; update snoozer.gallery_items set created_at = now() - interval '2 days' where variant is null;");
    const staleKey = abandoned.scope + "/" + abandoned.id + ".upload";
    await db.query("insert into storage.objects values ('gallery-incoming',$1,now() - interval '2 days')", [staleKey]);
    await act("service_role");
    expect(await result("select public.collect_gallery_garbage() as value")).toBe(1);
    expect(await result("select public.find_orphan_gallery_objects('gallery-incoming') as value")).toEqual([staleKey]);

    await act("authenticated", alice);
    expect(await add(5, first.id)).toBe("changed");
    await act("anon");
    await expect(add(6, first.id)).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", bob);
    expect(await add(0, first.id)).toBe("unavailable");
    await act("authenticated", alice);
    expect(await add(6, first.id)).toBe("added");
    expect(await add(7, first.id)).toBe("unavailable");
    expect(await draft()).toMatchObject({ revision: 7, gallery: [{ id: second.id }, { id: first.id }] });
    expect(await published("alice")).toMatchObject({ gallery: [{ id: second.id }] });
    await db.query("select public.restore_publication(4,7)");
    expect(await draft()).toMatchObject({ revision: 8, gallery: [{ id: second.id }, { id: first.id }] });
    expect(await edit(8, first.id, "remove")).toBe(true);
    await act("service_role");
    for (let revision = 9; revision < 16; revision++) {
      const extra = await prepare(revision, "Extra " + revision);
      await prepare(revision, null, extra.id);
      const variant = await result<string>("select gen_random_uuid() as value");
      expect(await commit(revision, extra.id, variant)).toBe(true);
    }
    await act("authenticated", alice);
    expect(await add(16, first.id)).toBe("limit");
    expect(await draft()).toMatchObject({ revision: 16 });
  });

  it("keeps folder edits private and protects cross-owner and retired media scopes", async () => {
    type Library = { scope: string; revision: number; folders: { id: string; name: string }[]; items: unknown[] };
    const library = () => result<Library>("select public.get_media_folders() as value");
    const edit = (scope: string, revision: number, operation: string, id: string | null = null,
      name: string | null = null, folder: string | null = null) =>
      result("select public.edit_media_folders($1,$2,$3,$4,$5,$6) as value", [scope, revision, operation, id, name, folder]);

    await act("anon");
    await expect(library()).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    await claim("folder-alice");
    const initial = await library();
    expect(initial).toMatchObject({ revision: 0, folders: [], items: [] });
    expect(await edit(initial.scope, 0, "create", null, "   ")).toBe("invalid_name");
    expect(await edit(initial.scope, 0, "create", null, "Unfiled")).toBe("invalid_name");
    expect(await edit(initial.scope, 0, "create", null, "  Work  ")).toBe("saved");
    expect(await edit(initial.scope, 0, "create", null, "Stale")).toBe("changed");
    expect(await edit(initial.scope, 1, "create", null, "WORK")).toBe("duplicate");
    const [work] = (await library()).folders;
    expect(work.name).toBe("Work");

    await act("authenticated", bob);
    await claim("bobby");
    const other = await library();
    expect(other.folders).toEqual([]);
    expect(await edit(initial.scope, 1, "delete", work.id)).toBe("changed");
    expect(await edit(other.scope, 0, "rename", work.id, "Cross owner")).toBe("not_found");
    expect(await edit(other.scope, 0, "create", null, "Work")).toBe("saved");
    const [bobsFolder] = (await library()).folders;
    for (let revision = 1; revision < 12; revision++) {
      expect(await edit(other.scope, revision, "create", null, "Collection " + revision)).toBe("saved");
    }
    expect(await edit(other.scope, 12, "create", null, "Over limit")).toBe("limit");

    await act("service_role");
    const stage = await result<{ id: string }>("select public.prepare_gallery_upload($1,0,'An image') as value", [alice]);
    await act("authenticated", alice);
    expect((await library()).items).toEqual([]);
    expect(await edit(initial.scope, 1, "move", stage.id, null, work.id)).toBe("not_found");
    await act("service_role");
    await result("select public.prepare_gallery_upload($1,0,null,$2) as value", [alice, stage.id]);
    await result("select public.commit_gallery_upload($1,0,$2,$3,200,100) as value", [alice, stage.id, avatar]);
    await act("authenticated", alice);
    await save(1, "Published", [], true);
    const publicSnapshot = await published("folder-alice");
    expect(await edit(initial.scope, 1, "move", stage.id, null, bobsFolder.id)).toBe("not_found");
    expect(await edit(initial.scope, 1, "move", stage.id, null, work.id)).toBe("saved");
    expect(await edit(initial.scope, 2, "rename", work.id, "Portfolio")).toBe("saved");
    expect(await library()).toMatchObject({
      revision: 3, folders: [{ id: work.id, name: "Portfolio" }],
      items: [{ id: stage.id, folder: work.id, in_draft: true }],
    });
    expect(await draft()).toMatchObject({ revision: 2 });
    expect(await published("folder-alice")).toEqual(publicSnapshot);
    await db.query("select public.edit_gallery(2,$1,'remove')", [stage.id]);
    expect((await library()).items).toMatchObject([{ id: stage.id, folder: work.id, in_draft: false }]);
    expect(await edit(initial.scope, 3, "delete", work.id)).toBe("saved");
    expect(await library()).toMatchObject({ folders: [], items: [{ id: stage.id, folder: null }] });
    expect(await published("folder-alice")).toEqual(publicSnapshot);

    expect(await edit(initial.scope, 4, "create", null, "Before deletion")).toBe("saved");
    const [remaining] = (await library()).folders;
    expect(await edit(initial.scope, 5, "move", stage.id, null, remaining.id)).toBe("saved");
    await db.query("select public.delete_profile(3,'folder-alice')");
    await claim("alice-new");
    const replacement = await library();
    expect(replacement).toMatchObject({ revision: 0, folders: [], items: [] });
    expect(await edit(initial.scope, 0, "create", null, "From stale tab")).toBe("changed");
  });

  it("limits gallery capacity and counts only new upload attempts against the daily allowance", async () => {
    type Stage = { id: string };
    const prepare = (revision: number, alt: string | null, id: string | null = null) =>
      result<Stage>("select public.prepare_gallery_upload($1,$2,$3,$4) as value", [alice, revision, alt, id]);
    await act("authenticated", alice);
    await claim("alice");
    await act("service_role");
    let lastId = "";
    for (let revision = 0; revision < 8; revision++) {
      const stage = await prepare(revision, "Image");
      lastId = stage.id;
      expect(await prepare(revision, "Image")).toEqual(stage);
      await prepare(revision, null, stage.id);
      expect(await result(
        "select public.commit_gallery_upload($1,$2,$3,gen_random_uuid(),200,100) as value",
        [alice, revision, stage.id],
      )).toBe(true);
    }
    await expect(prepare(8, "Ninth image")).rejects.toMatchObject({ code: "P1101" });
    await act("authenticated", alice);
    expect(await result("select public.edit_gallery(8,$1,'remove') as value", [lastId])).toBe(true);
    await act("service_role");
    for (let attempt = 0; attempt < 4; attempt++) {
      const stage = await prepare(9, "Retryable");
      expect(await prepare(9, "Retryable")).toEqual(stage);
      await result("select public.discard_gallery_upload($1,9,$2) as value", [alice, stage.id]);
    }
    await expect(prepare(9, "Over quota")).rejects.toMatchObject({ code: "P1103" });
  });

  it("audits gallery takedowns and prevents republishing a blocked image from history", async () => {
    const takeDown = (name: string, id: string, ref: string) =>
      result("select public.take_down_gallery_image($1,$2,$3) as value", [name, id, ref]);
    await act("authenticated", alice);
    await claim("alice");
    await act("service_role");
    const stage = await result<{ id: string }>("select public.prepare_gallery_upload($1,0,'Image') as value", [alice]);
    await result("select public.prepare_gallery_upload($1,0,null,$2) as value", [alice, stage.id]);
    await result("select public.commit_gallery_upload($1,0,$2,$3,200,100) as value", [alice, stage.id, avatar]);
    await act("authenticated", alice);
    await save(1, "Published", [], true);
    await expect(takeDown("alice", stage.id, "CASE-123")).rejects.toMatchObject({ code: "42501" });

    await act("service_role");
    await expect(takeDown("alice", stage.id, "contains spaces")).rejects.toMatchObject({ code: "22023" });
    expect(await takeDown("bobby", stage.id, "CASE-123")).toBe("not_found");
    expect(await takeDown("alice", stage.id, "CASE-123")).toBe("blocked");
    expect(await takeDown("alice", stage.id, "CASE-999")).toBe("already_blocked");
    expect(await result("select public.gallery_object($1,'alice') as value", [stage.id])).toBeNull();
    expect(await result("select public.gallery_object($1,null,$2) as value", [stage.id, alice])).toBeNull();
    await act("anon");
    expect(await published("alice")).toMatchObject({ gallery: [] });
    await act("authenticated", alice);
    expect(await draft()).toMatchObject({ gallery: [], revision: 3 });
    expect(await result("select public.add_library_image_to_gallery(3,$1) as value", [stage.id])).toBe("unavailable");
    expect(await result("select public.get_publication(2) as value")).toMatchObject({ gallery: [] });
    await db.query("select public.restore_publication(2,3)");
    await save(4, "Restored", [], true);
    expect(await published("alice")).toMatchObject({ gallery: [] });

    await db.exec("reset role");
    expect(await result("select count(*)::int as value from snoozer.published_gallery")).toBe(1);
    expect(await result("select case_reference as value from snoozer.gallery_takedowns")).toBe("CASE-123");
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

  it("rotates staging keys, rejects retired attempts and expires only old uploads", async () => {
    await act("authenticated", alice);
    await claim("staging-alice");
    await expect(db.query("select public.prepare_avatar_upload($1,0,true)", [alice])).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    const prepare = (open: boolean) =>
      result<{ key: string | null; scope: string }>("select public.prepare_avatar_upload($1,0,$2) as value", [alice, open]);
    const clear = (key: string) => result("select public.clear_avatar_upload($1,0,$2) as value", [alice, key]);
    expect((await prepare(false))?.key).toBeNull();
    const initial = (await prepare(true))!;
    expect(initial.key).toMatch(/\.upload$/);
    expect(await prepare(true)).toEqual(initial);
    expect(await clear(initial.key!)).toBe(true);
    const next = (await prepare(true))!;
    expect(next.key).not.toBe(initial.key);
    expect(await clear(initial.key!)).toBe(false);
    expect(await result("select public.commit_avatar_upload($1,0,$2,$3) as value", [alice, initial.key, avatar])).toBe(false);

    await db.exec("reset role");
    await db.query(`insert into storage.objects values
      ('avatar-incoming',$1,now()-interval '2 days'),
      ('avatar-incoming',$2,now()-interval '2 days'),
      ('avatar-incoming',$3,now())`, [
      `${initial.scope}/${initial.key}`,
      `${next.scope}/${next.key}`,
      `${next.scope}/pending`,
    ]);
    await act("service_role");
    expect(await result("select public.find_abandoned_avatar_uploads() as value")).toEqual([`${initial.scope}/${initial.key}`]);
    await db.exec("reset role; update snoozer.profiles set avatar_upload_started_at = now() - interval '2 days';");
    await act("service_role");
    expect((await prepare(false))?.key).toBeNull();
    expect(await result("select public.commit_avatar_upload($1,0,$2,$3) as value", [alice, next.key, avatar])).toBe(false);
    expect(await result("select public.find_abandoned_avatar_uploads() as value"))
      .toEqual(expect.arrayContaining([`${initial.scope}/${initial.key}`, `${next.scope}/${next.key}`]));
    const newest = (await prepare(true))!;
    expect(newest.key).not.toBe(next.key);
    expect(await result("select public.commit_avatar_upload($1,0,$2,$3) as value", [alice, newest.key, avatar])).toBe(true);
  });

  it("limits new upload attempts without charging retries against the quota", async () => {
    await act("authenticated", alice);
    await claim("quota-alice");
    await act("service_role");
    const open = () => result<{ key: string }>("select public.prepare_avatar_upload($1,0,true) as value", [alice]);
    for (let i = 0; i < 12; i++) {
      const attempt = (await open())!;
      expect(await open()).toEqual(attempt);
      await result("select public.clear_avatar_upload($1,0,$2) as value", [alice, attempt.key]);
    }
    await expect(open()).rejects.toMatchObject({ code: "P1003" });
  });

  it("accepts only built-in appearance tokens and restores the saved appearance", async () => {
    const compact = { density: "compact", corners: "square", layout: "editorial", accent: "ink", entrance: "fade" };
    const defaults = { density: "balanced", corners: "soft" };
    const write = (expected: number, publish: boolean, appearance: unknown) => result(
      "select public.save_profile($1,'Alice','Bio','lagoon',false,'[]',$2,false,null,$3) as value",
      [expected, publish, JSON.stringify(appearance)],
    );
    await act("authenticated", alice);
    await claim("appearance-alice");
    await expect(write(0, true, { ...compact, corners: "url(https://example.org)" }))
      .rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, { ...compact, color: "red" })).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, { density: "airy" })).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, { ...compact, layout: "arbitrary-grid" })).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, { ...compact, layout: null })).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, "editorial")).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, { ...compact, accent: "#010203" })).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, { ...compact, accent: null })).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, { ...compact, entrance: "bounce" })).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, null)).rejects.toMatchObject({ code: "22023" });
    expect(await draft()).toMatchObject({ revision: 0 });

    await write(0, false, compact);
    expect(await draft()).toMatchObject({ appearance: compact });
    expect(await published("appearance-alice")).toBeNull();
    await save(1, "Compatible save", [], true);
    await write(2, false, { density: "airy", corners: "round" });
    expect(await published("appearance-alice")).toMatchObject({ appearance: compact });
    await write(3, true, defaults);
    expect(await published("appearance-alice")).not.toHaveProperty("appearance");
    await db.query("select public.restore_publication(2,4)");
    expect(await draft()).toMatchObject({ revision: 5, appearance: compact });
    expect(await published("appearance-alice")).not.toHaveProperty("appearance");
  });

  it("restores private section locks and keeps them out of public profiles", async () => {
    const section = { heading: "Projects", body: "Current work." };
    const write = (expected: number, publish: boolean, item: unknown) =>
      result("select public.save_profile($1,'Alice','Bio','lagoon',false,'[]',$2,false,$3) as value",
        [expected, publish, JSON.stringify([item])]);
    await act("authenticated", alice);
    await claim("section-locks");
    await expect(write(0, true, { ...section, locked: "true" })).rejects.toMatchObject({ code: "22023" });
    await write(0, true, { ...section, locked: true });
    await expect(write(1, false, section)).rejects.toMatchObject({ code: "22023" });
    expect(await draft()).toMatchObject({ revision: 1, sections: [{ ...section, locked: true }] });
    expect(await result("select public.get_publication(1) as value")).toMatchObject({ sections: [{ ...section, locked: true }] });
    await act("anon");
    expect((await published("section-locks"))).toMatchObject({ sections: [section] });
    expect((await published("section-locks"))).not.toHaveProperty("sections.0.locked");
    await act("authenticated", alice);
    await write(1, false, { ...section, locked: false });
    expect(await draft()).not.toHaveProperty("sections.0.locked");
    await db.query("select public.restore_publication(1,2)");
    expect(await draft()).toMatchObject({ revision: 3, sections: [{ ...section, locked: true }] });
  });

  it("retains hidden sections privately and excludes them from public responses", async () => {
    const section = { heading: "Planning", body: "Owner-only draft notes." };
    const hidden = { ...section, hidden: true };
    const write = (revision: number, publish: boolean, sections: unknown) =>
      result("select public.save_profile($1,'Alice','Bio','lagoon',false,'[]',$2,false,$3) as value",
        [revision, publish, JSON.stringify(sections)]);
    await act("authenticated", alice);
    await claim("section-visibility");
    await expect(write(0, true, [{ ...section, hidden: "true" }])).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, [{ ...section, hidden: null }])).rejects.toMatchObject({ code: "22023" });
    await write(0, true, [section]);
    await write(1, false, [hidden]);
    await expect(write(2, true, [section])).rejects.toMatchObject({ code: "22023" });
    expect(await draft()).toMatchObject({ revision: 2, sections: [hidden] });
    expect(await published("section-visibility")).toMatchObject({ sections: [section] });
    await save(2, "Publish draft", [], true);
    expect(await result("select public.get_publication(3) as value")).toMatchObject({ sections: [hidden] });
    await act("anon");
    expect(await published("section-visibility")).toMatchObject({ sections: [] });
    await expect(db.query("select public.get_publication(3)")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", bob);
    expect(await result("select public.get_publication(3) as value")).toBeNull();
    await act("authenticated", alice);
    await db.query("select public.restore_publication(1,3)");
    expect(await draft()).toMatchObject({ revision: 4, sections: [section] });
    await db.query("select public.restore_publication(3,4)");
    expect(await draft()).toMatchObject({ revision: 5, sections: [hidden] });
    expect(await published("section-visibility")).toMatchObject({ sections: [] });
    await write(5, true, [{ ...section, hidden: false }]);
    expect(await published("section-visibility")).toMatchObject({ sections: [section] });
  });

  it("validates text sections and snapshots them only on publish", async () => {
    await act("authenticated", alice);
    await claim("sections-alice");
    const write = (expected: number, publish: boolean, sections: unknown) => result(
      "select public.save_profile($1,'Alice','Bio','lagoon',false,'[]',$2,false,$3) as value",
      [expected, publish, JSON.stringify(sections)],
    );
    const first = { heading: "About", body: "One line.\nA second line." };
    const second = { heading: "Updates", body: "Plain text <strong>example</strong>.", kind: "callout" };
    const quote = { heading: "Project notebook", body: "Always leave a little room.", kind: "quote" };
    const countdown = { heading: "Launch", body: "Save the date.", kind: "countdown", target: "2028-02-29T18:15" };
    await expect(write(0, true, [{ ...countdown, target: "2027-02-29T18:15" }])).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, [{ ...countdown, target: "2028-02-29T24:00" }])).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, [{ ...countdown, target: null }])).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, [{ ...first, target: countdown.target }])).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, [{ ...first, kind: "raw-html" }])).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, [{ ...first, kind: null }])).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, [{ heading: 5, body: "Value" }])).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, [{ heading: " \t ", body: "Value" }])).rejects.toMatchObject({ code: "22023" });
    await expect(write(0, true, Array.from({ length: 7 }, () => first))).rejects.toMatchObject({ code: "22023" });
    expect(await draft()).toMatchObject({ revision: 0, sections: [] });
    expect(await published("sections-alice")).toBeNull();

    await write(0, true, [first, second, quote, countdown]);
    await write(1, false, [countdown, quote, second, first]);
    expect(await draft()).toMatchObject({ revision: 2, sections: [countdown, quote, second, first] });
    await act("anon");
    expect(await published("sections-alice")).toMatchObject({ sections: [first, second, quote, countdown] });
    await expect(db.query("select public.get_publication(1)")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", bob);
    await claim("sections-bob");
    expect(await result("select public.get_publication(1) as value")).toBeNull();
    await expect(db.query("select * from snoozer.sections")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    await save(2, "Legacy client", [], true); // An older client omits the new argument.
    expect(await published("sections-alice")).toMatchObject({ sections: [countdown, quote, second, first] });
    await db.query("select public.restore_publication(1,3)");
    expect(await draft()).toMatchObject({ revision: 4, sections: [first, second, quote, countdown] });
    expect(await published("sections-alice")).toMatchObject({ sections: [countdown, quote, second, first] });
    await write(4, true, []);
    expect(await published("sections-alice")).toMatchObject({ sections: [] });
  });
});
