import type { NextFunction, Request, Response } from "express";
export declare function getApprovalQueue(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function approveRequest(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function rejectRequest(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function requestRevision(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getArchive(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
declare const _default: {
    getApprovalQueue: typeof getApprovalQueue;
    approveRequest: typeof approveRequest;
    rejectRequest: typeof rejectRequest;
    requestRevision: typeof requestRevision;
    getArchive: typeof getArchive;
};
export default _default;
//# sourceMappingURL=approval.controller.d.ts.map