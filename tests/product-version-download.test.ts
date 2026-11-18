import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "../src/app/studio/products/version/[id]/route";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), download: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ sessionClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }),
  storageAdmin: () => ({ storage: { from: mocks.from } }) }));
const versionId="b9453f47-7516-4da5-b538-a4d703a35557";
const bytes=Buffer.from("%PDF-1.7\nprivate retained version\n%%EOF\n");
const file={versionId, id:"101ec49d-81c9-44bb-bbba-799b0e656b7b", productId:"eecaf0ac-5075-4893-a961-4884b576e448",
  scope:"74727fb3-eef5-4388-a174-aaf8391395ba", state:"ready", bytes:bytes.length, sha256:createHash("sha256").update(bytes).digest("hex")};
const download = (id=versionId) => GET(new Request("https://example.com/studio/products/version/"+id), {params:Promise.resolve({id})});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({data:{user:{email_confirmed_at:"2026-11-18T00:00:00Z"}},error:null});
  mocks.rpc.mockResolvedValue({data:file,error:null});
  mocks.from.mockReturnValue({download:mocks.download});
  mocks.download.mockResolvedValue({data:new Blob([bytes]),error:null});
});
it("serves only the owner-scoped immutable bytes with private attachment headers", async () => {
  const response=await download();
  expect(response.status).toBe(200);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  expect(mocks.rpc).toHaveBeenCalledWith("get_my_product_version_file",{p_version:versionId});
  expect(mocks.from).toHaveBeenCalledWith("product-files");
  expect(mocks.download).toHaveBeenCalledWith(`${file.scope}/${file.id}.pdf`);
  expect(response.headers.get("content-disposition")).toContain('attachment; filename="product-version.pdf"');
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("content-security-policy")).toContain("sandbox");
});
it("rejects same-size replacements instead of serving changed retained bytes", async () => {
  const changed=Buffer.from(bytes); changed[15]^=1;
  mocks.download.mockResolvedValue({data:new Blob([changed]),error:null});
  const response=await download();
  expect(response.status).toBe(503); expect(await response.text()).toBe("");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("denies anonymous, unverified, foreign and discarded versions before Storage access", async () => {
  for(const user of [null,{}]) {
    mocks.getUser.mockResolvedValue({data:{user},error:null});
    expect((await download()).status).toBe(404);
  }
  mocks.getUser.mockResolvedValue({data:{user:{email_confirmed_at:"2026-11-18T00:00:00Z"}},error:null});
  mocks.rpc.mockResolvedValue({data:null,error:null});
  expect((await download()).status).toBe(404);
  expect(mocks.download).not.toHaveBeenCalled();
});
it("rejects malformed IDs, projections and non-ready versions", async () => {
  expect((await download("invalid")).status).toBe(404);
  expect(mocks.getUser).not.toHaveBeenCalled();
  for(const data of [{...file,versionId:file.id},{...file,state:"removing"},{...file,sha256:"invalid"},{...file,bytes:4194305}]) {
    mocks.rpc.mockResolvedValue({data,error:null});
    expect((await download()).status).toBe(503);
  }
  expect(mocks.download).not.toHaveBeenCalled();
});
it("fails closed on identity, database, size and Storage failures", async () => {
  mocks.getUser.mockResolvedValueOnce({data:{user:null},error:{status:500}});
  expect((await download()).status).toBe(503);
  mocks.rpc.mockResolvedValueOnce({data:null,error:{message:"unavailable"}});
  expect((await download()).status).toBe(503);
  for(const data of [null,new Blob(["short"])]) {
    mocks.download.mockResolvedValue({data,error:null});
    expect((await download()).status).toBe(503);
  }
  mocks.download.mockRejectedValueOnce(new Error("network unavailable"));
  expect((await download()).status).toBe(503);
});
