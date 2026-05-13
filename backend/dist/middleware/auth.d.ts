import type { NextFunction, Request, Response } from "express";
export declare enum Role {
    REQUESTER = "REQUESTER",
    PARISH_SECRETARY = "PARISH_SECRETARY",
    PARISH_PRIEST = "PARISH_PRIEST",
    ADMIN = "ADMIN"
}
export interface AuthUser {
    id: string;
    email: string;
    role: Role;
}
declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
export declare function authenticate(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function requireRole(allowedRoles: Role[]): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=auth.d.ts.map