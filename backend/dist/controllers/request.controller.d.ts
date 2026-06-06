import type { NextFunction, Request, Response } from "express";
export declare function createRequest(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function createDraftRequest(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function updateDraftRequest(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function submitDraftRequest(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getRequests(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getRequestById(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function cancelRequest(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getAvailability(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
declare const _default: {
    createRequest: typeof createRequest;
    createDraftRequest: typeof createDraftRequest;
    updateDraftRequest: typeof updateDraftRequest;
    submitDraftRequest: typeof submitDraftRequest;
    getRequests: typeof getRequests;
    getRequestById: typeof getRequestById;
    cancelRequest: typeof cancelRequest;
    getAvailability: typeof getAvailability;
};
export default _default;
//# sourceMappingURL=request.controller.d.ts.map