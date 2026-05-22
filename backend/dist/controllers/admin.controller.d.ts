import type { NextFunction, Request, Response } from "express";
export declare function listAdminUsers(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function createAdminUser(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function updateAdminUserRole(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
declare const _default: {
    listAdminUsers: typeof listAdminUsers;
    createAdminUser: typeof createAdminUser;
    updateAdminUserRole: typeof updateAdminUserRole;
};
export default _default;
//# sourceMappingURL=admin.controller.d.ts.map