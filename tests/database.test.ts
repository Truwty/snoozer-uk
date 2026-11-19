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
      create table auth.users(id uuid primary key, email_confirmed_at timestamptz, created_at timestamptz default now(), raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(bucket_id text, name text, created_at timestamptz);
      alter table storage.objects add column metadata jsonb;
      insert into auth.users(id,email_confirmed_at) values ('${alice}', now()), ('${bob}', now()), ('${unverified}', null);
    `);
    const migrations = await readdir(new URL("../supabase/migrations/", import.meta.url));
    for (const filename of migrations.filter((entry) => entry.endsWith(".sql")).sort()) {
      if (filename.startsWith("20261110004600")) {
        await act("authenticated", alice);
        await claim("legacy");
        await save(0, "Legacy profile", [{ label: "Work", url: "https://example.com" }], true);
        await db.exec("reset role");
      }
      try {
        await db.exec(await readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8"));
      } catch (error) {
        throw new Error(`Migration ${filename} failed`, { cause: error });
      }
      if (filename.startsWith("20261110004600")) {
        expect(await result(`select p.id = l.profile_id and p.id = s.profile_id and p.id = pl.profile_id as value
          from snoozer.profiles p join snoozer.links l using (owner_id)
          join snoozer.published_profiles s on s.owner_id = p.owner_id and s.revision = p.published_revision
          join snoozer.published_links pl on pl.owner_id = s.owner_id and pl.revision = s.revision
          where p.username = 'legacy'`)).toBe(true);
        expect(await published("legacy")).toMatchObject({ display_name: "Legacy profile", links: [{ label: "Work" }] });
      }
    }
  });

  afterAll(async () => { await db?.close(); });

  beforeEach(async () => {
    await db.exec("reset role; truncate snoozer.creator_sandbox_accounts cascade;");
    await db.exec("update snoozer.creator_sandbox_policy set enabled=false,platform_id=null");
    await db.exec("reset role; truncate snoozer.public_widget_cache, snoozer.public_widget_limits, snoozer.stripe_sandbox_won_disputes, snoozer.stripe_sandbox_gift_payment_holds, snoozer.stripe_sandbox_gift_orders, snoozer.stripe_sandbox_gift_offers, snoozer.billing_diagnostics_access, snoozer.staff_roles, snoozer.gift_codes, snoozer.kofi_donation_reviews, snoozer.kofi_donation_receipts, snoozer.stripe_sandbox_ended_subscriptions, snoozer.stripe_sandbox_expired_checkouts, snoozer.stripe_sandbox_invoice_holds, snoozer.stripe_webhook_receipts, snoozer.stripe_sandbox_checkout_attempts, snoozer.stripe_sandbox_prices, snoozer.entitlement_grants, snoozer.profiles, snoozer.profile_revision_floor, snoozer.avatar_cleanup, snoozer.gallery_takedowns, storage.objects cascade;");
    await db.exec("truncate snoozer.referral_attributions, snoozer.referral_codes; update auth.users set created_at=now(),raw_user_meta_data='{}';");
    await db.exec("truncate snoozer.public_names; insert into snoozer.public_names select name from snoozer.reserved_names;");
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

  const saveProduct = (profile: string, id: string | null = null, revision = 0, archived = false, amount = 500) =>
    result<string>("select public.save_product_draft($1,$2,$3,'Creator guide','Plain text description',$4,$5) as value", [profile, id, revision, amount, archived]);

  it("keeps product drafts private and rejects cross-owner writes and stale revisions", async () => {
    await act("authenticated", alice); await claim("product-alice");
    const profile = (await draft() as { profile_id: string }).profile_id;
    const id = await saveProduct(profile);
    expect(await result("select public.list_my_product_drafts($1) as value", [profile])).toMatchObject({ activeUsed: 1, items: [{ id, title: "Creator guide", amount: 500, revision: 0 }] });
    await saveProduct(profile, id, 0, true);
    await expect(saveProduct(profile, id, 0)).rejects.toMatchObject({ code: "40001" });
    await act("authenticated", bob);
    await expect(saveProduct(profile, id, 1)).rejects.toMatchObject({ code: "42501" });
    await expect(result("select public.list_my_product_drafts($1) as value", [profile])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select * from snoozer.product_drafts")).rejects.toMatchObject({ code: "42501" });
    await act("anon");
    await expect(result("select public.list_my_product_drafts($1) as value", [profile])).rejects.toMatchObject({ code: "42501" });
    await expect(saveProduct(profile)).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    await expect(saveProduct(profile)).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice); await save(0, "Public creator", [], true);
    expect(JSON.stringify(await published("product-alice"))).not.toContain("Creator guide");
  });

  it("bounds account product slots, supports reversible archive and enforces the total cap", async () => {
    await act("authenticated", alice); await claim("product-quota");
    const profile = (await draft() as { profile_id: string }).profile_id;
    const first = await saveProduct(profile);
    for (let i=0; i<4; i++) await saveProduct(profile);
    await expect(saveProduct(profile)).rejects.toMatchObject({ code: "P1201" });
    await saveProduct(profile, first, 0, true);
    await saveProduct(profile);
    await expect(saveProduct(profile, first, 1, false)).rejects.toMatchObject({ code: "P1201" });
    for (let i=0; i<14; i++) await saveProduct(profile, null, 0, true);
    await expect(saveProduct(profile, null, 0, true)).rejects.toMatchObject({ code: "P1201" });
    expect(await result("select public.list_my_product_drafts($1) as value", [profile])).toMatchObject({ activeUsed: 5, totalUsed: 20 });
    await db.exec("reset role");
    await db.query("insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at) values($1,'pro',1,'staff','product-plan',now()-interval '1 minute',now()+interval '1 day')", [alice]);
    await act("authenticated", alice);
    const second = await result<string>("select public.claim_additional_profile('product-secondary') as value");
    await expect(saveProduct(second!)).rejects.toMatchObject({ code: "P1201" });
    expect(await result("select public.list_my_product_drafts($1) as value", [second])).toMatchObject({ activeUsed: 5, totalUsed: 20, items: [] });
  });

  it("validates product prices and text at the database boundary and cascades only private drafts", async () => {
    await act("authenticated", alice); await claim("product-validation");
    const profile = (await draft() as { profile_id: string }).profile_id;
    for (const amount of [0,49,100001]) await expect(saveProduct(profile, null, 0, false, amount)).rejects.toMatchObject({ code: "22023" });
    for (const title of [" ", "a".repeat(101), "Invalid\nline"]) await expect(result("select public.save_product_draft($1,null,0,$2,'',50,false) as value", [profile,title])).rejects.toMatchObject({ code: "22023" });
    await saveProduct(profile, null, 0, false, 50);
    await saveProduct(profile, null, 0, false, 100000);
    await db.query("select public.delete_profile($1,0,'product-validation')", [profile]);
    await db.exec("reset role");
    expect(await result("select count(*)::integer as value from snoozer.product_drafts")).toBe(0);
  });

  async function productFileFixture(name="private-pdf") {
    await act("authenticated", alice); await claim(name);
    const profile = (await draft() as { profile_id: string }).profile_id;
    const product = (await saveProduct(profile))!;
    await act("service_role");
    const file = (await result<{ id: string; scope: string; bytes: number }>("select public.prepare_product_file($1,$2,100) as value", [alice,product]))!;
    return { profile, product, ...file, path: `${file.scope}/${file.id}.pdf` };
  }

  async function readyVersionFixture() {
    const file = await productFileFixture();
    await db.exec("reset role");
    await db.query("insert into storage.objects(bucket_id,name,metadata,created_at) values('product-files',$1,'{\"size\":100,\"mimetype\":\"application/pdf\"}',now())", [file.path]);
    await act("service_role");
    expect(await result("select public.commit_product_file($1,$2,$3) as value", [alice,file.product,file.id])).toBe(true);
    return file;
  }
  const freezeVersion = (file: { product: string; id: string }, revision=0, hash="a".repeat(64), owner=alice) =>
    result<string>("select public.freeze_product_version($1,$2,$3,$4,$5) as value", [owner,file.product,revision,file.id,hash]);

  async function sandboxOfferFixture() {
    const file = await readyVersionFixture();
    const version = (await freezeVersion(file))!;
    const merchant = (await result<{id:string}>("select public.reserve_creator_sandbox_account($1,'acct_Platform','GB') as value",[alice]))!;
    await result("select public.bind_creator_sandbox_account($1,$2,'acct_Creator') as value",[alice,merchant.id]);
    const lease=await result<string>("select public.claim_creator_sandbox_check($1) as value",[alice]);
    expect(await result("select public.complete_creator_sandbox_check($1,'acct_Creator',$2,true) as value",[alice,lease])).toBe(true);
    await act("authenticated",alice); await save(0,"Sandbox merchant",[],true);
    await act("service_role");
    expect(await result("select public.review_creator_sandbox_fixture($1,$2,$3) as value",[alice,version,"a".repeat(64)])).toBe(true);
    return {...file,version};
  }
  const reserveOrder = (version:string,buyer=bob) => result<{id:string;createdAt:string;amount:number;checkoutId:string|null}>("select public.reserve_creator_sandbox_order($1,$2) as value",[buyer,version]);
  async function enableSandboxOffer(version:string) {
    await db.exec("reset role; update snoozer.creator_sandbox_policy set enabled=true,platform_id='acct_Platform'");
    await act("authenticated",alice); expect(await result("select public.publish_my_creator_sandbox_offer($1,true) as value",[version])).toBe(true);
    await act("service_role");
  }

  it("keeps order creation disabled until a reviewed fixture, explicit policy and fresh seller readiness exist", async () => {
    const fixture = await sandboxOfferFixture();
    await expect(reserveOrder(fixture.version)).rejects.toMatchObject({code:"P1220"});
    await act("authenticated",alice);
    await expect(result("select public.publish_my_creator_sandbox_offer($1,true) as value",[fixture.version])).rejects.toMatchObject({code:"P1220"});
    await enableSandboxOffer(fixture.version);
    await expect(reserveOrder(fixture.version,alice)).rejects.toMatchObject({code:"42501"});
    await expect(reserveOrder(fixture.version,unverified)).rejects.toMatchObject({code:"42501"});
    await db.exec("reset role; update snoozer.creator_sandbox_accounts set checked_at=now()-interval '6 minutes'");
    await act("service_role"); await expect(reserveOrder(fixture.version)).rejects.toMatchObject({code:"P1220"});
    await db.exec("reset role; update snoozer.creator_sandbox_accounts set checked_at=now(); update snoozer.creator_sandbox_offers set review_expires_at=now()-interval '1 second'");
    await act("service_role"); await expect(reserveOrder(fixture.version)).rejects.toMatchObject({code:"P1220"});
  });

  it("reserves one pending order, binds one test Checkout and isolates buyer history", async () => {
    const fixture=await sandboxOfferFixture(); await enableSandboxOffer(fixture.version);
    const order=(await reserveOrder(fixture.version))!;
    expect(await reserveOrder(fixture.version)).toMatchObject({id:order.id,amount:500,checkoutId:null});
    const expires=new Date(Date.parse(order.createdAt)+3600000).toISOString();
    const bind=(account="acct_Creator",session="cs_test_Creator")=>result("select public.bind_creator_sandbox_checkout($1,$2,$3,$4,$5) as value",[order.id,bob,account,session,expires]);
    expect(await bind("acct_Other")).toBe(false);
    expect(await bind("acct_Creator","cs_live_Invalid")).toBe(false);
    expect(await bind()).toBe(true); expect(await bind()).toBe(true);
    expect(await bind("acct_Creator","cs_test_Replacement")).toBe(false);
    await act("authenticated",alice); await saveProduct(fixture.profile,fixture.product,0,false,1200);
    expect(await result("select public.list_my_creator_sandbox_orders() as value")).toEqual([]);
    await act("authenticated",bob);
    expect(await result("select public.list_my_creator_sandbox_orders() as value")).toMatchObject([{id:order.id,amount:500,state:"pending",held:false,accessUntil:null}]);
    await expect(result("select public.get_creator_sandbox_order($1) as value",[order.id])).rejects.toMatchObject({code:"42501"});
    await expect(reserveOrder(fixture.version)).rejects.toMatchObject({code:"42501"});
    await expect(db.query("select * from snoozer.creator_sandbox_orders")).rejects.toMatchObject({code:"42501"});
    await act("anon"); await expect(result("select public.list_my_creator_sandbox_orders() as value")).rejects.toMatchObject({code:"42501"});
  });

  it("rejects foreign offer control and stops new reservations for archived or unpublished products", async () => {
    const fixture=await sandboxOfferFixture(); await enableSandboxOffer(fixture.version);
    expect(await result("select public.review_creator_sandbox_fixture($1,$2,$3) as value",[alice,fixture.version,"b".repeat(64)])).toBe(false);
    await act("authenticated",bob);
    await expect(result("select public.review_creator_sandbox_fixture($1,$2,$3) as value",[alice,fixture.version,"a".repeat(64)])).rejects.toMatchObject({code:"42501"});
    expect(await result("select public.publish_my_creator_sandbox_offer($1,false) as value",[fixture.version])).toBe(false);
    await expect(result("select public.publish_my_creator_sandbox_offer($1,true) as value",[fixture.version])).rejects.toMatchObject({code:"P1220"});
    await act("authenticated",alice); await saveProduct(fixture.profile,fixture.product,0,true);
    await act("service_role"); await expect(reserveOrder(fixture.version)).rejects.toMatchObject({code:"P1220"});
    await act("authenticated",alice); await saveProduct(fixture.profile,fixture.product,1,false);
    await result("select public.unpublish_profile($1,1) as value",[fixture.profile]);
    await act("service_role"); await expect(reserveOrder(fixture.version)).rejects.toMatchObject({code:"P1220"});
  });

  it("retains ordered versions and profiles after withdrawal and protects buyer account deletion", async () => {
    const fixture=await sandboxOfferFixture(); await enableSandboxOffer(fixture.version);
    await reserveOrder(fixture.version);
    await act("authenticated",alice);
    expect(await result("select public.publish_my_creator_sandbox_offer($1,false) as value",[fixture.version])).toBe(true);
    await expect(result("select public.discard_my_product_version($1,$2) as value",[fixture.product,fixture.version])).rejects.toMatchObject({code:"23001",constraint:"creator_sandbox_orders_version_id_fkey"});
    await expect(db.query("select public.delete_profile($1,1,'private-pdf')",[fixture.profile])).rejects.toMatchObject({code:"P1213"});
    await expect(result("select public.remove_my_product_file($1,$2) as value",[fixture.product,fixture.id])).rejects.toMatchObject({code:"P1211"});
    await db.exec("reset role");
    await expect(db.query("delete from auth.users where id=$1",[bob])).rejects.toMatchObject({code:"23001",constraint:"creator_sandbox_orders_buyer_id_fkey"});
    await act("service_role"); await expect(reserveOrder(fixture.version)).rejects.toMatchObject({code:"P1220"});
  });

  it("stops uncertain Checkout retries and bounds retained sandbox orders", async () => {
    const fixture=await sandboxOfferFixture(); await enableSandboxOffer(fixture.version);
    const order=(await reserveOrder(fixture.version))!;
    await db.exec("reset role; update snoozer.creator_sandbox_orders set created_at=now()-interval '24 hours'");
    await act("service_role"); await expect(reserveOrder(fixture.version)).rejects.toMatchObject({code:"P1210"});
    expect(await result("select public.bind_creator_sandbox_checkout($1,$2,'acct_Creator','cs_test_Old',now()+interval '1 hour') as value",[order.id,bob])).toBe(false);
    await db.exec("reset role; update snoozer.creator_sandbox_orders set state='expired'");
    await db.query("insert into snoozer.creator_sandbox_orders(buyer_id,seller_id,profile_id,version_id,platform_id,account_id,state) select $1,$2,$3,$4,'acct_Platform','acct_Creator','expired' from generate_series(1,63)",[bob,alice,fixture.profile,fixture.version]);
    await act("service_role"); await expect(reserveOrder(fixture.version)).rejects.toMatchObject({code:"P1221"});
  });

  async function boundSandboxOrder() {
    const fixture=await sandboxOfferFixture();await enableSandboxOffer(fixture.version);
    const order=(await reserveOrder(fixture.version))!;
    const expires=new Date(Date.parse(order.createdAt)+86340000).toISOString();
    expect(await result("select public.bind_creator_sandbox_checkout($1,$2,'acct_Creator','cs_test_Order',$3) as value",[order.id,bob,expires])).toBe(true);
    return {...fixture,...order,expires};
  }
  const recordCreatorReceipt=(id="evt_Order",type="checkout.session.completed",object="cs_test_Order",account="acct_Creator")=>
    result("select public.record_creator_sandbox_receipt($1,'acct_Platform',$2,$3,$4,'2026-11-19T01:00:00Z') as value",[id,account,type,object]);
  const reconcileCreator=(id:string,state="paid",holds="{}",receipt:string|null="evt_Order",account="acct_Creator",payment="pi_Order")=>
    result<{state:string;paidAt:string;accessUntil:string;holds:string[]}>("select public.reconcile_creator_sandbox_order($1,'acct_Platform',$2,'cs_test_Order',$3,'ch_Order',$4,$5::text[],$6) as value",[id,account,payment,state,holds,receipt]);

  it("deduplicates private creator receipts, rejects identity conflicts and ignores unknown provider accounts",async()=>{
    await boundSandboxOrder();
    expect(await recordCreatorReceipt()).toBe(true);expect(await recordCreatorReceipt()).toBe(true);
    expect(await recordCreatorReceipt("evt_Unknown","charge.refunded","ch_Else","acct_Unknown")).toBe(false);
    await expect(recordCreatorReceipt("evt_Order","checkout.session.expired")).rejects.toMatchObject({code:"40001"});
    await expect(recordCreatorReceipt("evt_Invalid","checkout.session.completed","cs_live_Invalid")).rejects.toMatchObject({code:"23514"});
    await act("authenticated",bob);
    await expect(recordCreatorReceipt()).rejects.toMatchObject({code:"42501"});
    await expect(db.query("select * from snoozer.creator_sandbox_receipts")).rejects.toMatchObject({code:"42501"});
    await act("anon");await expect(recordCreatorReceipt()).rejects.toMatchObject({code:"42501"});
  });

  it("fixes the first paid access window and retains sticky holds through duplicate and out-of-order successes",async()=>{
    const order=await boundSandboxOrder();await recordCreatorReceipt();
    const first=(await reconcileCreator(order.id))!;
    expect(first).toMatchObject({state:"paid",holds:[]});
    expect(Date.parse(first.accessUntil)-Date.parse(first.paidAt)).toBe(30*86400000);
    await recordCreatorReceipt("evt_Refund","charge.refunded","ch_Order");
    expect(await reconcileCreator(order.id,"paid","{refund}","evt_Refund")).toMatchObject({holds:["refund"],paidAt:first.paidAt,accessUntil:first.accessUntil});
    await recordCreatorReceipt("evt_Dispute","charge.dispute.closed","du_Order");
    expect(await reconcileCreator(order.id,"paid","{dispute,fraud}","evt_Dispute")).toMatchObject({holds:["dispute","fraud","refund"]});
    expect(await reconcileCreator(order.id)).toMatchObject({holds:["dispute","fraud","refund"],paidAt:first.paidAt,accessUntil:first.accessUntil});
    await db.exec("reset role");
    expect(await result("select count(*)::integer as value from snoozer.creator_sandbox_receipts where processed_at is not null and order_id=$1",[order.id])).toBe(3);
    expect(await result("select retained_until>=paid_at+interval '90 days' as value from snoozer.creator_sandbox_orders where id=$1",[order.id])).toBe(true);
    await act("authenticated",bob);
    expect(await result("select public.list_my_creator_sandbox_orders() as value")).toMatchObject([{id:order.id,state:"paid",held:true,accessUntil:first.accessUntil}]);
  });

  it("enforces provider scope and immutable payment bindings before saving any access",async()=>{
    const order=await boundSandboxOrder();await recordCreatorReceipt();
    await expect(reconcileCreator(order.id,"paid","{}","evt_Order","acct_Other")).rejects.toMatchObject({code:"40001"});
    await expect(reconcileCreator(order.id,"paid","{unknown}")).rejects.toMatchObject({code:"22023"});
    await expect(reconcileCreator(order.id,"paid","{}","evt_Missing")).rejects.toMatchObject({code:"40001"});
    await recordCreatorReceipt("evt_WrongSession","checkout.session.completed","cs_test_Other");
    await expect(reconcileCreator(order.id,"paid","{}","evt_WrongSession")).rejects.toMatchObject({code:"40001"});
    await reconcileCreator(order.id);
    await expect(reconcileCreator(order.id,"paid","{}","evt_Order","acct_Creator","pi_Replacement")).rejects.toMatchObject({code:"40001"});
    await act("authenticated",bob);await expect(reconcileCreator(order.id)).rejects.toMatchObject({code:"42501"});
  });

  it("recovers an old canonical Checkout only through a matching durable receipt and original creation window",async()=>{
    const fixture=await sandboxOfferFixture();await enableSandboxOffer(fixture.version);const order=(await reserveOrder(fixture.version))!;
    await db.exec("reset role; update snoozer.creator_sandbox_orders set created_at=now()-interval '2 days'");
    const created=(await result<string>("select created_at as value from snoozer.creator_sandbox_orders where id=$1",[order.id]))!;
    const expires=new Date(Date.parse(created)+86340000).toISOString();await act("service_role");
    const recover=(receipt="evt_Order",accountSession="cs_test_Order",time=created)=>result("select public.recover_creator_sandbox_checkout($1,$2,$3,$4,$5) as value",[order.id,receipt,accountSession,time,expires]);
    expect(await recover()).toBe(false);await recordCreatorReceipt();
    expect(await recover("evt_Order","cs_test_Other")).toBe(false);
    expect(await recover("evt_Order","cs_test_Order",new Date(Date.parse(created)-60000).toISOString())).toBe(false);
    expect(await recover()).toBe(true);expect(await recover()).toBe(true);
    expect(await recover("evt_Order","cs_test_Replacement")).toBe(false);
    expect(await reconcileCreator(order.id)).toMatchObject({state:"paid"});
  });

  it("records pre-payment holds without granting access and permits only canonical late payment to establish the first window",async()=>{
    const order=await boundSandboxOrder();await recordCreatorReceipt("evt_Dispute","charge.dispute.created","du_Order");
    expect(await reconcileCreator(order.id,"pending","{dispute}","evt_Dispute")).toMatchObject({state:"pending",paidAt:null,accessUntil:null,holds:["dispute"]});
    expect(await reconcileCreator(order.id,"expired","{}",null)).toMatchObject({state:"expired",paidAt:null});
    await recordCreatorReceipt();expect(await reconcileCreator(order.id)).toMatchObject({state:"paid",holds:["dispute"]});
    expect(await reconcileCreator(order.id,"expired","{}",null)).toMatchObject({state:"paid",holds:["dispute"]});
  });

  it("authorizes buyer file projections only after fresh canonical paid proof, retaining access through creator archive/unpublish",async()=>{
    const order=await boundSandboxOrder();
    await act("authenticated",bob);expect(await result("select public.owns_my_creator_sandbox_order($1) as value",[order.id])).toBe(true);
    expect(await result("select public.get_my_creator_order_file($1) as value",[order.id])).toBeNull();
    await act("service_role");await recordCreatorReceipt();await reconcileCreator(order.id);
    await act("authenticated",alice);expect(await result("select public.get_my_creator_order_file($1) as value",[order.id])).toBeNull();
    expect(await result("select public.owns_my_creator_sandbox_order($1) as value",[order.id])).toBe(false);
    await saveProduct(order.profile,order.product,0,true);await db.query("select public.unpublish_profile($1,1)",[order.profile]);
    await act("authenticated",bob);
    expect(await result("select public.get_my_creator_order_file($1) as value",[order.id])).toMatchObject({orderId:order.id,versionId:order.version,id:expect.any(String),state:"ready"});
    expect(await result("select public.list_my_creator_sandbox_orders() as value")).toMatchObject([{id:order.id,accessActive:true}]);
    await db.exec("reset role; update snoozer.creator_sandbox_orders set provider_checked_at=now()-interval '31 seconds'");
    await act("authenticated",bob);expect(await result("select public.get_my_creator_order_file($1) as value",[order.id])).toBeNull();
    await act("service_role");await reconcileCreator(order.id,"paid","{refund}");
    await act("authenticated",bob);expect(await result("select public.get_my_creator_order_file($1) as value",[order.id])).toBeNull();
    expect(await result("select public.list_my_creator_sandbox_orders() as value")).toMatchObject([{id:order.id,accessActive:false}]);
    await act("anon");await expect(result("select public.get_my_creator_order_file($1) as value",[order.id])).rejects.toMatchObject({code:"42501"});
    await act("service_role");await expect(result("select public.get_my_creator_order_file($1) as value",[order.id])).rejects.toMatchObject({code:"42501"});
  });

  it("throttles buyer-triggered verification and denies expired download windows",async()=>{
    const order=await boundSandboxOrder();await recordCreatorReceipt();await reconcileCreator(order.id);
    await act("authenticated",alice);expect(await result("select public.claim_my_creator_order_check($1) as value",[order.id])).toBe(false);
    await act("authenticated",bob);
    expect(await result("select public.claim_my_creator_order_check($1) as value",[order.id])).toBe(true);
    expect(await result("select public.claim_my_creator_order_check($1) as value",[order.id])).toBe(false);
    await db.exec("reset role; update snoozer.creator_sandbox_orders set access_until=now()-interval '1 second'");
    await act("authenticated",bob);expect(await result("select public.get_my_creator_order_file($1) as value",[order.id])).toBeNull();
    await act("authenticated",unverified);await expect(result("select public.claim_my_creator_order_check($1) as value",[order.id])).rejects.toMatchObject({code:"42501"});
  });

  it("exposes only reviewed frozen storefront copy behind enabled policy and a freshly ready seller",async()=>{
    const fixture=await sandboxOfferFixture();await act("anon");
    expect(await result("select public.get_creator_sandbox_store('private-pdf') as value")).toBeNull();
    await enableSandboxOffer(fixture.version);await act("authenticated",alice);await saveProduct(fixture.profile,fixture.product,0,false,1200);
    expect(await result("select public.list_my_creator_sandbox_offers($1) as value",[fixture.profile])).toMatchObject([{versionId:fixture.version,enabled:true}]);
    await act("anon");const store=await result<{items:unknown[]}>("select public.get_creator_sandbox_store('private-pdf') as value");
    expect(store).toMatchObject({username:"private-pdf",displayName:"Sandbox merchant",items:[{versionId:fixture.version,amount:500,currency:"gbp",bytes:100}]});
    expect(JSON.stringify(store)).not.toContain(fixture.id);expect(JSON.stringify(store)).not.toContain("acct_Creator");expect(JSON.stringify(store)).not.toContain("a".repeat(64));
    await db.exec("reset role; update snoozer.creator_sandbox_accounts set checked_at=now()-interval '6 minutes'");await act("anon");
    expect(await result("select public.get_creator_sandbox_store('private-pdf') as value")).toBeNull();
  });

  it("removes expired, archived and withdrawn offers from discovery without exposing private merchant reads",async()=>{
    const fixture=await sandboxOfferFixture();await enableSandboxOffer(fixture.version);
    await act("authenticated",bob);
    await expect(result("select public.list_my_creator_sandbox_offers($1) as value",[fixture.profile])).rejects.toMatchObject({code:"42501"});
    await expect(result("select public.get_creator_sandbox_merchant($1) as value",[alice])).rejects.toMatchObject({code:"42501"});
    await db.exec("reset role; update snoozer.creator_sandbox_offers set review_expires_at=now()-interval '1 second'");await act("anon");
    expect(await result("select public.get_creator_sandbox_store('private-pdf')->'items' as value")).toEqual([]);
    await db.exec("reset role; update snoozer.creator_sandbox_offers set review_expires_at=now()+interval '1 day'");await act("authenticated",alice);
    await saveProduct(fixture.profile,fixture.product,0,true);await act("anon");
    expect(await result("select public.get_creator_sandbox_store('private-pdf')->'items' as value")).toEqual([]);
    await act("authenticated",alice);await saveProduct(fixture.profile,fixture.product,1,false);
    expect(await result("select public.publish_my_creator_sandbox_offer($1,false) as value",[fixture.version])).toBe(true);
    await act("anon");expect(await result("select public.get_creator_sandbox_store('private-pdf')->'items' as value")).toEqual([]);
  });

  it("permits only service lookups of published reviewed fixture sellers even when readiness is stale",async()=>{
    const fixture=await sandboxOfferFixture();await enableSandboxOffer(fixture.version);
    await db.exec("reset role; update snoozer.creator_sandbox_accounts set checked_at=now()-interval '6 minutes',ready=false");
    const target=()=>result("select public.get_creator_store_check_target('private-pdf',null) as value");
    for(const role of ["anon","authenticated"] as const) {
      await act(role,bob);await expect(target()).rejects.toMatchObject({code:"42501"});
    }
    await act("service_role");expect(await target()).toMatchObject({ownerId:alice,merchant:{accountId:"acct_Creator",ready:false}});
    expect(await result("select public.get_creator_store_check_target(null,$1) as value",[fixture.version])).toMatchObject({ownerId:alice});
    expect(await result("select public.get_creator_store_check_target('private-pdf',$1) as value",[fixture.version])).toBeNull();
    expect(await result("select public.get_creator_store_check_target(null,null) as value")).toBeNull();
    await db.exec("reset role; update snoozer.creator_sandbox_offers set enabled=false");await act("service_role");expect(await target()).toBeNull();
    await db.exec("reset role; update snoozer.creator_sandbox_offers set enabled=true,review_expires_at=now()-interval '1 second'");await act("service_role");expect(await target()).toBeNull();
    await db.exec("reset role; update snoozer.creator_sandbox_offers set review_expires_at=now()+interval '1 day';update snoozer.creator_sandbox_policy set enabled=false");await act("service_role");expect(await target()).toBeNull();
    await db.exec("reset role; update snoozer.creator_sandbox_policy set enabled=true;update snoozer.product_drafts set archived=true");await act("service_role");expect(await target()).toBeNull();
    await db.exec("reset role; update snoozer.product_drafts set archived=false");await act("authenticated",alice);await db.query("select public.unpublish_profile($1,1)",[fixture.profile]);
    await act("service_role");expect(await target()).toBeNull();
  });

  it("leases persisted receipt retries with backoff and exposes aggregate recovery diagnostics only to existing billing staff",async()=>{
    await boundSandboxOrder();await recordCreatorReceipt();
    const list=()=>result<unknown[]>("select public.list_creator_sandbox_receipt_retries('acct_Platform',1,null) as value");
    expect(await list()).toMatchObject([{id:"evt_Order",accountId:"acct_Creator"}]);
    expect(await result("select public.claim_creator_sandbox_receipt_retry('evt_Order','acct_Platform') as value")).toBe(true);
    expect(await result("select public.claim_creator_sandbox_receipt_retry('evt_Order','acct_Platform') as value")).toBe(false);expect(await list()).toEqual([]);
    expect(await result("select public.list_creator_sandbox_receipt_retries('acct_Other',1,'evt_Order') as value")).toEqual([]);
    await expect(result("select public.list_creator_sandbox_receipt_retries('acct_Platform',11,null) as value")).rejects.toMatchObject({code:"22023"});
    await act("authenticated",alice);await expect(list()).rejects.toMatchObject({code:"42501"});
    await expect(result("select public.read_creator_sandbox_diagnostics() as value")).rejects.toMatchObject({code:"42501"});
    await db.exec("reset role");await db.query("insert into snoozer.staff_roles(owner_id,role) values($1,'billing_diagnostics')",[alice]);
    await act("authenticated",alice);
    expect(await result("select public.read_creator_sandbox_diagnostics() as value")).toEqual({pendingReceipts:1,deferredReceipts:1,deadLetterReceipts:0,uncertainOrders:0,heldOrders:0});
    await db.exec("reset role; update snoozer.creator_sandbox_receipts set retry_count=10,next_attempt_at=now()-interval '1 second'");await act("service_role");
    expect(await list()).toEqual([]);
    expect(await result("select public.list_creator_sandbox_receipt_retries('acct_Platform',1,'evt_Order') as value")).toMatchObject([{id:"evt_Order"}]);
    await act("authenticated",alice);
    expect(await result("select public.read_creator_sandbox_diagnostics()->'deadLetterReceipts' as value")).toBe(1);
  });

  it("retains unresolved holds and account receipt backlogs, then removes expired unheld order history without deleting product bytes",async()=>{
    const order=await boundSandboxOrder();await recordCreatorReceipt();await reconcileCreator(order.id,"paid","{refund}");
    await db.exec("reset role; update snoozer.creator_sandbox_orders set paid_at=now()-interval '100 days',access_until=now()-interval '70 days',retained_until=now()-interval '10 days'; update snoozer.creator_sandbox_receipts set received_at=now()-interval '100 days',processed_at=now()-interval '100 days'");
    await act("service_role");expect(await result("select public.purge_creator_sandbox_history(100) as value")).toEqual({ordersRemoved:0,receiptsRemoved:0});
    await db.exec("reset role; update snoozer.creator_sandbox_orders set holds='{}'");await act("service_role");await recordCreatorReceipt("evt_Backlog");
    expect(await result("select public.purge_creator_sandbox_history(100) as value")).toEqual({ordersRemoved:0,receiptsRemoved:0});
    expect(await result("select public.ignore_creator_sandbox_receipt('evt_Backlog','acct_Platform','acct_Creator') as value")).toBe(true);
    expect(await result("select public.purge_creator_sandbox_history(100) as value")).toEqual({ordersRemoved:1,receiptsRemoved:1});
    await db.exec("reset role");expect(await result("select count(*)::integer as value from snoozer.product_files")).toBe(1);
    expect(await result("select count(*)::integer as value from snoozer.product_versions")).toBe(1);
    await act("authenticated",bob);expect(await result("select public.list_my_creator_sandbox_orders() as value")).toEqual([]);
  });

  it("bounds cleanup batches and never time-purges an uncertain pending order",async()=>{
    const order=await boundSandboxOrder();await db.exec("reset role; update snoozer.creator_sandbox_orders set retained_until=now()-interval '1 day'");
    await db.query("insert into snoozer.creator_sandbox_orders(buyer_id,seller_id,profile_id,version_id,platform_id,account_id,state,retained_until) select $1,$2,$3,$4,'acct_Platform','acct_Creator','expired',now()-interval '1 day' from generate_series(1,2)",[bob,alice,order.profile,order.version]);
    await act("service_role");expect(await result("select public.purge_creator_sandbox_history(1) as value")).toEqual({ordersRemoved:1,receiptsRemoved:0});
    expect(await result("select public.purge_creator_sandbox_history(1) as value")).toEqual({ordersRemoved:1,receiptsRemoved:0});
    expect(await result("select public.get_creator_sandbox_order($1)->>'state' as value",[order.id])).toBe("pending");
    await expect(result("select public.purge_creator_sandbox_history(101) as value")).rejects.toMatchObject({code:"22023"});
    await act("authenticated",bob);await expect(result("select public.purge_creator_sandbox_history(1) as value")).rejects.toMatchObject({code:"42501"});
  });

  it("freezes private copy, price and file identity without changing the draft or duplicating bytes", async () => {
    const file = await readyVersionFixture();
    const id = await freezeVersion(file);
    expect(await freezeVersion(file)).toBe(id);
    await act("authenticated", alice);
    expect(await result("select public.get_my_product_version_file($1) as value",[id])).toMatchObject({ versionId:id, id:file.id, bytes:100, sha256:"a".repeat(64), state:"ready" });
    await saveProduct(file.profile,file.product,0,false,1200);
    expect(await result("select public.list_my_product_versions($1) as value",[file.profile])).toMatchObject([{ id, revision:0, amount:500, bytes:100, sha256:"a".repeat(64), fileId:file.id }]);
    expect(await result("select public.get_my_plan() as value")).toMatchObject({ usage:{ mediaBytes:100 } });
    await expect(result("select public.remove_my_product_file($1,$2) as value",[file.product,file.id])).rejects.toMatchObject({ code:"P1211" });
    expect(await result("select public.get_my_product_file($1) as value",[file.id])).toMatchObject({ state:"ready" });
    await act("service_role");
    await expect(freezeVersion(file)).rejects.toMatchObject({ code:"40001" });
    await freezeVersion(file,1);
    await db.exec("reset role");
    await expect(db.query("update snoozer.product_versions set amount=999")).rejects.toMatchObject({ code:"42501" });
  });

  it("isolates version inventory and mutations from anonymous and other accounts", async () => {
    const file = await readyVersionFixture();
    const id = await freezeVersion(file);
    for (const role of ["authenticated","anon"] as const) {
      await act(role,bob);
      if(role==="authenticated") expect(await result("select public.get_my_product_version_file($1) as value",[id])).toBeNull();
      else await expect(result("select public.get_my_product_version_file($1) as value",[id])).rejects.toMatchObject({ code:"42501" });
      await expect(result("select public.list_my_product_versions($1) as value",[file.profile])).rejects.toMatchObject({ code:"42501" });
      await expect(freezeVersion(file)).rejects.toMatchObject({ code:"42501" });
      await expect(db.query("select * from snoozer.product_versions")).rejects.toMatchObject({ code:"42501" });
    }
    await act("authenticated",bob);
    expect(await result("select public.discard_my_product_version($1,$2) as value",[file.product,id])).toBe(false);
    await act("service_role");
    await expect(freezeVersion(file,0,"a".repeat(64),bob)).rejects.toMatchObject({ code:"42501" });
    await expect(freezeVersion(file,0,"a".repeat(64),unverified)).rejects.toMatchObject({ code:"42501" });
    await expect(db.query("select * from snoozer.product_versions")).rejects.toMatchObject({ code:"42501" });
  });

  it("bounds private versions, rejects changed fingerprints and allows explicit discard before file removal", async () => {
    const file = await readyVersionFixture();
    const first = await freezeVersion(file);
    await expect(freezeVersion(file,0,"b".repeat(64))).rejects.toMatchObject({ code:"40001" });
    await expect(freezeVersion(file,0,"not-a-hash")).rejects.toMatchObject({ code:"22023" });
    for(let revision=1; revision<=5; revision++) {
      await act("authenticated",alice); await saveProduct(file.profile,file.product,revision-1);
      await act("service_role");
      if(revision===5) await expect(freezeVersion(file,revision)).rejects.toMatchObject({ code:"P1212" });
      else await freezeVersion(file,revision);
    }
    await act("authenticated",alice);
    expect(await result("select public.discard_my_product_version($1,$2) as value",[file.product,first])).toBe(true);
    expect(await result("select public.get_my_product_version_file($1) as value",[first])).toBeNull();
    expect(await result("select public.discard_my_product_version($1,$2) as value",[file.product,first])).toBe(false);
    const remaining = await result<{id:string}[]>("select public.list_my_product_versions($1) as value",[file.profile]);
    for(const version of remaining!) await result("select public.discard_my_product_version($1,$2) as value",[file.product,version.id]);
    expect(await result("select public.remove_my_product_file($1,$2) as value",[file.product,file.id])).toMatchObject({ state:"removing" });
    await act("service_role");
    await expect(freezeVersion(file,5)).rejects.toMatchObject({ code:"P1211" });
  });

  it("refuses missing files and cascades only unsold private versions during profile deletion", async () => {
    const pending = await productFileFixture("version-pdf-delete");
    await expect(freezeVersion(pending)).rejects.toMatchObject({ code:"P1211" });
    await db.exec("reset role");
    await db.query("insert into storage.objects(bucket_id,name,metadata,created_at) values('product-files',$1,'{\"size\":100,\"mimetype\":\"application/pdf\"}',now())",[pending.path]);
    await act("service_role"); await result("select public.commit_product_file($1,$2,$3) as value",[alice,pending.product,pending.id]);
    await freezeVersion(pending);
    await act("authenticated",alice); await db.query("select public.delete_profile($1,0,'version-pdf-delete')",[pending.profile]);
    await db.exec("reset role");
    expect(await result("select count(*)::int as value from snoozer.product_versions")).toBe(0);
    expect(await result("select count(*)::int as value from snoozer.avatar_cleanup where scope=$1",[pending.scope])).toBe(1);
  });

  it("reserves private product media once and requires actual stored bytes before owner download", async () => {
    const file = await productFileFixture();
    expect(await result("select public.prepare_product_file($1,$2,100) as value", [alice,file.product])).toBeNull();
    expect(await result("select public.commit_product_file($1,$2,$3) as value", [alice,file.product,file.id])).toBe(false);
    await act("authenticated", alice);
    expect(await result("select public.get_my_product_file($1) as value", [file.id])).toBeNull();
    expect(await result("select public.get_my_plan() as value")).toMatchObject({ usage: { mediaBytes: 100 } });
    await db.exec("reset role");
    await db.query("insert into storage.objects(bucket_id,name,metadata,created_at) values('product-files',$1,'{\"size\":99,\"mimetype\":\"application/pdf\"}',now())", [file.path]);
    await act("service_role");
    expect(await result("select public.commit_product_file($1,$2,$3) as value", [alice,file.product,file.id])).toBe(false);
    await db.exec("reset role; update storage.objects set metadata='{\"size\":100,\"mimetype\":\"application/pdf\"}'");
    await act("service_role");
    expect(await result("select public.commit_product_file($1,$2,$3) as value", [alice,file.product,file.id])).toBe(true);
    await act("authenticated", alice);
    expect(await result("select public.get_my_plan() as value")).toMatchObject({ usage: { mediaBytes: 100 } });
    expect(await result("select public.get_my_product_file($1) as value", [file.id])).toMatchObject({ id: file.id, state: "ready", bytes: 100 });
    await act("authenticated", bob);
    expect(await result("select public.get_my_product_file($1) as value", [file.id])).toBeNull();
    await expect(result("select public.list_my_product_files($1) as value", [file.profile])).rejects.toMatchObject({ code: "42501" });
    await expect(result("select public.prepare_product_file($1,$2,100) as value", [alice,file.product])).rejects.toMatchObject({ code: "42501" });
    await expect(result("select public.remove_my_product_file($1,$2) as value", [file.product,file.id])).rejects.toMatchObject({ code: "42501" });
  });

  it("stops delivery before physical removal, retains reservations and refuses a premature completion", async () => {
    const file = await productFileFixture();
    await db.exec("reset role");
    await db.query("insert into storage.objects(bucket_id,name,metadata,created_at) values('product-files',$1,'{\"size\":100,\"mimetype\":\"application/pdf\"}',now())", [file.path]);
    await act("service_role");
    await result("select public.commit_product_file($1,$2,$3) as value", [alice,file.product,file.id]);
    await act("authenticated", alice);
    expect(await result("select public.remove_my_product_file($1,$2) as value", [file.product,file.id])).toMatchObject({ state: "removing" });
    expect(await result("select public.get_my_product_file($1) as value", [file.id])).toBeNull();
    await act("service_role");
    expect(await result("select public.complete_product_file_removal($1,$2,$3) as value", [alice,file.product,file.id])).toBe(false);
    expect(await result("select public.commit_product_file($1,$2,$3) as value", [alice,file.product,file.id])).toBe(false);
    await db.exec("reset role; delete from storage.objects");
    await act("authenticated", alice);
    expect(await result("select public.get_my_plan() as value")).toMatchObject({ usage: { mediaBytes: 100 } });
    await act("service_role");
    expect(await result("select public.complete_product_file_removal($1,$2,$3) as value", [bob,file.product,file.id])).toBe(false);
    expect(await result("select public.complete_product_file_removal($1,$2,$3) as value", [alice,file.product,file.id])).toBe(true);
    await act("authenticated", alice);
    expect(await result("select public.get_my_plan() as value")).toMatchObject({ usage: { mediaBytes: 0 } });
  });

  it("counts product reservations with existing media allowance and sweeps only unbound old objects", async () => {
    const file = await productFileFixture();
    await db.exec("reset role");
    await db.query("insert into storage.objects(bucket_id,name,metadata,created_at) values('avatar-images',$1,jsonb_build_object('size',(select media_bytes from snoozer.plan_versions where plan='free' order by version desc limit 1)),now())", [file.scope+'/'+avatar+'.webp']);
    await act("authenticated", alice);
    const second = await saveProduct(file.profile);
    await act("service_role");
    await expect(result("select public.prepare_product_file($1,$2,100) as value", [alice,second])).rejects.toMatchObject({ code: "P1104" });
    for (const size of [0,4194305]) await expect(result("select public.prepare_product_file($1,$2,$3) as value", [alice,second,size])).rejects.toMatchObject({ code: "22023" });
    await db.exec("reset role; delete from storage.objects");
    await db.query("insert into storage.objects(bucket_id,name,metadata,created_at) values('product-files',$1,'{\"size\":100,\"mimetype\":\"application/pdf\"}',now()-interval '4 hours')", [file.path]);
    const orphan = file.scope+'/'+avatar+'.pdf';
    await db.query("insert into storage.objects(bucket_id,name,metadata,created_at) values('product-files',$1,'{}',now()-interval '4 hours')", [orphan]);
    await act("service_role");
    expect(await result("select public.find_orphan_product_files() as value")).toEqual([orphan]);
    await act("authenticated", alice);
    await db.query("select public.delete_profile($1,0,'private-pdf')", [file.profile]);
    await act("service_role");
    expect(await result<string[]>("select public.find_orphan_product_files() as value")).toEqual(expect.arrayContaining([file.path,orphan]));
    await db.exec("reset role");
    expect(await result("select count(*)::integer as value from snoozer.avatar_cleanup where scope=$1", [file.scope])).toBe(1);
  });

  it("reserves one creator sandbox attempt, binds once and isolates its owner inventory", async () => {
    await act("authenticated", alice); await claim("seller-alice");
    expect(await result("select public.get_my_creator_sandbox_account() as value")).toBeNull();
    await expect(result("select public.reserve_creator_sandbox_account($1,'acct_Platform','GB') as value", [alice])).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    const first = await result<{id:string}>("select public.reserve_creator_sandbox_account($1,'acct_Platform','GB') as value", [alice]);
    expect(await result("select public.reserve_creator_sandbox_account($1,'acct_Platform','GB') as value", [alice])).toMatchObject({ id: first!.id });
    await expect(result("select public.reserve_creator_sandbox_account($1,'acct_Other','GB') as value", [alice])).rejects.toMatchObject({ code: "40001" });
    expect(await result("select public.bind_creator_sandbox_account($1,$2,'acct_Creator') as value", [alice,first!.id])).toBe(true);
    expect(await result("select public.bind_creator_sandbox_account($1,$2,'acct_Other') as value", [alice,first!.id])).toBe(false);
    expect(await result("select public.bind_creator_sandbox_account($1,$2,'acct_Platform') as value", [alice,first!.id])).toBe(false);
    await act("authenticated", alice);
    expect(await result("select public.get_my_creator_sandbox_account() as value")).toMatchObject({ accountId: "acct_Creator", ready: false });
    await act("authenticated", bob);
    expect(await result("select public.get_my_creator_sandbox_account() as value")).toBeNull();
    await expect(db.query("select * from snoozer.creator_sandbox_accounts")).rejects.toMatchObject({ code: "42501" });
    await act("anon");
    await expect(result("select public.get_my_creator_sandbox_account() as value")).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
    await expect(db.query("delete from auth.users where id=$1", [alice])).rejects.toMatchObject({ code: "23001", constraint: "creator_sandbox_accounts_owner_id_fkey" });
  });

  it("refuses unsafe account-creation retries and leases readiness updates", async () => {
    await act("authenticated", alice); await claim("seller-retry");
    await act("service_role");
    const merchant = await result<{id:string}>("select public.reserve_creator_sandbox_account($1,'acct_Platform','GB') as value", [alice]);
    await expect(result("select public.reserve_creator_sandbox_account($1,'acct_Platform','US') as value", [alice])).rejects.toMatchObject({ code: "22023" });
    await db.exec("reset role; update snoozer.creator_sandbox_accounts set created_at=now()-interval '24 hours'");
    await act("service_role");
    await expect(result("select public.reserve_creator_sandbox_account($1,'acct_Platform','GB') as value", [alice])).rejects.toMatchObject({ code: "P1210" });
    expect(await result("select public.bind_creator_sandbox_account($1,$2,'acct_Creator') as value", [alice,merchant!.id])).toBe(false);
    await db.exec("reset role; update snoozer.creator_sandbox_accounts set created_at=now()");
    await act("service_role");
    await result("select public.bind_creator_sandbox_account($1,$2,'acct_Creator') as value", [alice,merchant!.id]);
    const lease = await result<string>("select public.claim_creator_sandbox_check($1) as value", [alice]);
    expect(lease).toBeTruthy();
    expect(await result("select public.claim_creator_sandbox_check($1) as value", [alice])).toBeNull();
    expect(await result("select public.complete_creator_sandbox_check($1,'acct_Other',$2,true) as value", [alice,lease])).toBe(false);
    expect(await result("select public.complete_creator_sandbox_check($1,'acct_Creator',$2,true) as value", [alice,lease])).toBe(true);
    expect(await result("select public.complete_creator_sandbox_check($1,'acct_Creator',$2,false) as value", [alice,lease])).toBe(false);
    await act("authenticated", alice);
    expect(await result("select public.get_my_creator_sandbox_account() as value")).toMatchObject({ ready: true });
    await db.exec("reset role; update snoozer.creator_sandbox_accounts set retry_after=now()-interval '1 second'");
    await act("service_role");
    const expiredLease = await result<string>("select public.claim_creator_sandbox_check($1) as value", [alice]);
    await db.exec("reset role; update snoozer.creator_sandbox_accounts set check_until=now()-interval '1 second'");
    await act("service_role");
    expect(await result("select public.complete_creator_sandbox_check($1,'acct_Creator',$2,true) as value", [alice,expiredLease])).toBe(false);
    await act("authenticated", alice);
    expect(await result("select public.get_my_creator_sandbox_account() as value")).toMatchObject({ ready: false });
  });

  async function domainFixture(name: string, owner = alice, host = name + ".example.com") {
    await act("authenticated", owner); await claim(name);
    const profile = (await draft() as { profile_id: string }).profile_id;
    await db.exec("reset role");
    await db.query("insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at) values($1,'plus',1,'staff',$2,now()-interval '1 minute',now()+interval '2 days')", [owner, name]);
    await act("authenticated", owner);
    const request = (await result<string>("select public.request_profile_domain($1,$2) as value", [profile, host]))!;
    return { profile, request, host };
  }
  async function checkDomain(request: string, host: string, owner: string) {
    await act("service_role");
    const job = await result<{ state: string; lease: string }>("select public.claim_domain_check($1,$2,$3) as value", [host, request, owner]);
    expect(job?.state).toBe("check");
    return job!.lease;
  }

  it("leases domain verification, refuses stale completions and routes only a live verified profile", async () => {
    const fixture = await domainFixture("domain-alice");
    await act("service_role");
    await db.query("select public.reserve_domain_provisioning($1)", [fixture.request]);
    const lease = await checkDomain(fixture.request, fixture.host, alice);
    expect(await result("select public.complete_domain_check($1,$2,true) as value", [fixture.request, avatar])).toBe(false);
    expect(await result("select public.complete_domain_check($1,$2,true) as value", [fixture.request, lease])).toBe(true);
    expect(await result("select public.complete_domain_check($1,$2,true) as value", [fixture.request, lease])).toBe(false);
    await act("anon");
    expect(await result("select public.resolve_profile_domain($1) as value", [fixture.host])).toMatchObject({ state: "unavailable" });
    await act("authenticated", alice); await save(0, "Domain publication", [], true);
    await act("anon");
    expect(await result("select public.resolve_profile_domain($1) as value", [fixture.host])).toEqual({ state: "ready", username: "domain-alice" });
    expect(await published("domain-alice")).toMatchObject({ custom_domain: fixture.host });
    await db.exec("reset role; update snoozer.profile_domains set verified_until=now()-interval '1 second'; update snoozer.domain_requests set retry_after=now()-interval '1 second',expires_at=now()-interval '1 day'");
    await act("anon");
    expect(await result("select public.resolve_profile_domain($1) as value", [fixture.host])).toEqual({ state: "expired" });
    expect(await published("domain-alice")).not.toHaveProperty("custom_domain");
    await act("service_role");
    const refresh = await result<{ state: string; lease: string }>("select public.claim_domain_check($1) as value", [fixture.host]);
    expect(refresh?.state).toBe("check");
    expect(await result("select public.claim_domain_check($1) as value", [fixture.host])).toMatchObject({ state: "busy" });
    expect(await result("select public.complete_domain_check($1,$2,true) as value", [fixture.request, refresh!.lease])).toBe(true);
    await db.exec("reset role; update snoozer.entitlement_grants set revoked_at=now()");
    await act("anon");
    expect(await result("select public.resolve_profile_domain($1) as value", [fixture.host])).toEqual({ state: "unavailable" });
    expect(await published("domain-alice")).not.toHaveProperty("custom_domain");
  });

  it("allows fresh proven domain transfer, prevents stale-owner reclaim and serializes provider disconnection", async () => {
    const first = await domainFixture("domain-alice");
    let lease = await checkDomain(first.request, first.host, alice);
    expect(await result("select public.complete_domain_check($1,$2,true) as value", [first.request, lease])).toBe(true);
    await act("authenticated", alice); await save(0, "Alice live", [], true);
    const second = await domainFixture("domain-bob", bob, first.host);
    await act("anon");
    expect(await result("select public.resolve_profile_domain($1) as value", [first.host])).toMatchObject({ username: "domain-alice" });
    lease = await checkDomain(second.request, second.host, bob);
    expect(await result("select public.complete_domain_check($1,$2,true) as value", [second.request, lease])).toBe(true);
    expect(await result("select public.claim_domain_check($1,$2,$3) as value", [first.host, first.request, alice])).toMatchObject({ state: "unavailable" });
    await act("authenticated", bob); await save(0, "Bob live", [], true);
    await db.query("select public.disconnect_profile_domain($1)", [second.request]);
    await expect(db.query("select public.delete_profile($1,1,'domain-bob')", [second.profile])).rejects.toMatchObject({ code: "P1010" });
    await db.exec("reset role");
    await expect(db.query("delete from auth.users where id=$1", [bob])).rejects.toMatchObject({ code: "P1010" });
    await act("authenticated", alice);
    const fresh = (await result<string>("select public.request_profile_domain($1,$2) as value", [first.profile, first.host]))!;
    lease = await checkDomain(fresh, first.host, alice);
    expect(await result("select public.complete_domain_check($1,$2,true) as value", [fresh, lease])).toBe(false);
    expect(await result("select public.complete_domain_disconnect($1,$2) as value", [first.host, first.request])).toBe(false);
    expect(await result("select public.complete_domain_disconnect($1,$2) as value", [first.host, second.request])).toBe(true);
    await act("authenticated", bob);
    await db.query("select public.delete_profile($1,1,'domain-bob')", [second.profile]);
    await act("anon");
    expect(await result("select public.resolve_profile_domain($1) as value", [first.host])).toBeNull();
  });

  it("denies domain privileges across owners, expired requests, free plans and private tables", async () => {
    await act("authenticated", alice); await claim("domain-free");
    const id = (await draft() as { profile_id: string }).profile_id;
    await expect(db.query("select public.request_profile_domain($1,'creator.example.com')", [id])).rejects.toMatchObject({ code: "P1011" });
    await expect(db.query("select public.request_profile_domain($1,'snoozer.uk')", [id])).rejects.toMatchObject({ code: "22023" });
    await act("authenticated", bob);
    await expect(db.query("select public.request_profile_domain($1,'creator.example.com')", [id])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select public.list_my_domains($1)", [id])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select public.reserve_domain_provisioning($1)", [avatar])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select public.complete_domain_check($1,$1,true)", [avatar])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select * from snoozer.profile_domains")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", unverified);
    await expect(db.query("select public.list_my_domains($1)", [id])).rejects.toMatchObject({ code: "42501" });
  });

  it("bounds new domain claims and permits cancellation without touching another account's binding", async () => {
    const first = await domainFixture("domain-quota-alice");
    const lease = await checkDomain(first.request, first.host, alice);
    expect(await result("select public.complete_domain_check($1,$2,true) as value", [first.request, lease])).toBe(true);
    const second = await domainFixture("domain-quota-bob", bob, first.host);
    await db.query("select public.disconnect_profile_domain($1)", [second.request]);
    const inventory = await result<{ items: { state: string }[] }>("select public.list_my_domains($1) as value", [second.profile]);
    expect(inventory!.items[0].state).toBe("retired");
    await db.exec("reset role");
    expect(await result("select state as value from snoozer.profile_domains where hostname=$1", [first.host])).toBe("active");
    await act("authenticated", bob);
    for (let i=0;i<4;i++) await db.query("select public.request_profile_domain($1,$2)", [second.profile, `extra${i}.example.com`]);
    await expect(db.query("select public.request_profile_domain($1,'sixth.example.com')", [second.profile])).rejects.toMatchObject({ code: "P1001" });
    await db.exec("reset role; update snoozer.domain_requests set expires_at=now()-interval '1 second' where used_at is null");
    await act("service_role");
    expect(await result("select public.claim_domain_check($1,$2,$3) as value", [second.host, second.request, bob])).toMatchObject({ state: "unavailable" });
    expect(await result("select public.cleanup_domain_requests(100) as value")).toBe(0);
    await expect(db.query("select public.cleanup_domain_requests(501)")).rejects.toMatchObject({ code: "22023" });
    await db.exec("reset role; update snoozer.domain_requests set expires_at=now()-interval '8 days' where used_at is null");
    await act("service_role");
    expect(await result("select public.cleanup_domain_requests(100) as value")).toBe(5);
    await db.exec("reset role");
    expect(await result("select count(*)::integer as value from snoozer.profile_domains where state='active'")).toBe(1);
  });

  it("records only consented recent verified referrals, hides small cohorts and honours permanent withdrawal", async () => {
    await act("authenticated", alice);
    await expect(db.query("select public.set_my_referral_enabled(true)")).rejects.toMatchObject({ code: "22023" });
    await claim("referral-alice");
    await save(0, "Alice", [], true);
    await db.query("select public.set_my_referral_enabled(true)");
    const report = await result<{ code: string }>("select public.get_my_growth() as value");
    const metadata = { snoozer_referral: report!.code, snoozer_referral_consent: true };
    await db.exec("reset role");
    await db.query("update auth.users set created_at=clock_timestamp(),raw_user_meta_data=$1 where id=$2", [JSON.stringify(metadata), bob]);
    await act("authenticated", bob);
    expect(await result("select public.accept_my_referral() as value")).toBe("accepted");
    expect(await result("select public.accept_my_referral() as value")).toBe("already_recorded");
    await claim("referral-bob");
    await save(0, "Bob", [], true);
    await act("authenticated", alice);
    expect(await result("select public.get_my_growth() as value")).toMatchObject({ verified: 1, claimed: null, published: null });
    await act("authenticated", bob);
    await db.query("select public.withdraw_my_referral()");
    expect(await result("select public.get_my_growth() as value")).toMatchObject({ attribution: "withdrawn" });
    expect(await result("select public.accept_my_referral() as value")).toBe("already_recorded");
    await act("authenticated", alice);
    expect(await result("select public.get_my_growth() as value")).toMatchObject({ verified: 0 });
    await db.exec("reset role");
    expect(await result("select raw_user_meta_data as value from auth.users where id=$1", [bob])).toEqual({});
  });

  it("refuses forged, stale, disabled and self referrals without exposing private tables", async () => {
    await act("authenticated", alice);
    await claim("referral-alice");
    await save(0, "Alice", [], true);
    await db.query("select public.set_my_referral_enabled(true)");
    const report = await result<{ code: string }>("select public.get_my_growth() as value");
    const metadata = { snoozer_referral: report!.code, snoozer_referral_consent: true };
    for (const [id, consent, age, code] of [
      [alice, true, "0 seconds", report!.code], [bob, false, "0 seconds", report!.code],
      [bob, true, "25 hours", report!.code], [bob, true, "0 seconds", "not-a-uuid"],
    ] as const) {
      await db.exec("reset role");
      await db.query("update auth.users set created_at=clock_timestamp()-$1::interval,raw_user_meta_data=$2 where id=$3", [age, JSON.stringify({ ...metadata, snoozer_referral: code, snoozer_referral_consent: consent }), id]);
      await act("authenticated", id);
      expect(await result("select public.accept_my_referral() as value")).toBe("ineligible");
    }
    await act("authenticated", alice);
    await db.query("select public.set_my_referral_enabled(false)");
    await db.exec("reset role");
    await db.query("update auth.users set raw_user_meta_data=$1 where id=$2", [JSON.stringify(metadata), bob]);
    await act("authenticated", bob);
    expect(await result("select public.accept_my_referral() as value")).toBe("ineligible");
    await expect(db.query("select * from snoozer.referral_attributions")).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select * from snoozer.referral_codes")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", unverified);
    await expect(db.query("select public.accept_my_referral()")).rejects.toMatchObject({ code: "42501" });
    await act("anon");
    await expect(db.query("select public.get_my_growth()")).rejects.toMatchObject({ code: "42501" });
  });

  it("reports current profile stages only at the cohort threshold and removes deleted members", async () => {
    await act("authenticated", alice);
    await claim("referral-alice");
    await save(0, "Alice", [], true);
    await db.query("select public.set_my_referral_enabled(true)");
    const report = await result<{ code: string }>("select public.get_my_growth() as value");
    const ids = Array.from({ length: 5 }, (_, i) => "00000000-0000-4000-8000-00000000010" + i);
    try {
      for (const [index, id] of ids.entries()) {
        await db.exec("reset role");
        await db.query("insert into auth.users(id,email_confirmed_at,created_at,raw_user_meta_data) values($1,now(),clock_timestamp(),$2)", [id, JSON.stringify({ snoozer_referral: report!.code, snoozer_referral_consent: true })]);
        await act("authenticated", id);
        expect(await result("select public.accept_my_referral() as value")).toBe("accepted");
        if (index === 0) { await claim("referral-member"); await save(0, "Member", [], true); }
      }
      await act("authenticated", alice);
      expect(await result("select public.get_my_growth() as value")).toMatchObject({ verified: 5, claimed: 1, published: 1 });
      await db.exec("reset role");
      await db.query("delete from auth.users where id=$1", [ids[4]]);
      await act("authenticated", alice);
      expect(await result("select public.get_my_growth() as value")).toMatchObject({ verified: 4, claimed: null, published: null });
    } finally { await db.exec("reset role"); await db.query("delete from auth.users where id=any($1::uuid[])", [ids]); }
  });

  it("leases public widget refreshes and refuses stale completions or direct cache access", async () => {
    await act("service_role");
    const claimed = await result<{ state: string; lease: string }>("select public.claim_public_widget('github','example/repo') as value");
    expect(claimed?.state).toBe("refresh");
    expect(await result("select public.claim_public_widget('github','example/repo') as value")).toMatchObject({ state: "pending" });
    expect(await result("select public.complete_public_widget('github','example/repo',$1,'{}',0) as value", [avatar])).toBe(false);
    await db.exec("reset role; update snoozer.public_widget_cache set lease_until=now()-interval '1 second'; update snoozer.public_widget_limits set next_allowed=now()-interval '1 second'");
    await act("service_role");
    const replacement = await result<{ state: string; lease: string }>("select public.claim_public_widget('github','example/repo') as value");
    expect(replacement?.state).toBe("refresh");
    expect(replacement?.lease).not.toBe(claimed?.lease);
    expect(await result("select public.complete_public_widget('github','example/repo',$1,'{}',0) as value", [claimed?.lease])).toBe(false);
    expect(await result("select public.complete_public_widget('github','example/repo',$1,'{}',0) as value", [replacement?.lease])).toBe(true);
    expect(await result("select public.claim_public_widget('github','example/repo') as value")).toEqual({ state: "cached", payload: {} });
    await expect(db.query("select * from snoozer.public_widget_cache")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    await expect(db.query("select public.claim_public_widget('github','example/repo')")).rejects.toMatchObject({ code: "42501" });
    await act("anon");
    await expect(db.query("select public.complete_public_widget('github','example/repo',$1,'{}',0)", [replacement?.lease])).rejects.toMatchObject({ code: "42501" });
  });

  it("bounds provider requests without allocating unlimited cache keys and preserves provider backoff across hour rollover", async () => {
    await db.exec("insert into snoozer.public_widget_limits(provider,window_start,used) values('github',date_trunc('hour',now()),39)");
    await act("service_role");
    const claimed = await result<{ lease: string }>("select public.claim_public_widget('github','example/last') as value");
    expect(claimed?.lease).toMatch(/^[0-9a-f-]{36}$/);
    expect(await result("select public.claim_public_widget('github','example/limited') as value")).toMatchObject({ state: "limited" });
    expect(await result("select public.complete_public_widget('github','example/last',$1,null,3600) as value", [claimed?.lease])).toBe(true);
    expect(await result("select public.claim_public_widget('github','example/last') as value")).toEqual({ state: "unavailable" });
    await db.exec("reset role; update snoozer.public_widget_limits set window_start=now()-interval '1 hour',used=0,next_allowed=now()-interval '1 second'");
    await act("service_role");
    expect(await result("select public.claim_public_widget('github','example/after-rollover') as value")).toMatchObject({ state: "limited" });
    await db.exec("reset role");
    expect(await result("select count(*)::int as value from snoozer.public_widget_cache")).toBe(1);
  });

  it("rejects unsupported provider cache keys and sweeps expired public metadata opportunistically", async () => {
    await act("service_role");
    await expect(db.query("select public.claim_public_widget('github','../private')")).rejects.toMatchObject({ code: "22023" });
    await expect(db.query("select public.claim_public_widget('unsupported','resource')")).rejects.toMatchObject({ code: "22023" });
    const claimed = await result<{ lease: string }>("select public.claim_public_widget('discord','i:Example') as value");
    expect(await result("select public.complete_public_widget('discord','i:Example',$1,'{}',0) as value", [claimed?.lease])).toBe(true);
    await db.exec("reset role; update snoozer.public_widget_cache set expires_at=now()-interval '8 days',lease_until=now()-interval '8 days'; update snoozer.public_widget_limits set next_allowed=now()-interval '1 second'");
    await act("service_role");
    expect(await result("select public.claim_public_widget('discord','i:Another') as value")).toMatchObject({ state: "refresh" });
    await db.exec("reset role");
    expect(await result("select count(*)::int as value from snoozer.public_widget_cache where resource='i:Example'")).toBe(0);
  });

  it("binds campaign attribution to the published profile and stops new attribution when paused", async () => {
    await act("authenticated", alice);
    await claim("traffic-alice");
    await save(0, "Traffic", [{ label: "Work", url: "https://example.com" }], true);
    const profile = (await draft() as { profile_id: string }).profile_id;
    const campaign = await result<string>("select public.create_analytics_campaign($1,'Newsletter') as value", [profile]);
    expect(campaign).toMatch(/^[0-9a-f-]{36}$/);
    expect(await result("select public.create_analytics_campaign($1,'Newsletter') as value", [profile])).toBe(campaign);
    await act("authenticated", bob);
    await claim("traffic-bob");
    const other = (await draft() as { profile_id: string }).profile_id;
    const otherCampaign = await result<string>("select public.create_analytics_campaign($1,'Other') as value", [other]);
    await expect(db.query("select public.create_analytics_campaign($1,'Denied')", [profile])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select public.set_analytics_campaign_active($1,$2,false)", [other, campaign])).rejects.toMatchObject({ code: "42501" });
    expect((await db.query("select * from public.get_my_analytics_campaigns($1)", [profile])).rows).toEqual([]);
    await act("service_role");
    const record = (code: string, id: string) => db.query(
      "select public.record_profile_event_with_context('traffic-alice',$1,'view',null,null,null,'email',$2,'mobile')", [id, code]);
    await record(campaign!, avatar);
    await record(campaign!, avatar);
    await record(otherCampaign!, bob); // a foreign code must not attribute to either creator's campaign
    await act("authenticated", alice);
    const totals = () => db.query("select * from public.get_my_profile_traffic_totals($1)", [profile]);
    expect((await totals()).rows).toEqual(expect.arrayContaining([
      { campaign, label: "Newsletter", source: "email", device: "mobile", views: 1, clicks: 0 },
      { campaign: null, label: "No campaign", source: "email", device: "mobile", views: 1, clicks: 0 },
    ]));
    await db.query("select public.set_analytics_campaign_active($1,$2,false)", [profile, campaign]);
    await act("service_role");
    await record(campaign!, alice);
    await act("authenticated", alice);
    expect((await totals()).rows).toEqual(expect.arrayContaining([
      { campaign, label: "Newsletter", source: "email", device: "mobile", views: 1, clicks: 0 },
      { campaign: null, label: "No campaign", source: "email", device: "mobile", views: 2, clicks: 0 },
    ]));
    await db.query("select public.set_analytics_campaign_active($1,$2,true)", [profile, campaign]);
    expect((await db.query("select * from public.get_my_analytics_campaigns($1)", [profile])).rows).toEqual([
      { id: campaign, label: "Newsletter", active: true },
    ]);
    await act("authenticated", bob);
    expect((await totals()).rows).toEqual([]);
    await act("anon");
    await expect(totals()).rejects.toMatchObject({ code: "42501" });
  });

  it("bounds saved campaigns, validates input and denies direct campaign access", async () => {
    await act("authenticated", alice);
    await claim("campaign-quota");
    const profile = (await draft() as { profile_id: string }).profile_id;
    await expect(db.query("select public.create_analytics_campaign($1,'  ')", [profile])).rejects.toMatchObject({ code: "22023" });
    for (let index = 0; index < 20; index++) await db.query("select public.create_analytics_campaign($1,$2)", [profile, "Campaign " + index]);
    await expect(db.query("select public.create_analytics_campaign($1,'Over capacity')", [profile])).rejects.toMatchObject({ code: "P1006" });
    await expect(db.query("select * from snoozer.analytics_campaigns")).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    await expect(db.query("select public.create_analytics_campaign($1,'Denied')", [profile])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select * from snoozer.profile_traffic_days")).rejects.toMatchObject({ code: "42501" });
  });

  it("deduplicates daily browsers, handles click-before-view and preserves legacy event callers", async () => {
    await act("authenticated", alice);
    await claim("daily-browsers");
    await save(0, "Daily", [{ label: "Work", url: "https://example.com" }], true);
    const profile = (await draft() as { profile_id: string }).profile_id;
    await act("service_role");
    const record = (kind: string, key: string | null, event = crypto.randomUUID(), actor: string | null = null, url = "https://example.com") =>
      db.query("select public.record_profile_event_with_browser('daily-browsers',$1,$2,$3,1,$4,'direct',null,'desktop',$5)", [event, kind, actor, url, key]);
    const key = "a".repeat(64);
    const another = "b".repeat(64);
    await record("click", key, avatar);
    await record("click", key, avatar); // receipt replay
    await record("view", key);
    await record("view", key); // reload
    await record("click", key);
    await record("view", another);
    await record("click", another);
    await record("view", key, crypto.randomUUID(), alice);
    await record("click", "c".repeat(64), crypto.randomUUID(), null, "https://unpublished.com");
    await record("view", "malformed"); // event still counts, browser metric omitted
    await db.query("select public.record_profile_event('daily-browsers',gen_random_uuid(),'view',null)");
    await expect(db.query("select * from snoozer.profile_browser_days")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    expect((await db.query("select * from public.get_my_profile_view_days($1)", [profile])).rows)
      .toEqual([{ day: expect.any(Date), views: 5, clicks: 3 }]);
    expect((await db.query("select * from public.get_my_profile_browser_days($1)", [profile])).rows)
      .toEqual([{ day: expect.any(Date), unique_browsers: 2, clicked_browsers: 2 }]);
    await expect(record("view", key)).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select * from snoozer.profile_browser_days")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", bob);
    expect((await db.query("select * from public.get_my_profile_browser_days($1)", [profile])).rows).toEqual([]);
    await act("anon");
    await expect(db.query("select * from public.get_my_profile_browser_days($1)", [profile])).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
    await db.query("delete from snoozer.profiles where id=$1", [profile]);
    expect(await result("select count(*)::int as value from snoozer.profile_browser_days")).toBe(0);
  });

  it("purges previous-day browser hashes while retaining aggregates and prevents changes at the daily cap", async () => {
    await act("authenticated", alice);
    await claim("browser-retention");
    await save(0, "Daily", [], true);
    const profile = (await draft() as { profile_id: string }).profile_id;
    await db.exec("reset role");
    await db.query(`insert into snoozer.profile_view_days(profile_id,day,views,unique_browsers) values
      ($1,(now() at time zone 'UTC')::date-1,1,1), ($1,(now() at time zone 'UTC')::date,10000,1)`, [profile]);
    await db.query(`insert into snoozer.profile_browser_days values($1,(now() at time zone 'UTC')::date-1,$2,true,false)`, [profile,"a".repeat(64)]);
    await act("service_role");
    await db.query("select public.record_profile_event_with_browser('browser-retention',gen_random_uuid(),'view',null,null,null,'direct',null,'desktop',$1)", ["b".repeat(64)]);
    await db.exec("reset role");
    expect(await result("select count(*)::int as value from snoozer.profile_browser_days")).toBe(0);
    expect(await result("select sum(unique_browsers)::int as value from snoozer.profile_view_days")).toBe(2);
    await db.query(`insert into snoozer.profile_browser_days values($1,(now() at time zone 'UTC')::date-1,$2,true,false)`, [profile,"c".repeat(64)]);
    await act("service_role");
    await db.query("select public.purge_profile_analytics()");
    await db.exec("reset role");
    expect(await result("select count(*)::int as value from snoozer.profile_browser_days")).toBe(0);
    expect(await result("select count(*)::int as value from snoozer.profile_view_days")).toBe(2);
  });

  it("counts only published profiles, deduplicates events and isolates owner analytics", async () => {
    await act("authenticated", alice);
    await claim("analytics-alice");
    const profile = (await draft() as { profile_id: string }).profile_id;
    await act("service_role");
    const record = (kind = "view", actor: string | null = null, url = "https://example.com") =>
      db.query("select public.record_profile_event('analytics-alice',$1,$2,$3,1,$4)", [avatar, kind, actor, url]);
    await record();
    await act("authenticated", alice);
    expect((await db.query("select * from public.get_my_profile_view_days($1)", [profile])).rows).toEqual([]);
    await save(0, "Analytics", [{ label: "Work", url: "https://example.com" }], true);
    await act("service_role");
    await record("view", alice); // authenticated owner's real visits do not count
    await record("view");
    await record("view");
    await record("click", null, "https://unpublished.com");
    await record("click");
    await record("click");
    await expect(db.query("select * from snoozer.profile_view_days")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    const rows = (await db.query("select * from public.get_my_profile_view_days($1)", [profile])).rows;
    expect(rows).toEqual([{ day: expect.any(Date), views: 1, clicks: 1 }]);
    expect((await db.query("select * from public.get_my_profile_link_totals($1)", [profile])).rows)
      .toEqual([{ label: "Work", url: "https://example.com", clicks: 1 }]);
    await expect(record()).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select public.purge_profile_analytics()")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", bob);
    expect((await db.query("select * from public.get_my_profile_view_days($1)", [profile])).rows).toEqual([]);
    expect((await db.query("select * from public.get_my_profile_link_totals($1)", [profile])).rows).toEqual([]);
    await act("anon");
    await expect(db.query("select * from public.get_my_profile_view_days($1)", [profile])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select * from public.get_my_profile_link_totals($1)", [profile])).rejects.toMatchObject({ code: "42501" });
  });

  it("enforces analytics retention, bounded intake and cascading profile deletion", async () => {
    await act("authenticated", alice);
    await claim("analytics-retention");
    await save(0, "Analytics", [], true);
    const profile = (await draft() as { profile_id: string }).profile_id;
    await db.exec("reset role");
    await db.query(`insert into snoozer.profile_view_days(profile_id,day,views) values
      ($1,(now() at time zone 'UTC')::date - 30,50),
      ($1,(now() at time zone 'UTC')::date - 29,40),
      ($1,(now() at time zone 'UTC')::date,10000)`, [profile]);
    await act("authenticated", alice);
    expect((await db.query("select * from public.get_my_profile_view_days($1)", [profile])).rows).toHaveLength(2);
    await act("service_role");
    await db.query("select public.record_profile_event('analytics-retention',$1,'view',null)", [avatar]);
    expect(await result("select public.purge_profile_analytics() as value")).toBe(0); // intake already purged oldest day
    await db.exec("reset role");
    expect(await result("select count(*)::int as value from snoozer.profile_view_receipts")).toBe(0);
    expect(await result("select sum(views)::int as value from snoozer.profile_view_days")).toBe(10040);
    await db.query("delete from snoozer.profiles where id=$1", [profile]);
    expect(await result("select count(*)::int as value from snoozer.profile_view_days")).toBe(0);
  });

  it("purges inactive analytics and applies the current plan after a downgrade", async () => {
    await act("authenticated", alice);
    await claim("analytics-plan");
    const profile = (await draft() as { profile_id: string }).profile_id;
    await db.exec("reset role");
    await db.query("insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at) values ($1,'plus',1,'gift','analytics-plan',now()-interval '1 day',now()+interval '1 day')", [alice]);
    await db.query(`insert into snoozer.profile_view_days(profile_id,day,views) values
      ($1,(now() at time zone 'UTC')::date - 100,10),
      ($1,(now() at time zone 'UTC')::date - 10,5)`, [profile]);
    await db.query(`insert into snoozer.profile_view_receipts(profile_id,day,event_id,kind)
      values ($1,(now() at time zone 'UTC')::date - 100,$2,'view')`, [profile, avatar]);
    await db.query(`insert into snoozer.profile_link_days(profile_id,day,revision,position,label,url,clicks)
      values ($1,(now() at time zone 'UTC')::date - 100,1,1,'Work','https://example.com',2)`, [profile]);
    await act("authenticated", alice);
    expect((await db.query("select * from public.get_my_profile_view_days($1)", [profile])).rows).toHaveLength(2);
    expect((await db.query("select * from public.get_my_profile_link_totals($1)", [profile])).rows).toHaveLength(1);
    await db.exec("reset role; update snoozer.entitlement_grants set revoked_at=now() where source_ref='analytics-plan'");
    await act("authenticated", alice);
    expect((await db.query("select * from public.get_my_profile_view_days($1)", [profile])).rows).toHaveLength(1);
    expect((await db.query("select * from public.get_my_profile_link_totals($1)", [profile])).rows).toHaveLength(0);
    await act("service_role");
    expect(await result("select public.purge_profile_analytics() as value")).toBe(1);
    await db.exec("reset role");
    expect(await result("select count(*)::int as value from snoozer.profile_view_receipts")).toBe(0);
    expect(await result("select sum(views)::int as value from snoozer.profile_view_days")).toBe(5);
    expect(await result("select count(*)::int as value from snoozer.profile_link_days")).toBe(0);
  });

  it("enforces plan link limits without deleting links after a downgrade", async () => {
    const links = Array.from({ length: 21 }, (_, index) => ({ label: "Link " + index, url: "https://example.com/" + index }));
    await act("authenticated", alice);
    await claim("quota-alice");
    await expect(save(0, "Test", links, false)).rejects.toMatchObject({ code: "P1004" });
    await db.exec("reset role");
    await db.query("insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at) values ($1,'plus',1,'gift','link-test',now()-interval '1 day',now()+interval '1 day')", [alice]);
    await act("authenticated", alice);
    expect(await save(0, "Test", links, true)).toBe(1);
    await db.exec("reset role; update snoozer.entitlement_grants set revoked_at=now() where source_ref='link-test'");
    await act("authenticated", alice);
    expect(await draft()).toMatchObject({ links });
    expect(await published("quota-alice")).toMatchObject({ links });
    expect(await save(1, "Bio updated", links, false)).toBe(2);
    await expect(save(2, "Bio updated", links, true)).rejects.toMatchObject({ code: "P1004" });
    const changed = links.map((link, index) => index === 20 ? { ...link, label: "Edited" } : link);
    await expect(save(2, "Bio updated", changed, false)).rejects.toMatchObject({ code: "P1004" });
    await expect(db.query("select public.restore_publication(1,2)")).rejects.toMatchObject({ code: "P1004" });
    expect(await save(2, "Reduced", links.slice(0, 20), true)).toBe(3);
    expect(await published("quota-alice")).toMatchObject({ links: links.slice(0, 20) });
  });

  it("binds a stored completion receipt only to its original sandbox customer and owner", async () => {
    await db.exec("insert into snoozer.stripe_sandbox_prices values ('price_Binding','plus',1,'month','gbp',399,null)");
    await db.query(
      "insert into snoozer.stripe_sandbox_checkout_attempts(owner_id,price_id,customer_id,session_id) values ($1,'price_Binding','cus_Owner','cs_test_Bound')",
      [alice],
    );
    const bind = (owner: string, customer = "cus_Owner", subscription = "sub_Original") => result(
      "select public.bind_stripe_sandbox_subscription('evt_Binding','cs_test_Bound',$1,$2,$3) as value",
      [customer, owner, subscription],
    );
    const lookup = () => db.query("select * from public.stripe_sandbox_checkout_for_receipt('evt_Binding')");
    await act("authenticated", alice);
    await expect(bind(alice)).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    expect(await bind(alice)).toBe(false);
    await db.query("select public.record_stripe_sandbox_event('evt_Binding','checkout.session.completed','cs_test_Bound',now())");
    expect((await lookup()).rows).toEqual([{ session_id: "cs_test_Bound", customer_id: "cus_Owner", owner_id: alice }]);
    expect(await bind(bob)).toBe(false);
    expect(await bind(alice, "cus_Other")).toBe(false);
    expect(await bind(alice)).toBe(true);
    expect(await bind(alice)).toBe(true);
    expect(await bind(alice, "cus_Owner", "sub_Other")).toBe(false);
    expect((await lookup()).rows).toHaveLength(1);
    await act("authenticated", alice);
    expect(await result("select public.get_my_plan() as value")).toMatchObject({ plan: "free" });
  });

  it("checks current billing staff roles and audits every authorised read", async () => {
    const canRead = () => result("select public.can_read_billing_diagnostics() as value");
    const read = () => result("select public.read_staff_billing_diagnostics() as value");
    await db.query("insert into snoozer.staff_roles(owner_id,role) values ($1,'billing_diagnostics'),($2,'billing_diagnostics')", [alice,unverified]);
    await act("anon");
    await expect(read()).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", unverified);
    await expect(read()).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", bob);
    expect(await canRead()).toBe(false);
    await expect(read()).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select * from snoozer.billing_diagnostics_access")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    expect(await canRead()).toBe(true);
    expect(await read()).toMatchObject({ kofi: { pendingReviews: 0 } });
    await act("service_role");
    await expect(db.query("delete from snoozer.billing_diagnostics_access")).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
    expect((await db.query("select actor_id from snoozer.billing_diagnostics_access")).rows).toEqual([{ actor_id: alice }]);
    await db.query("delete from snoozer.staff_roles where owner_id=$1", [alice]);
    await act("authenticated", alice);
    expect(await canRead()).toBe(false);
    await expect(read()).rejects.toMatchObject({ code: "42501" });
  });

  it("fulfills paid sandbox gifts once and applies refunds before or after redemption", async () => {
    const offerId = await result<string>("insert into snoozer.stripe_sandbox_gift_offers(price_id,plan,plan_version,duration_days,amount_pence) values ('price_Gift','plus',1,30,399) returning id as value");
    const prepare = (request: string) => result<string>(
      "select order_id as value from public.prepare_stripe_sandbox_gift($1,$2,$3)", [alice,offerId,request],
    );
    const bind = (order: string, session: string) => result(
      "select public.bind_stripe_sandbox_gift_session($1,$2,$3) as value", [alice,order,session],
    );
    const complete = (event: string, order: string, session: string, payment: string, amount = 399, owner = alice) =>
      result("select public.fulfill_stripe_sandbox_gift($1,$2,$3,$4,$5,'price_Gift',$6,sha256(convert_to($7,'UTF8'))) as value",
        [event, owner, order, session, payment, amount, "a".repeat(32)]);
    const refund = (payment: string) => db.query("select public.hold_stripe_sandbox_gift_payment('evt_GiftRefund',$1)", [payment]);

    await act("authenticated", alice);
    await expect(prepare(alice)).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    const original = (await prepare(alice))!;
    expect(await prepare(alice)).toBe(original);
    const held = (await prepare(bob))!;
    expect(await bind(original, "cs_test_Gift")).toBe(true);
    expect(await bind(held, "cs_test_Held")).toBe(true);
    expect(await complete("evt_Gift", original, "cs_test_Gift", "pi_Gift")).toBe("unmatched");
    await db.exec("select public.record_stripe_sandbox_event('evt_Gift','checkout.session.completed','cs_test_Gift',now()); select public.record_stripe_sandbox_event('evt_Held','checkout.session.completed','cs_test_Held',now()); select public.record_stripe_sandbox_event('evt_GiftRefund','charge.refunded','ch_Gift',now());");
    expect(await complete("evt_Gift", original, "cs_test_Gift", "pi_Gift", 398)).toBe("unmatched");
    expect(await complete("evt_Gift", original, "cs_test_Gift", "pi_Gift", 399, bob)).toBe("unmatched");
    const diagnostics = () => result("select public.get_billing_diagnostics() as value");
    expect(await diagnostics()).toMatchObject({
      stripeSandbox: { unboundCompletionReceipts: 0, giftsAwaitingFulfillment: 2 },
    });
    await refund("pi_Held");
    expect(await complete("evt_Held", held, "cs_test_Held", "pi_Held")).toBe("held");
    expect(await complete("evt_Gift", original, "cs_test_Gift", "pi_Gift")).toBe("fulfilled");
    expect(await complete("evt_Gift", original, "cs_test_Gift", "pi_Gift")).toBe("fulfilled");
    expect(await diagnostics()).toMatchObject({
      stripeSandbox: { unboundCompletionReceipts: 0, giftsAwaitingFulfillment: 1 },
    });
    await act("authenticated", alice);
    expect((await db.query("select status from public.list_my_stripe_sandbox_gifts()")).rows).toEqual([{ status: "ready" }]);
    await act("authenticated", bob);
    expect((await db.query("select status from public.list_my_stripe_sandbox_gifts()")).rows).toEqual([]);
    await act("authenticated", bob);
    expect(await result("select public.redeem_gift_code($1) as value", ["a".repeat(32)])).toBe(true);
    expect(await result("select public.get_my_plan() as value")).toMatchObject({ plan: "plus" });
    await act("service_role");
    await refund("pi_Gift");
    await refund("pi_Gift");
    expect(await complete("evt_Gift", original, "cs_test_Gift", "pi_Gift")).toBe("held");
    await act("authenticated", bob);
    expect(await result("select public.get_my_plan() as value")).toMatchObject({ plan: "free" });
  });

  it("restores a paid gift after a won dispute while preserving other holds and manual revocation", async () => {
    const offer = await result<string>("insert into snoozer.stripe_sandbox_gift_offers(price_id,plan,plan_version,duration_days,amount_pence) values ('price_WonGift','plus',1,30,399) returning id as value");
    await act("service_role");
    const order = await result<string>("select order_id as value from public.prepare_stripe_sandbox_gift($1,$2,$1)", [alice,offer]);
    await db.query("select public.bind_stripe_sandbox_gift_session($1,$2,'cs_test_WonGift')", [alice,order]);
    const event = (id: string, kind: string, object: string) =>
      db.query("select public.record_stripe_sandbox_event($1,$2,$3,now())", [id,kind,object]);
    const hold = (id: string) => db.query("select public.hold_stripe_sandbox_gift_payment($1,'pi_WonGift')", [id]);
    const release = (id: string, dispute: string) =>
      db.query("select public.release_stripe_sandbox_gift_dispute($1,$2,'pi_WonGift')", [id,dispute]);
    const plan = () => result("select public.get_my_plan() as value");

    const code = "b".repeat(32);
    await event("evt_GiftPaid", "checkout.session.completed", "cs_test_WonGift");
    await db.query(
      "select public.fulfill_stripe_sandbox_gift('evt_GiftPaid',$1,$2,'cs_test_WonGift','pi_WonGift','price_WonGift',399,sha256(convert_to($3,'UTF8')))",
      [alice,order,code],
    );
    await event("evt_GiftOpened", "charge.dispute.created", "du_WonGift");
    await hold("evt_GiftOpened");
    await act("authenticated", bob);
    expect(await result("select public.redeem_gift_code($1) as value", [code])).toBe(false);
    await act("service_role");
    await event("evt_GiftWon", "charge.dispute.closed", "du_WonGift");
    await release("evt_GiftWon", "du_WonGift");
    await hold("evt_GiftOpened");
    await act("authenticated", bob);
    expect(await result("select public.redeem_gift_code($1) as value", [code])).toBe(true);
    expect(await plan()).toMatchObject({ plan: "plus" });

    await act("service_role");
    await event("evt_GiftOpenedAgain", "charge.dispute.created", "du_SecondGift");
    await hold("evt_GiftOpenedAgain");
    await act("authenticated", bob);
    expect(await plan()).toMatchObject({ plan: "free" });
    await act("service_role");
    await event("evt_GiftWonAgain", "charge.dispute.closed", "du_SecondGift");
    await release("evt_GiftWonAgain", "du_SecondGift");
    await act("authenticated", bob);
    expect(await plan()).toMatchObject({ plan: "plus" });

    await act("service_role");
    await event("evt_GiftStillRefunded", "charge.refunded", "ch_WonGift");
    await hold("evt_GiftStillRefunded");
    await release("evt_GiftWonAgain", "du_SecondGift");
    await act("authenticated", bob);
    expect(await plan()).toMatchObject({ plan: "free" });
    await db.exec("reset role");
    await db.query("select public.revoke_gift_code(gift_id) from snoozer.stripe_sandbox_gift_orders where id=$1", [order]);
    await act("service_role");
    await release("evt_GiftWonAgain", "du_SecondGift");
    await act("authenticated", alice);
    expect((await db.query("select status from public.list_my_stripe_sandbox_gifts()")).rows).toEqual([{ status: "revoked" }]);
  });

  it("lists only unresolved legacy billing holds for authorised operators", async () => {
    const list = (after = "") => db.query("select cursor,event_id from public.list_legacy_billing_holds($1)", [after]);
    await db.exec("insert into snoozer.stripe_webhook_receipts(event_id,event_type,object_id,occurred_at) values ('evt_Legacy','charge.refunded','ch_Legacy',now());");
    await db.exec("insert into snoozer.stripe_sandbox_invoice_holds(invoice_id,subscription_id,customer_id,event_id,legacy) values ('in_Legacy','sub_Legacy','cus_Legacy','evt_Legacy',true), ('in_New','sub_Legacy','cus_Legacy','evt_Legacy',false);");
    await db.exec("insert into snoozer.stripe_sandbox_gift_payment_holds(payment_id,event_id,legacy,released_at) values ('pi_Legacy','evt_Legacy',true,null), ('pi_Released','evt_Legacy',true,now());");
    await act("authenticated", alice);
    await expect(list()).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    expect((await list()).rows).toEqual([
      { cursor: "gift:pi_Legacy", event_id: "evt_Legacy" },
      { cursor: "invoice:in_Legacy", event_id: "evt_Legacy" },
    ]);
    expect((await list("gift:pi_Legacy")).rows).toEqual([{ cursor: "invoice:in_Legacy", event_id: "evt_Legacy" }]);
  });

  it("gives only the billing operator aggregate diagnostics", async () => {
    const summary = () => result("select public.get_billing_diagnostics() as value");
    await act("authenticated", alice);
    await expect(summary()).rejects.toMatchObject({ code: "42501" });
    await db.query("select public.request_kofi_donation_review('diagnostics-review')");
    await act("service_role");
    await db.query("select public.issue_gift_code('plus',1,1,now()+interval '1 day')");
    await db.query("select public.record_stripe_sandbox_event('evt_Diagnostics','checkout.session.completed','cs_test_Diagnostics',now())");
    expect(await summary()).toEqual({
      stripeSandbox: {
        linkedSubscriptions: 0, staleUnboundAttempts: 0, unboundCompletionReceipts: 1,
        heldInvoices: 0, endedSubscriptions: 0, giftsAwaitingFulfillment: 0,
      },
      kofi: { unclaimedReceipts: 0, pendingReviews: 1 },
      gifts: { redeemableCodes: 1, activeGrants: 0 },
    });
  });

  it("redeems gifts once for verified accounts and revokes only the associated grant", async () => {
    const issue = () => db.query<{ gift_id: string; code: string }>(
      "select * from public.issue_gift_code('plus',1,30,now()+interval '1 day')",
    );
    const redeem = (code: string) => result("select public.redeem_gift_code($1) as value", [code]);
    const revoke = (id: string) => result("select public.revoke_gift_code($1) as value", [id]);
    const plan = () => result("select public.get_my_plan() as value");

    await act("authenticated", alice);
    await expect(issue()).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    const [gift] = (await issue()).rows;
    const [expired] = (await issue()).rows;
    const [revoked] = (await issue()).rows;
    expect(gift.code).toMatch(/^[a-f0-9]{32}$/);
    expect(await revoke(revoked.gift_id)).toBe(true);
    await db.exec("reset role");
    await db.query("update snoozer.gift_codes set issued_at = now()-interval '2 days', expires_at = now()-interval '1 day' where id=$1", [expired.gift_id]);
    await act("anon");
    await expect(redeem(gift.code)).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", unverified);
    await expect(redeem(gift.code)).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    await expect(revoke(gift.gift_id)).rejects.toMatchObject({ code: "42501" });
    expect(await redeem(expired.code)).toBe(false);
    expect(await redeem(revoked.code)).toBe(false);
    expect(await redeem(" " + gift.code.toUpperCase() + " ")).toBe(true);
    expect(await plan()).toMatchObject({ plan: "plus" });
    await act("authenticated", bob);
    expect(await redeem(gift.code)).toBe(false);
    expect(await plan()).toMatchObject({ plan: "free" });
    await act("service_role");
    expect(await revoke(gift.gift_id)).toBe(true);
    expect(await revoke(gift.gift_id)).toBe(false);
    await act("authenticated", alice);
    expect(await plan()).toMatchObject({ plan: "free" });
  });

  it("queues Ko-fi reviews without exposing receipt matches or granting access", async () => {
    const submit = (reference: string) => result("select public.request_kofi_donation_review($1) as value", [reference]);
    const mine = () => db.query("select reference,status from public.list_my_kofi_donation_reviews()");
    const queue = () => db.query<{ review_id: string; owner_id: string; reference: string }>(
      "select * from public.list_pending_kofi_donation_reviews()",
    );
    const resolve = (id: string, confirmed: boolean) =>
      result("select public.resolve_kofi_donation_review($1,$2) as value", [id,confirmed]);

    await act("anon");
    await expect(submit("receipt")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", unverified);
    await expect(submit("receipt")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    expect(await submit("review-receipt")).toBe("received");
    expect(await submit("review-receipt")).toBe("received");
    expect(await submit("missing-review")).toBe("received");
    expect(await submit("other-review")).toBe("received");
    expect(await submit("fourth-review")).toBe("limited");
    await expect(queue()).rejects.toMatchObject({ code: "42501" });
    expect((await mine()).rows).toHaveLength(3);
    await act("authenticated", bob);
    expect((await mine()).rows).toEqual([]);
    expect(await submit("review-receipt")).toBe("received");
    await act("service_role");
    const queued = (await queue()).rows;
    const first = queued.find((row) => row.owner_id === alice && row.reference === "review-receipt")!;
    const other = queued.find((row) => row.owner_id === bob && row.reference === "review-receipt")!;
    expect(await resolve(first.review_id, true)).toBe(false);
    await db.query("select public.record_kofi_donation($1,'review-receipt',now(),350)", [alice]);
    expect(await resolve(first.review_id, true)).toBe(true);
    expect(await resolve(first.review_id, false)).toBe(false);
    expect(await resolve(other.review_id, true)).toBe(false);
    expect(await resolve(other.review_id, false)).toBe(true);
    await act("authenticated", bob);
    expect((await mine()).rows).toEqual([{ reference: "review-receipt", status: "declined" }]);
    await act("authenticated", alice);
    expect((await mine()).rows).toContainEqual({ reference: "review-receipt", status: "confirmed" });
    expect(await result("select public.get_my_plan() as value")).toMatchObject({ plan: "free" });
    await db.exec("reset role; begin");
    try {
      await db.query("delete from auth.users where id=$1", [alice]);
      expect(await result("select claimed_at is not null as value from snoozer.kofi_donation_receipts where message_id=$1", [alice])).toBe(true);
    } finally {
      await db.exec("rollback");
    }
  });

  it("keeps Ko-fi donations private and deduplicates message and transaction IDs", async () => {
    const submit = (message: string, transaction: string) => db.query(
      "select public.record_kofi_donation($1,$2,now(),350)", [message, transaction],
    );
    await act("authenticated", alice);
    await expect(submit(alice, "first")).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    await submit(alice, "first");
    await submit(alice, "second");
    await submit(bob, "first");
    await expect(db.query("select * from snoozer.kofi_donation_receipts")).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
    expect((await db.query("select message_id,transaction_id,amount_pence from snoozer.kofi_donation_receipts")).rows)
      .toEqual([{ message_id: alice, transaction_id: "first", amount_pence: 350 }]);
  });

  it("keeps the original Ko-fi currency and amount on replay", async () => {
    const submit = (currency: string) => db.query(
      "select public.record_kofi_donation_in_currency($1,'currency-test',now(),350,$2)", [alice, currency],
    );
    await act("authenticated", alice);
    await expect(submit("USD")).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    await expect(submit("EUR")).rejects.toMatchObject({ code: "23514" });
    await submit("USD");
    await submit("GBP");
    await db.exec("reset role");
    expect((await db.query(
      "select amount_pence,currency from snoozer.kofi_donation_receipts where message_id=$1", [alice],
    )).rows).toEqual([{ amount_pence: 350, currency: "USD" }]);
  });

  it("exposes the sandbox portal customer only to the verified subscription owner", async () => {
    const customer = () => result("select public.get_my_stripe_sandbox_customer() as value");
    await db.exec("insert into snoozer.stripe_sandbox_prices values ('price_Portal','plus',1,'month','gbp',399,null)");
    await db.query(
      "insert into snoozer.stripe_sandbox_checkout_attempts(owner_id,price_id,customer_id,session_id,subscription_id) values ($1,'price_Portal','cus_Portal','cs_test_Portal','sub_Portal'), ($2,'price_Portal','cus_Pending',null,null)",
      [alice, bob],
    );
    await act("anon");
    await expect(customer()).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", unverified);
    await expect(customer()).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", bob);
    expect(await customer()).toBeNull();
    await act("authenticated", alice);
    expect(await customer()).toBe("cus_Portal");
  });

  it("archives ended Stripe subscriptions, revokes their grant and permits a new Checkout", async () => {
    await db.exec("insert into snoozer.stripe_sandbox_prices values ('price_End','plus',1,'month','gbp',399,null), ('price_New','pro',1,'month','gbp',799,null)");
    const original = await result<string>(
      "insert into snoozer.stripe_sandbox_checkout_attempts(owner_id,price_id,customer_id,session_id,subscription_id) values ($1,'price_End','cus_End','cs_test_End','sub_End') returning id as value", [alice],
    );
    await db.query("insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at) values ($1,'plus',1,'stripe','sandbox:sub_End',now()-interval '1 day',now()+interval '1 day')", [alice]);
    const start = () => result<number>("select revision as value from public.start_stripe_sandbox_reconciliation('sub_End')");
    const end = (revision: number, status = "canceled", customer = "cus_End") => result(
      "select public.end_stripe_sandbox_subscription('sub_End',$1,$2,$3) as value", [customer, revision, status],
    );
    const prepare = () => result("select public.prepare_stripe_sandbox_checkout($1,'pro','month') as value", [alice]);

    await act("authenticated", alice);
    await expect(end(1)).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    const stale = (await start())!;
    const current = (await start())!;
    expect(await end(stale)).toBe("retry");
    expect(await end(current, "unpaid")).toBe("retry");
    expect(await end(current, "canceled", "cus_Other")).toBe("retry");
    expect(await prepare()).toBeNull();
    expect(await end(current)).toBe("changed");
    expect(await start()).toBeUndefined();
    expect(await end(current)).toBe("retry");
    expect(await prepare()).toMatchObject({ priceId: "price_New", customerId: "cus_End", sessionId: null });
    expect(await prepare()).not.toMatchObject({ id: original });

    await act("authenticated", alice);
    expect(await result("select public.get_my_plan() as value")).toMatchObject({ plan: "free" });
    expect(await result("select public.get_my_stripe_sandbox_customer() as value")).toBe("cus_End");
    await act("authenticated", bob);
    expect(await result("select public.get_my_stripe_sandbox_customer() as value")).toBeNull();
    await db.exec("reset role");
    expect((await db.query("select subscription_id,attempt_id,terminal_status from snoozer.stripe_sandbox_ended_subscriptions")).rows)
      .toEqual([{ subscription_id: "sub_End", attempt_id: original, terminal_status: "canceled" }]);
  });

  it("claims bounded sweep batches and reports only actual grant changes", async () => {
    await db.exec("insert into snoozer.stripe_sandbox_prices values ('price_Sweep','plus',1,'month','gbp',399,null)");
    await db.query(
      "insert into snoozer.stripe_sandbox_checkout_attempts(owner_id,price_id,customer_id,session_id,subscription_id) values ($1,'price_Sweep','cus_Sweep','cs_test_Sweep','sub_Sweep'), ($2,'price_Sweep','cus_Unbound',null,null)", [alice,bob],
    );
    const claimSweep = () => db.query("select subscription_id from public.claim_stripe_sandbox_sweep()");
    await act("authenticated", alice);
    await expect(claimSweep()).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    expect((await claimSweep()).rows).toEqual([{ subscription_id: "sub_Sweep" }]);
    expect((await claimSweep()).rows).toEqual([]);

    const revision = () => result<number>("select revision as value from public.start_stripe_sandbox_reconciliation('sub_Sweep')");
    const sweep = (rev: number) => result(
      "select public.sweep_stripe_sandbox_grant('sub_Sweep','cus_Sweep','price_Sweep',$1,date_trunc('day',now()),date_trunc('day',now())+interval '2 days','in_Sweep') as value", [rev],
    );
    const first = (await revision())!;
    expect(await sweep(first)).toBe("changed");
    expect(await sweep(first)).toBe("retry");
    expect(await sweep((await revision())!)).toBe("unchanged");

    await db.exec("reset role; update snoozer.stripe_sandbox_checkout_attempts set next_sweep_at = now()-interval '1 minute'");
    await act("service_role");
    expect((await claimSweep()).rows).toEqual([{ subscription_id: "sub_Sweep" }]);
  });

  it("releases a won invoice dispute without clearing a refund or recreating the dispute on replay", async () => {
    const receipt = (id: string, type: string, object: string) =>
      db.query("select public.record_stripe_sandbox_event($1,$2,$3,now())", [id,type,object]);
    const hold = (event: string, invoice = "in_Disputed") =>
      db.query("select public.record_stripe_sandbox_invoice_hold($1,$2,'sub_Disputed','cus_Disputed')", [event,invoice]);
    const release = (event: string, dispute: string) =>
      db.query("select * from public.release_stripe_sandbox_invoice_dispute($1,$2)", [event,dispute]);

    await db.exec("insert into snoozer.stripe_sandbox_prices values ('price_Dispute','plus',1,'month','gbp',399,null)");
    await db.query(
      "insert into snoozer.stripe_sandbox_checkout_attempts(owner_id,price_id,customer_id,session_id,subscription_id) values ($1,'price_Dispute','cus_Disputed','cs_test_Disputed','sub_Disputed')", [alice],
    );
    const apply = async (invoice: string) => {
      const revision = await result<number>("select revision as value from public.start_stripe_sandbox_reconciliation('sub_Disputed')");
      return result(
        "select public.apply_stripe_sandbox_reconciliation('sub_Disputed','cus_Disputed','price_Dispute',$1,now()-interval '1 hour',now()+interval '1 day',$2) as value",
        [revision,invoice],
      );
    };
    await act("authenticated", alice);
    await expect(release("evt_Won", "du_Disputed")).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    await receipt("evt_Open", "charge.dispute.created", "du_Disputed");
    await receipt("evt_Won", "charge.dispute.closed", "du_Disputed");
    await receipt("evt_RefundSeparate", "charge.refunded", "ch_Disputed");
    await hold("evt_Open");
    await hold("evt_Open", "in_OnlyDispute");
    await hold("evt_RefundSeparate");
    expect((await release("evt_Won", "du_Other")).rows).toEqual([]);
    expect((await release("evt_Won", "du_Disputed")).rows).toEqual([{ subscription_id: "sub_Disputed" }]);
    await hold("evt_Open", "in_Late");
    expect((await release("evt_Won", "du_Disputed")).rows).toEqual([{ subscription_id: "sub_Disputed" }]);
    expect(await apply("in_Disputed")).toBe(true);
    await act("authenticated", alice);
    expect(await result("select public.get_my_plan() as value")).toMatchObject({ plan: "free" });
    await act("service_role");
    expect(await apply("in_OnlyDispute")).toBe(true);
    await act("authenticated", alice);
    expect(await result("select public.get_my_plan() as value")).toMatchObject({ plan: "plus" });
    await db.exec("reset role");
    expect((await db.query("select event_id from snoozer.stripe_sandbox_invoice_holds where released_at is null")).rows)
      .toEqual([{ event_id: "evt_RefundSeparate" }]);
  });

  it("applies only the latest sandbox reconciliation and revokes its own grant", async () => {
    await db.exec("insert into snoozer.stripe_sandbox_prices values ('price_Paid','plus',1,'month','gbp',399,null)");
    await db.query(
      "insert into snoozer.stripe_sandbox_checkout_attempts(owner_id,price_id,customer_id,session_id,subscription_id) values ($1,'price_Paid','cus_Paid','cs_test_Paid','sub_Paid')", [alice],
    );
    const start = () => result<number>("select revision as value from public.start_stripe_sandbox_reconciliation('sub_Paid')");
    const apply = (revision: number, paid: boolean, customer = "cus_Paid", invoice = "in_Paid") => result(
      "select public.apply_stripe_sandbox_reconciliation('sub_Paid',$1,'price_Paid',$2,case when $3 then now()-interval '1 hour' end,case when $3 then now()+interval '1 day' end,$4) as value",
      [customer, revision, paid, invoice],
    );
    const plan = () => result("select public.get_my_plan() as value");
    await act("authenticated", alice);
    await expect(start()).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    const stale = (await start())!;
    const current = (await start())!;
    expect(await apply(stale, true)).toBe(false);
    expect(await apply(current, true, "cus_Other")).toBe(false);
    expect(await apply(current, true)).toBe(true);
    expect(await apply(current, false)).toBe(false);
    await act("authenticated", alice);
    expect(await plan()).toMatchObject({ plan: "plus" });
    await act("authenticated", bob);
    expect(await plan()).toMatchObject({ plan: "free" });
    await act("service_role");
    await db.query("select public.record_stripe_sandbox_event('evt_Refund','charge.refunded','ch_Refund',now())");
    const hold = () => db.query("select public.record_stripe_sandbox_invoice_hold('evt_Refund','in_Paid','sub_Paid','cus_Paid')");
    await hold();
    await hold();
    expect(await apply((await start())!, true)).toBe(true);
    await act("authenticated", alice);
    expect(await plan()).toMatchObject({ plan: "free" });
    await act("service_role");
    expect(await apply((await start())!, true, "cus_Paid", "in_Renewed")).toBe(true);
    await act("authenticated", alice);
    expect(await plan()).toMatchObject({ plan: "plus" });
    await act("service_role");
    expect(await apply((await start())!, false)).toBe(true);
    await act("authenticated", alice);
    expect(await plan()).toMatchObject({ plan: "free" });
  });

  it("retires only old unbound Checkout attempts for the matching owner and customer", async () => {
    await db.exec("insert into snoozer.stripe_sandbox_prices values ('price_Stale','plus',1,'month','gbp',399,null)");
    await db.query(
      "insert into snoozer.stripe_sandbox_checkout_attempts(owner_id,price_id,customer_id,created_at) values ($1,'price_Stale','cus_Stale',now()-interval '3 hours')", [alice],
    );
    const stale = (owner: string) => result<string>("select id as value from public.get_stale_stripe_sandbox_checkout($1)", [owner]);
    const retire = (owner: string, id: string, customer: string) => result(
      "select public.retire_unsaved_stripe_sandbox_checkout($1,$2,$3,null) as value", [owner,id,customer],
    );
    await act("authenticated", alice);
    await expect(stale(alice)).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    const id = (await stale(alice))!;
    expect(await retire(bob, id, "cus_Stale")).toBe(false);
    expect(await retire(alice, id, "cus_Other")).toBe(false);
    expect(await retire(alice, id, "cus_Stale")).toBe(true);
    expect(await result("select public.bind_stripe_sandbox_checkout($1,$2,'cus_Stale','cs_test_Stale') as value", [alice,id])).toBe(false);
    expect(await result("select public.prepare_stripe_sandbox_checkout($1,'plus','month') as value", [alice]))
      .toMatchObject({ customerId: "cus_Stale", sessionId: null });
  });

  it("replaces only verified expired sandbox sessions while retaining customer and history", async () => {
    await db.exec("insert into snoozer.stripe_sandbox_prices values ('price_Original','plus',1,'month','gbp',399,null), ('price_Next','pro',1,'month','gbp',799,null)");
    await act("service_role");
    const prepare = (plan: string) => result<{ id: string; customerId: string | null; sessionId: string | null }>(
      "select public.prepare_stripe_sandbox_checkout($1,$2,'month') as value", [alice, plan],
    );
    const expire = (owner: string) => db.query(
      "select public.mark_stripe_sandbox_checkout_expired('evt_Expired','cs_test_Original','cus_Original',$1)",
      [owner],
    );
    const original = (await prepare("plus"))!;
    await db.query("select public.bind_stripe_sandbox_checkout($1,$2,'cus_Original',null)", [alice, original.id]);
    await db.query("select public.bind_stripe_sandbox_checkout($1,$2,'cus_Original','cs_test_Original')", [alice, original.id]);
    await expire(alice);
    expect(await prepare("pro")).toBeNull();
    await db.query("select public.record_stripe_sandbox_event('evt_Expired','checkout.session.expired','cs_test_Original',now())");
    await expire(bob);
    expect(await prepare("pro")).toBeNull();
    await expire(alice);
    const replacement = (await prepare("pro"))!;
    expect(replacement).toMatchObject({ customerId: "cus_Original", sessionId: null });
    expect(replacement.id).not.toBe(original.id);
    await expire(alice);
    expect(await prepare("pro")).toEqual(replacement);
    expect(await result("select public.bind_stripe_sandbox_checkout($1,$2,'cus_Original','cs_test_Original') as value",
      [alice, original.id])).toBe(false);
    await db.exec("reset role");
    expect((await db.query("select session_id,attempt_id from snoozer.stripe_sandbox_expired_checkouts")).rows)
      .toEqual([{ session_id: "cs_test_Original", attempt_id: original.id }]);
  });

  it("pins one sandbox Checkout attempt to a verified owner and its original payment objects", async () => {
    await db.exec("insert into snoozer.stripe_sandbox_prices values ('price_Checkout','plus',1,'month','gbp',399,null)");
    const prepare = (account: string, plan = "plus") => result<{ id: string }>(
      "select public.prepare_stripe_sandbox_checkout($1,$2,'month') as value", [account, plan],
    );
    const bind = (owner: string, attempt: string, customer: string, session: string | null = null) =>
      result("select public.bind_stripe_sandbox_checkout($1,$2,$3,$4) as value", [owner, attempt, customer, session]);
    await act("authenticated", alice);
    await expect(prepare(alice)).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    await expect(prepare(unverified)).rejects.toMatchObject({ code: "42501" });
    const attempt = (await prepare(alice))!;
    const other = (await prepare(bob))!;
    expect(await prepare(alice)).toEqual(attempt);
    expect(await prepare(alice, "pro")).toBeNull();
    expect(attempt.id).not.toBe(other.id);
    expect(await bind(bob, attempt.id, "cus_Bob")).toBe(false);
    expect(await bind(alice, attempt.id, "cus_Alice", "cs_test_Alice")).toBe(false);
    expect(await bind(alice, attempt.id, "cus_Alice")).toBe(true);
    expect(await bind(alice, attempt.id, "cus_Bob")).toBe(false);
    expect(await bind(alice, attempt.id, "cus_Alice", "cs_test_Alice")).toBe(true);
    expect(await bind(alice, attempt.id, "cus_Alice", "cs_test_Alice")).toBe(true);
    expect(await bind(alice, attempt.id, "cus_Alice", "cs_test_Other")).toBe(false);
    await expect(bind(bob, other.id, "cus_Alice")).rejects.toMatchObject({ code: "23505" });
    await db.exec("reset role");
    await db.query("update snoozer.stripe_sandbox_checkout_attempts set created_at=now()-interval '31 minutes' where owner_id=$1", [bob]);
    await act("service_role");
    expect(await prepare(bob)).toBeNull();
  });

  it("resolves the current sandbox offer and preserves retired prices", async () => {
    await db.exec(`insert into snoozer.stripe_sandbox_prices
      (price_id,plan,plan_version,billing_interval,currency,unit_amount,retired_at)
      values ('price_Old','plus',1,'month','gbp',399,now()),
        ('price_Current','plus',1,'month','gbp',499,null)`);
    await db.exec(`insert into snoozer.stripe_sandbox_gift_offers
      (price_id,plan,plan_version,duration_days,amount_pence,retired_at)
      values ('price_ActiveGift','plus',1,30,499,null), ('price_OldGift','plus',1,30,399,now())`);
    const preflight = () => db.query("select * from public.list_stripe_sandbox_preflight_offers() order by price_id");
    const resolve = (plan: string) => db.query(
      "select * from public.resolve_stripe_sandbox_price($1,'month')", [plan],
    );
    await act("authenticated", alice);
    await expect(resolve("plus")).rejects.toMatchObject({ code: "42501" });
    await expect(preflight()).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    expect((await resolve("plus")).rows).toEqual([
      { price_id: "price_Current", plan_version: 1, currency: "gbp", unit_amount: 499 },
    ]);
    expect((await resolve("free")).rows).toEqual([]);
    expect((await preflight()).rows).toEqual([
      { price_id: "price_ActiveGift", amount_pence: 499, billing_interval: null },
      { price_id: "price_Current", amount_pence: 499, billing_interval: "month" },
    ]);
    await db.exec("reset role");
    expect((await db.query("select price_id from snoozer.stripe_sandbox_prices where retired_at is not null")).rows)
      .toEqual([{ price_id: "price_Old" }]);
  });

  it("records Stripe receipts once through the service role and keeps them private", async () => {
    const write = (id: string, object: string) => db.query(
      "select public.record_stripe_sandbox_event($1,'checkout.session.completed',$2,'2026-11-10T20:00:00Z')",
      [id, object],
    );
    await act("authenticated", alice);
    await expect(write("evt_TestReceipt", "cs_test_First")).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    await expect(write("evt_RejectLive", "cs_live_First")).rejects.toMatchObject({ code: "22023" });
    await write("evt_TestReceipt", "cs_test_First");
    await write("evt_TestReceipt", "cs_test_Second");
    await expect(db.query("select * from snoozer.stripe_webhook_receipts")).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
    expect((await db.query("select event_id, object_id from snoozer.stripe_webhook_receipts")).rows)
      .toEqual([{ event_id: "evt_TestReceipt", object_id: "cs_test_First" }]);
  });

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

  it("uses the active plan to limit retained media without removing stored files after a downgrade", async () => {
    const current = () => result("select public.get_my_plan() as value");
    const openAvatar = () => result("select public.prepare_avatar_upload($1,0,true) as value", [alice]);
    const openGallery = () => result("select public.prepare_gallery_upload($1,0,'Example') as value", [alice]);
    const avatar = "7516e521-2a51-487a-a6ec-132df3aee350";
    await act("authenticated", alice);
    await claim("alice");
    await expect(openGallery()).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
    await db.query(`
      insert into storage.objects (bucket_id,name,created_at,metadata)
      select bucket, media_scope::text || '/' || filename, now(), jsonb_build_object('size', size)
      from snoozer.profiles
      cross join (
        select 'gallery-images' as bucket, n::text || '.webp' as filename, 1000000 as size
        from generate_series(1,101) n
        union all select 'gallery-incoming','pending.upload',2000000
      ) objects
      where owner_id = $1
    `, [alice]);
    await db.query(`insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at)
      values ($1,'plus',1,'staff','media-quota',now(),now()+interval '1 day')`, [alice]);
    await act("authenticated", alice);
    expect(accountPlan.parse(await current())).toMatchObject({ plan: "plus", usage: { mediaBytes: 101000000 } });
    await act("service_role");
    const stage = await openAvatar() as { key: string; scope: string };
    expect(await openGallery()).toMatchObject({ scope: stage.scope });
    await db.exec("reset role");
    await db.exec("update snoozer.entitlement_grants set payment_held = true where source_ref = 'media-quota'");
    await act("service_role");
    await expect(openGallery()).rejects.toMatchObject({ code: "P1104" });
    await expect(openAvatar()).rejects.toMatchObject({ code: "P1104" });
    await expect(result("select public.commit_avatar_upload($1,0,$2,$3) as value", [alice, stage.key, avatar]))
      .rejects.toMatchObject({ code: "P1104" });
    await act("authenticated", alice);
    expect(accountPlan.parse(await current())).toMatchObject({ plan: "free", usage: { mediaBytes: 101000000 } });
    expect(await draft()).toMatchObject({ revision: 0, avatar: null });
    await act("authenticated", bob);
    expect(accountPlan.parse(await current())).toMatchObject({ usage: { mediaBytes: 0 } });
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

  it("lists stable profile IDs only for the verified owner", async () => {
    const list = () => result<{ id: string; username: string; published: boolean }[]>("select public.list_my_profiles() as value");
    await act("anon");
    await expect(list()).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", unverified);
    await expect(list()).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", alice);
    expect(await list()).toEqual([]);
    await claim("alice");
    const [profile] = (await list())!;
    expect(profile).toEqual({ id: expect.any(String), username: "alice", published: false });
    await save(0, "Alice live", [], true);
    expect(await list()).toEqual([{ ...profile, published: true }]);
    await act("authenticated", bob);
    await claim("bob");
    expect(await list()).toEqual([{ id: expect.any(String), username: "bob", published: false }]);
    expect((await list())![0].id).not.toBe(profile.id);
  });

  it("rejects a child row with another account’s profile ID", async () => {
    await act("authenticated", alice);
    await claim("alice");
    await act("authenticated", bob);
    await claim("bob");
    await db.exec("reset role");
    await expect(db.query(`insert into snoozer.links(owner_id, profile_id, position, label, url)
      select $1, id, 1, 'Wrong owner', 'https://example.com' from snoozer.profiles where owner_id = $2`,
    [alice, bob])).rejects.toMatchObject({ code: "23503" });
  });

  it("scopes explicit draft and history reads to the profile owner", async () => {
    await act("authenticated", alice);
    await claim("alice");
    const [profile] = (await result<{ id: string }[]>("select public.list_my_profiles() as value"))!;
    await save(0, "Published Alice", [], true);
    await save(1, "Private draft", [], false);
    const selectedDraft = () => result("select public.get_draft($1) as value", [profile.id]);
    const selectedHistory = () => result("select public.list_publications($1) as value", [profile.id]);
    const selectedVersion = () => result("select public.get_publication(1,$1) as value", [profile.id]);
    expect(await selectedDraft()).toEqual(await draft());
    expect(await selectedVersion()).toMatchObject({ display_name: "Published Alice", draft_revision: 2, live: true });
    expect(await selectedHistory()).toEqual([expect.objectContaining({ revision: 1 })]);
    await act("authenticated", bob);
    expect(await selectedDraft()).toBeNull();
    expect(await selectedHistory()).toEqual([]);
    expect(await selectedVersion()).toBeNull();
    await act("anon");
    await expect(selectedDraft()).rejects.toMatchObject({ code: "42501" });
    expect(await published("alice")).toMatchObject({ display_name: "Published Alice" });
  });

  it("binds gallery stages and media folders to the selected profile", async () => {
    await act("authenticated", alice);
    await claim("gallery-id-alice");
    const { profile_id: profile } = (await result<{ profile_id: string }>("select public.get_draft() as value"))!;
    const pending = () => result("select public.pending_gallery_upload($1) as value", [profile]);
    const folders = () => result("select public.get_media_folders($1) as value", [profile]);
    const prepare = (owner: string) => result<{ id: string; scope: string }>(
      "select public.prepare_gallery_upload_for_profile($1,$2,0,'Lunar shore') as value", [profile, owner]);
    await expect(prepare(alice)).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    expect(await prepare(bob)).toBeNull();
    const stage = (await prepare(alice))!;
    await act("authenticated", bob);
    expect(await pending()).toBeNull();
    expect(await folders()).toBeNull();
    const createFolder = () => result("select public.edit_media_folders_for_profile($1,$2,0,'create',null,'Shore') as value",
      [profile, stage.scope]);
    expect(await createFolder()).toBe("changed");
    await act("authenticated", alice);
    expect(await pending()).toEqual({ id: stage.id, alt: "Lunar shore" });
    expect(await createFolder()).toBe("saved");
    expect(await folders()).toMatchObject({ revision: 1, folders: [{ name: "Shore" }] });
    await act("service_role");
    await result("select public.prepare_gallery_upload_for_profile($1,$2,0,null,$3) as value", [profile, alice, stage.id]);
    expect(await result("select public.commit_gallery_upload($1,$2,0,$3,$4,10,10) as value",
      [profile, alice, stage.id, avatar])).toBe(true);
    await act("authenticated", alice);
    expect(await pending()).toBeNull();
    expect(await folders()).toMatchObject({ items: [{ id: stage.id, in_draft: true }] });
  });

  it("binds avatar staging and deletion to the selected profile", async () => {
    await act("authenticated", alice);
    await claim("avatar-id-alice");
    const { profile_id: id } = (await result<{ profile_id: string }>("select public.get_draft() as value"))!;
    const prepare = (owner: string) => result<{ scope: string; key: string }>(
      "select public.prepare_avatar_upload($1,$2,0,true) as value", [owner, id]);
    const remove = (revision: number) => result("select public.delete_profile($1,$2,'avatar-id-alice') as value", [id, revision]);
    await expect(prepare(alice)).rejects.toMatchObject({ code: "42501" });
    await act("service_role");
    expect(await prepare(bob)).toBeNull();
    const stage = (await prepare(alice))!;
    const commit = (owner: string) => result("select public.commit_avatar_upload($1,$2,0,$3,$4) as value",
      [owner, id, stage.key, avatar]);
    expect(await commit(bob)).toBe(false);
    expect(await commit(alice)).toBe(true);

    await act("authenticated", bob);
    await expect(remove(1)).rejects.toMatchObject({ code: "40001" });
    expect(await result("select public.draft_avatar_scope($1) as value", [avatar])).toBeNull();
    await act("authenticated", alice);
    expect(await result("select public.draft_avatar_scope($1) as value", [avatar])).toBe(stage.scope);
    await expect(remove(0)).rejects.toMatchObject({ code: "40001" });
    await remove(1);
    expect(await draft()).toBeNull();
    await db.exec("reset role");
    expect(await result("select count(*)::int as value from snoozer.avatar_cleanup where scope = $1", [stage.scope])).toBe(1);
  });

  it("binds save, restore and unpublish to the explicitly selected profile", async () => {
    await act("authenticated", alice);
    await claim("alice");
    await save(0, "Live Alice", [], true);
    const { profile_id: id } = (await result<{ profile_id: string }>("select public.get_draft() as value"))!;
    const selectedSave = () => result("select public.save_profile($1,1,'New draft','Bio','lagoon',false,'[]',false,false) as value", [id]);
    const restore = () => result("select public.restore_publication($1,1,2) as value", [id]);
    const unpublish = () => result("select public.unpublish_profile($1,3) as value", [id]);

    await act("authenticated", bob);
    await claim("bob");
    await expect(selectedSave()).rejects.toMatchObject({ code: "40001" });
    await expect(restore()).rejects.toMatchObject({ code: "40001" });
    await expect(unpublish()).rejects.toMatchObject({ code: "40001" });
    await act("authenticated", alice);
    expect(await selectedSave()).toBe(2);
    await expect(selectedSave()).rejects.toMatchObject({ code: "40001" });
    await restore();
    expect(await draft()).toMatchObject({ display_name: "Live Alice", revision: 3 });
    await unpublish();
    expect(await published("alice")).toBeNull();
    expect(await draft()).toMatchObject({ revision: 4, published_revision: null });
  });

  it("keeps sibling drafts and publications separate across a plan downgrade", async () => {
    await act("authenticated", alice);
    await claim("sibling-primary");
    const { profile_id: first } = (await result<{ profile_id: string }>("select public.get_draft() as value"))!;
    const additional = (name: string) => result<string>("select public.claim_additional_profile($1) as value", [name]);
    await expect(additional("sibling-secondary")).rejects.toMatchObject({ code: "P1005" });
    const publish = (id: string, revision: number, label: string) => result(
      "select public.save_profile($1,$2,$3,'Bio','lagoon',false,$4,true,false) as value",
      [id, revision, label, JSON.stringify([{ label, url: "https://example.com" }])]);
    expect(await publish(first, 0, "First")).toBe(1);
    await db.exec("reset role");
    await db.query(`insert into snoozer.entitlement_grants(owner_id, plan, plan_version, source, source_ref, starts_at, expires_at)
      values ($1,'plus',1,'staff','sibling-allowance',now(),now()+interval '1 day')`, [alice]);
    await act("authenticated", alice);
    const second = await additional("sibling-secondary");
    expect(second).toMatch(/^[a-f0-9-]{36}$/);
    expect(await draft()).toMatchObject({ profile_id: first });
    await expect(save(1, "Legacy request", [], false)).rejects.toMatchObject({ code: "40001" });
    await additional("sibling-third");
    await expect(additional("sibling-fourth")).rejects.toMatchObject({ code: "P1005" });
    expect(await publish(second!, 0, "Second")).toBe(1);
    expect(await published("sibling-primary")).toMatchObject({ links: [{ label: "First" }] });
    expect(await published("sibling-secondary")).toMatchObject({ links: [{ label: "Second" }] });
    await db.exec("reset role");
    await db.exec("update snoozer.entitlement_grants set payment_held = true where source_ref = 'sibling-allowance'");
    await act("authenticated", alice);
    await expect(additional("sibling-fourth")).rejects.toMatchObject({ code: "P1005" });
    await expect(publish(second!, 1, "Blocked change")).rejects.toMatchObject({ code: "P1005" });
    expect(await published("sibling-secondary")).toMatchObject({ links: [{ label: "Second" }] });
    await result("select public.unpublish_profile($1,1) as value", [first]);
    expect(await publish(second!, 1, "Updated second")).toBe(2);
    expect(await published("sibling-primary")).toBeNull();
    expect(await published("sibling-secondary")).toMatchObject({ links: [{ label: "Updated second" }] });
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
      username: "alice", display_name: "Published Alice", bio: "Bio", theme: "lagoon", avatar: null, indexable: false, links, sections: [], gallery: [], seo: { title: "", description: "" },
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
    const compact = { density: "compact", corners: "square", layout: "editorial", accent: "ink", entrance: "rise" };
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
  it("validates project targets and preserves portfolio publications through draft, hiding and restore", async () => {
    await act("authenticated", alice);
    await claim("portfolio-alice");
    const id = (await draft() as { profile_id: string }).profile_id;
    const appearance = { density: "balanced", corners: "soft", layout: "portfolio" };
    const project = { kind: "project", heading: "Project", body: "Description", target: "https://example.com/work" };
    const write = (expected: number, sections: unknown, publish = true) => result(
      "select public.save_profile($1,$2,'Alice','Bio','lagoon',false,'[]',$3,false,$4,$5) as value",
      [id, expected, publish, JSON.stringify(sections), JSON.stringify(appearance)],
    );
    for (const target of [null, "", "javascript:alert(1)", "https://127.0.0.1", "https://user@example.com", "https://example.com:65536", "https://example.com:" + "9".repeat(2048)]) {
      await expect(write(0, [{ ...project, target }])).rejects.toMatchObject({ code: "22023" });
    }
    expect(await write(0, [project])).toBe(1);
    expect(await published("portfolio-alice")).toMatchObject({ appearance, sections: [project] });
    await write(1, [{ ...project, target: "https://example.com/new", hidden: true }], false);
    expect(await published("portfolio-alice")).toMatchObject({ sections: [project] });
    await act("authenticated", bob);
    await expect(write(2, [project])).rejects.toMatchObject({ code: "40001" });
    await act("authenticated", alice);
    await write(2, [{ ...project, hidden: true }]);
    expect(await published("portfolio-alice")).toMatchObject({ sections: [] });
    await db.query("select public.restore_publication($1,1,3)", [id]);
    expect(await draft()).toMatchObject({ revision: 4, appearance, sections: [project] });
    expect(await published("portfolio-alice")).toMatchObject({ sections: [] });
    await write(4, [project]);
    await act("anon");
    expect(await published("portfolio-alice")).toMatchObject({ sections: [project] });
  });

  it("gates custom metadata at publication, preserves drafts and snapshots, and closes legacy bypasses", async () => {
    await act("authenticated", alice);
    await claim("seo-alice");
    const id = (await draft() as { profile_id: string }).profile_id;
    const seo = { title: "Custom title", description: "Custom description" };
    const write = (expected: number, publish: boolean, metadata: unknown) => result(
      "select public.save_profile($1,$2,'Alice','Bio','lagoon',false,'[]',$3,false,null,null,$4) as value",
      [id, expected, publish, JSON.stringify(metadata)],
    );
    for (const invalid of [{}, { ...seo, title: "a".repeat(71) }, { ...seo, description: null }, { ...seo, image: "https://example.com" }]) {
      await expect(write(0, false, invalid)).rejects.toMatchObject({ code: "22023" });
    }
    await write(0, true, { title: "", description: "" });
    await write(1, false, seo);
    expect(await draft()).toMatchObject({ revision: 2, seo });
    expect(await published("seo-alice")).toMatchObject({ seo: { title: "", description: "" } });
    await expect(write(2, true, seo)).rejects.toMatchObject({ code: "P1006" });
    await expect(save(2, "Legacy client", [], true)).rejects.toMatchObject({ code: "P1006" });
    await act("authenticated", bob);
    await expect(write(2, true, seo)).rejects.toMatchObject({ code: "40001" });
    await db.exec("reset role");
    await db.query("insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at) values ($1,'plus',1,'staff','seo-test',now()-interval '1 minute',now()+interval '1 hour')", [alice]);
    await act("authenticated", alice);
    await write(2, true, seo);
    expect(await published("seo-alice")).toMatchObject({ seo });
    await db.exec("reset role; update snoozer.entitlement_grants set revoked_at=now() where source_ref='seo-test'");
    await act("authenticated", alice);
    expect(await published("seo-alice")).toMatchObject({ seo });
    await expect(save(3, "Legacy downgrade", [], true)).rejects.toMatchObject({ code: "P1006" });
    await db.query("select public.restore_publication($1,1,3)", [id]);
    expect(await draft()).toMatchObject({ revision: 4, seo: { title: "", description: "" } });
    expect(await published("seo-alice")).toMatchObject({ seo });
    await save(4, "Default metadata", [], true);
    expect(await published("seo-alice")).toMatchObject({ seo: { title: "", description: "" } });
    await expect(db.query("select snoozer.save_profile_content($1,5,'Bypass','Bio','lagoon',false,'[]',true,false,null,null)", [id])).rejects.toMatchObject({ code: "42501" });
    await act("anon");
    await expect(db.query("select public.save_profile($1,5,'Bypass','Bio','lagoon',false,'[]',false,false,null,null,'{}')", [id])).rejects.toMatchObject({ code: "42501" });
  });

  it("shares the profile/alias namespace and enforces ownership, quota, expiry and permanent retirement", async () => {
    await act("authenticated", alice);
    await claim("alias-alice");
    const id = (await draft() as { profile_id: string }).profile_id;
    const change = (name: string, operation = "create", profile = id) => db.query("select public.manage_profile_alias($1,$2,$3)", [profile, name, operation]);
    await expect(change("alice-alias")).rejects.toMatchObject({ code: "P1007" });
    await db.exec("reset role");
    await db.query("insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at) values ($1,'plus',1,'staff','alias-test',now()-interval '1 minute',now()+interval '1 hour')", [alice]);
    await act("authenticated", alice);
    await change("alice-alias");
    expect(await result("select public.username_available('alice-alias') as value")).toBe(false);
    expect(await result("select public.resolve_profile_alias('alice-alias') as value")).toBeNull();
    await expect(change("studio")).rejects.toMatchObject({ code: "23505" });
    await expect(change("alias-alice")).rejects.toMatchObject({ code: "23505" });
    await change("second-alias");
    await expect(change("third-alias")).rejects.toMatchObject({ code: "P1007" });
    await expect(change("bad-name", "unsupported")).rejects.toMatchObject({ code: "22023" });
    await save(0, "Alice", [], true);
    await act("anon");
    expect(await result("select public.resolve_profile_alias('alice-alias') as value")).toBe("alias-alice");
    expect(await result("select public.published_profile_exists('alice-alias') as value")).toBe(true);
    await expect(db.query("select public.list_my_aliases($1)", [id])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select * from snoozer.profile_aliases")).rejects.toMatchObject({ code: "42501" });
    await act("authenticated", bob);
    await expect(claim("alice-alias")).rejects.toMatchObject({ code: "23505" });
    await expect(change("alice-alias", "renew")).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select public.list_my_aliases($1)", [id])).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role; update snoozer.profile_aliases set expires_at=now()-interval '1 second' where name='alice-alias'");
    await act("authenticated", alice);
    expect(await result("select public.resolve_profile_alias('alice-alias') as value")).toBeNull();
    await change("alice-alias", "renew");
    expect(await result("select public.resolve_profile_alias('alice-alias') as value")).toBe("alias-alice");
    await change("alice-alias", "retire");
    await expect(change("alice-alias", "renew")).rejects.toMatchObject({ code: "P1008" });
    expect(await result("select public.resolve_profile_alias('alice-alias') as value")).toBeNull();
    expect(await result("select public.username_available('alice-alias') as value")).toBe(false);
    await db.exec("reset role; update snoozer.entitlement_grants set revoked_at=now() where source_ref='alias-test'");
    await act("anon");
    expect(await result("select public.resolve_profile_alias('second-alias') as value")).toBeNull();
    await act("authenticated", alice);
    expect(await result("select public.list_my_aliases($1) as value", [id])).toMatchObject({ limit: 0, used: 1, items: expect.arrayContaining([{ name: "second-alias", expiresAt: expect.any(String), state: "plan-limit" }]) });
    await db.query("select public.delete_profile($1,1,'alias-alice')", [id]);
    expect(await result("select public.username_available('second-alias') as value")).toBe(false);
    await db.exec("reset role");
    expect(await result("select profile_id is null and retired_at is not null as value from snoozer.profile_aliases where name='second-alias'")).toBe(true);
  });

  it("activates only the frozen scheduled version, retaining newer drafts and idempotent due processing", async () => {
    await act("authenticated", alice); await claim("scheduled-alice");
    const id = (await draft() as { profile_id: string }).profile_id;
    const schedule = (expected: number) => result("select public.schedule_publication($1,$2,now()+interval '1 day') as value", [id, expected]);
    await expect(schedule(0)).rejects.toMatchObject({ code: "P1009" });
    await db.exec("reset role");
    await db.query("insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at) values ($1,'plus',1,'staff','schedule-test',now()-interval '1 minute',now()+interval '1 hour')", [alice]);
    await act("authenticated", alice);
    await save(0, "Before schedule", [], true);
    await result("select public.save_profile($1,1,'Frozen version','Bio','lagoon',false,'[]',false,false,$2,null,$3) as value", [id, JSON.stringify([{ kind: "project", heading: "Project", body: "Frozen project", target: "https://example.com/work" }, { heading: "Private", body: "Do not expose", hidden: true }]), JSON.stringify({ title: "Frozen SEO", description: "Scheduled description" })]);
    for (const time of ["now()", "now()+interval '366 days'", "null"]) await expect(db.query(`select public.schedule_publication($1,2,${time})`, [id])).rejects.toMatchObject({ code: "22023" });
    expect(await schedule(2)).toBe(3);
    expect(await published("scheduled-alice")).toMatchObject({ display_name: "Before schedule" });
    expect(await result("select public.get_my_publication_schedule($1)->'schedule' as value", [id])).toMatchObject({ revision: 3, state: "pending" });
    expect(await result("select public.get_publication(3,$1) as value", [id])).toMatchObject({ activated: false, scheduled_for: expect.any(String), seo: { title: "Frozen SEO" } });
    await save(3, "Newer draft", [], false);
    expect(await result("select public.run_my_publication_schedule($1) as value", [id])).toBe("not_due");
    await act("authenticated", bob);
    await expect(db.query("select public.run_my_publication_schedule($1)", [id])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select public.cancel_publication_schedule($1)", [id])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select public.get_my_publication_schedule($1)", [id])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select public.run_due_publications(10)")).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role; update snoozer.publication_schedules set run_at=now()-interval '1 second'");
    await act("service_role");
    expect(await result("select public.run_due_publications(10) as value")).toBe(1);
    expect(await result("select public.run_due_publications(10) as value")).toBe(0);
    await act("authenticated", alice);
    expect(await draft()).toMatchObject({ revision: 4, display_name: "Newer draft", published_revision: 3 });
    expect(await published("scheduled-alice")).toMatchObject({ display_name: "Frozen version", seo: { title: "Frozen SEO" }, sections: [{ kind: "project", target: "https://example.com/work" }] });
    expect(await result("select public.get_my_publication_schedule($1)->'schedule' as value", [id])).toMatchObject({ state: "published", reason: null });
    expect(await result("select public.get_publication(3,$1) as value", [id])).toMatchObject({ activated: true, scheduled_for: null });
    await expect(save(3, "Stale draft", [], true)).rejects.toMatchObject({ code: "40001" });
  });

  it("cancels scheduled publication on explicit offline actions and blocks expired entitlements", async () => {
    await act("authenticated", alice); await claim("schedule-cancel");
    const id = (await draft() as { profile_id: string }).profile_id;
    await db.exec("reset role");
    await db.query("insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at) values ($1,'plus',1,'staff','schedule-cancel',now()-interval '1 minute',now()+interval '1 hour')", [alice]);
    await act("authenticated", alice);
    const schedule = (expected: number) => result("select public.schedule_publication($1,$2,now()+interval '1 day') as value", [id, expected]);
    await schedule(0);
    expect(await published("schedule-cancel")).toBeNull();
    await db.query("select public.cancel_publication_schedule($1)", [id]);
    expect(await result("select public.get_my_publication_schedule($1)->'schedule' as value", [id])).toMatchObject({ state: "cancelled", reason: "manual" });
    await schedule(1);
    await db.query("select public.unpublish_profile($1,2)", [id]);
    expect(await result("select public.get_my_publication_schedule($1)->'schedule' as value", [id])).toMatchObject({ state: "cancelled", reason: "superseded" });
    await schedule(3);
    await db.exec("reset role; update snoozer.entitlement_grants set revoked_at=now() where source_ref='schedule-cancel'; update snoozer.publication_schedules set run_at=now()-interval '1 second'");
    await act("service_role");
    await expect(db.query("select public.run_due_publications(0)")).rejects.toMatchObject({ code: "22023" });
    expect(await result("select public.run_due_publications(1) as value")).toBe(1);
    await act("authenticated", alice);
    expect(await result("select public.get_my_publication_schedule($1)->'schedule' as value", [id])).toMatchObject({ state: "blocked", reason: "plan_changed" });
    expect(await published("schedule-cancel")).toBeNull();
    await expect(db.query("select * from snoozer.publication_schedules")).rejects.toMatchObject({ code: "42501" });
  });

  it("protects a live snapshot while repeatedly replacing a pending scheduled version", async () => {
    await act("authenticated", alice); await claim("schedule-retention");
    const id = (await draft() as { profile_id: string }).profile_id;
    await db.exec("reset role");
    await db.query("insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at) values ($1,'plus',1,'staff','schedule-retention',now()-interval '1 minute',now()+interval '1 hour')", [alice]);
    await act("authenticated", alice);
    await save(0, "Original live version", [], true);
    await save(1, "Prepared future version", [], false);
    for (let expected = 2; expected < 27; expected++) {
      expect(await result("select public.schedule_publication($1,$2,now()+interval '1 day') as value", [id, expected])).toBe(expected + 1);
    }
    expect(await published("schedule-retention")).toMatchObject({ display_name: "Original live version" });
    expect((await result<unknown[]>("select public.list_publications($1) as value", [id]))!.length).toBeLessThanOrEqual(22);
    expect(await result("select public.get_publication(1,$1) as value", [id])).toMatchObject({ live: true });
    expect(await result("select public.get_publication(27,$1) as value", [id])).toMatchObject({ activated: false, scheduled_for: expect.any(String) });
  });

  it("bounds due batches and respects shared publication quota after a downgrade", async () => {
    await db.exec("reset role");
    await db.query("insert into snoozer.entitlement_grants(owner_id,plan,plan_version,source,source_ref,starts_at,expires_at) values ($1,'pro',1,'staff','schedule-quota',now()-interval '1 minute',now()+interval '1 hour')", [alice]);
    await act("authenticated", alice); await claim("schedule-quota-a");
    const ids = [(await draft() as { profile_id: string }).profile_id];
    for (const name of ["schedule-quota-b", "schedule-quota-c", "schedule-quota-d"]) ids.push((await result<string>("select public.claim_additional_profile($1) as value", [name]))!);
    for (const id of ids) await db.query("select public.schedule_publication($1,0,now()+interval '1 day')", [id]);
    await db.exec("reset role; update snoozer.entitlement_grants set plan='plus' where source_ref='schedule-quota'; update snoozer.publication_schedules set run_at=now()-interval '1 second'");
    await act("service_role");
    expect(await result("select public.run_due_publications(2) as value")).toBe(2);
    expect(await result("select public.run_due_publications(2) as value")).toBe(2);
    expect(await result("select public.run_due_publications(2) as value")).toBe(0);
    await db.exec("reset role");
    expect(await result("select count(*)::integer as value from snoozer.profiles where published_revision is not null")).toBe(3);
    expect(await result("select count(*)::integer as value from snoozer.publication_schedules where state='blocked' and reason='quota'")).toBe(1);
  });

});
