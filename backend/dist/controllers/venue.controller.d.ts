import type { NextFunction, Request, Response } from "express";
export declare function getVenues(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function getVenueById(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function updateVenue(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function createVenue(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function deleteVenue(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
declare const _default: {
    getVenues: typeof getVenues;
    getVenueById: typeof getVenueById;
    updateVenue: typeof updateVenue;
    createVenue: typeof createVenue;
    deleteVenue: typeof deleteVenue;
};
export default _default;
//# sourceMappingURL=venue.controller.d.ts.map