import type { NextFunction, Request, Response } from "express";
export declare function getMinistries(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function listAdminUsers(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function createAdminUser(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function updateAdminUserRole(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function updateAdminUserMinistry(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function deleteAdminUser(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
declare const _default: {
    listAdminUsers: typeof listAdminUsers;
    createAdminUser: typeof createAdminUser;
    updateAdminUserRole: typeof updateAdminUserRole;
    updateAdminUserMinistry: typeof updateAdminUserMinistry;
    deleteAdminUser: typeof deleteAdminUser;
};
export default _default;
//# sourceMappingURL=admin.controller.d.ts.map