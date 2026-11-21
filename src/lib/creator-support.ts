import { z } from "zod";

export const supportReferenceKind=z.enum(["purchase","membership"]);
export const supportIssue=z.enum(["payment","delivery","refund","dispute","other"]);
export const supportMessage=z.string().trim().min(20).max(1500);
export const supportReply=supportMessage;
export const supportInput=z.object({
 kind:supportReferenceKind,reference:z.uuid(),issue:supportIssue,message:supportMessage,
});
const datetime=z.iso.datetime({offset:true});
const caseBase=z.object({
 id:z.uuid(),referenceKind:supportReferenceKind,referenceId:z.uuid(),issue:supportIssue,
 message:supportMessage,state:z.enum(["open","answered","closed"]),response:supportReply.nullable(),
 createdAt:datetime,answeredAt:datetime.nullable(),
});
export const buyerSupportCases=z.array(caseBase.extend({
 updatedAt:datetime,closedAt:datetime.nullable(),
}).refine(value=>value.state!=="answered"||value.response!==null)).max(40);
export const staffSupportCases=z.array(caseBase.extend({buyerId:z.uuid()})).max(50);
export const supportIssueLabels:Record<z.infer<typeof supportIssue>,string>={
 payment:"Payment not verified",delivery:"Download or access problem",refund:"Refund query",
 dispute:"Dispute or payment risk hold",other:"Other purchase issue",
};
export const supportStateLabels={open:"Awaiting a staff response",answered:"Staff replied",closed:"Closed"} as const;
