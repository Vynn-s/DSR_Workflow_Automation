import type { NextFunction, Request, Response } from "express";
export declare function createRequest(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getRequests(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getRequestById(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function cancelRequest(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getAvailability(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
declare const _default: {
    createRequest: typeof createRequest;
    getRequests: typeof getRequests;
    getRequestById: typeof getRequestById;
    cancelRequest: typeof cancelRequest;
    getAvailability: typeof getAvailability;
};
export default _default;
//# sourceMappingURL=request.controller.d.ts.map