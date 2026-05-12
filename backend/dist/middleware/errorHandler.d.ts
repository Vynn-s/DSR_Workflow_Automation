import type { NextFunction, Request, Response } from "express";
export declare class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, statusCode: number);
}
export declare function errorHandler(err: Partial<Error> & {
    statusCode?: number;
}, _req: Request, res: Response, _next: NextFunction): void;
export default errorHandler;
//# sourceMappingURL=errorHandler.d.ts.map