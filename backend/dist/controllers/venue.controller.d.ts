import type { NextFunction, Request, Response } from "express";
export declare function getVenues(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getVenueById(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
declare const _default: {
    getVenues: typeof getVenues;
    getVenueById: typeof getVenueById;
};
export default _default;
//# sourceMappingURL=venue.controller.d.ts.map