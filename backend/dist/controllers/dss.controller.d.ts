import type { NextFunction, Request, Response } from "express";
export declare function evaluateRequest(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function checkConflicts(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getBookingRecommendations(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getPriests(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
declare const _default: {
    evaluateRequest: typeof evaluateRequest;
    checkConflicts: typeof checkConflicts;
    getBookingRecommendations: typeof getBookingRecommendations;
    getPriests: typeof getPriests;
};
export default _default;
//# sourceMappingURL=dss.controller.d.ts.map