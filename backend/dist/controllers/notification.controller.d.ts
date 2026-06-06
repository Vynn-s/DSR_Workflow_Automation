import type { NextFunction, Request, Response } from "express";
export declare function getNotifications(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function markNotificationRead(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function markAllNotificationsRead(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
export declare function deleteNotification(req: Request, res: Response, next: NextFunction): Promise<void | Response<any, Record<string, any>>>;
declare const _default: {
    getNotifications: typeof getNotifications;
    markNotificationRead: typeof markNotificationRead;
    markAllNotificationsRead: typeof markAllNotificationsRead;
    deleteNotification: typeof deleteNotification;
};
export default _default;
//# sourceMappingURL=notification.controller.d.ts.map