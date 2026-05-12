import type { NextFunction, Request, Response } from "express";
export declare function evaluateRequest(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function checkConflicts(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
declare const _default: {
    evaluateRequest: typeof evaluateRequest;
    checkConflicts: typeof checkConflicts;
};
export default _default;
//# sourceMappingURL=dss.controller.d.ts.map