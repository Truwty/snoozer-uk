import {describe,it,expect} from "vitest";
import {parseProviderStatus} from "./provider-status";
describe("public status page validation",()=>{
 it("accepts known indicators",()=>{
  for(const indicator of ["none","minor","major","critical","maintenance"])
   expect(parseProviderStatus({status:{indicator,description:"All systems operational"}})).toEqual({indicator,description:"All systems operational"});
 });
 it("rejects unexpected or malformed provider JSON",()=>{
  for(const payload of [null,{},[],{status:{indicator:"green",description:"okay"}},{status:{indicator:"none"}},{status:{indicator:"none",description:"x".repeat(1000)}}])
   expect(parseProviderStatus(payload)).toBeNull();
 });
});
