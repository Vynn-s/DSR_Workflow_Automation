import type { NextFunction, Request, Response } from "express";
export declare function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getAuditStats(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
declare const _default: {
    getAuditLogs: typeof getAuditLogs;
    getAuditStats: typeof getAuditStats;
};
export default _default;
//# sourceMappingURL=audit.controller.d.ts.map