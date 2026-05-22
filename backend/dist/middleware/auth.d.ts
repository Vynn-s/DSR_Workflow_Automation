import type { NextFunction, Request, Response } from "express";
import { UserRole, type AuthUser } from "../types";
export declare const Role: typeof UserRole;
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
export declare function authenticate(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function requireRole(allowedRoles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=auth.d.ts.map