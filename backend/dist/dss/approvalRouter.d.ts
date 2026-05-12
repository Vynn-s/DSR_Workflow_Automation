export interface ApprovalRoute {
    role: string;
    order: number;
    description: string;
}
export interface ApprovalRoutingResult {
    routes: ApprovalRoute[];
    totalStages: number;
    description: string;
}
export declare function determineApprovalRoute(ministry: string, venue: string): ApprovalRoutingResult;
export declare function getNextApprover(currentRole: string): string | null;
export declare function isApprovalComplete(currentStatus: string): boolean;
declare const _default: {
    determineApprovalRoute: typeof determineApprovalRoute;
    getNextApprover: typeof getNextApprover;
    isApprovalComplete: typeof isApprovalComplete;
};
export default _default;
//# sourceMappingURL=approvalRouter.d.ts.map