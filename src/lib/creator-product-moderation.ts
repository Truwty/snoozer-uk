import {z} from "zod";
export const productReportReason=z.enum(["malware","copyright","impersonation","other"]);
export const productReportDetail=z.string().trim().min(25).max(1200);
export const createProductReport=z.object({versionId:z.uuid(),reason:productReportReason,detail:productReportDetail});
export const moderationDecision=z.enum(["dismiss","quarantine"]);
export const reasonLabels:Record<z.infer<typeof productReportReason>,string>={
 malware:"Suspected malicious or unsafe file",
 copyright:"Copyright or rights concern",
 impersonation:"Impersonation or misrepresentation",
 other:"Another serious concern",
};
const dt=z.iso.datetime({offset:true});
const base=z.object({id:z.uuid(),versionId:z.uuid(),reason:productReportReason,
 detail:productReportDetail,createdAt:dt});
export const ownProductReports=z.array(base.extend({state:z.enum(["open","dismissed","quarantined"]),
 reviewedAt:dt.nullable()})).max(20);
export const staffProductReports=z.array(base.extend({reporterId:z.uuid(),ownerId:z.uuid(),
 productTitle:z.string().min(1).max(100)})).max(50);
