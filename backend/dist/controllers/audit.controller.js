"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogs = getAuditLogs;
exports.getAuditStats = getAuditStats;
const { z } = require("zod");
const prisma = require("../config/database").default;
const { AppError } = require("../middleware/errorHandler");
const auditQuerySchema = z.object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    action: z.string().min(1).optional(),
    role: z.enum(["REQUESTER", "PARISH_SECRETARY", "PARISH_PRIEST", "ADMIN"]).optional(),
    venueId: z.string().min(1).optional(),
    requestId: z.string().min(1).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
});
function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}
function startOfWeek(date) {
    const copy = new Date(date);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
}
async function getAuditLogs(req, res, next) {
    try {
        const parsed = auditQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            throw new AppError("Invalid audit query parameters", 400);
        }
        const { dateFrom, dateTo, action, role, venueId, requestId, page = 1, limit = 20, } = parsed.data;
        let venueScopedRequestIds;
        if (venueId) {
            const venueRequests = await prisma.venueRequest.findMany({
                where: {
                    venueId,
                },
                select: {
                    id: true,
                },
            });
            venueScopedRequestIds = venueRequests.map((entry) => entry.id);
        }
        const where = {};
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) {
                where.createdAt.gte = dateFrom;
            }
            if (dateTo) {
                where.createdAt.lte = dateTo;
            }
        }
        if (action) {
            where.action = { contains: action };
        }
        if (role) {
            where.performedBy = { role };
        }
        if (requestId) {
            where.requestId = requestId;
        }
        else if (venueScopedRequestIds) {
            where.requestId = {
                in: venueScopedRequestIds.length > 0 ? venueScopedRequestIds : ["__NONE__"],
            };
        }
        const skip = (page - 1) * limit;
        const [total, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                include: {
                    performedBy: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
                skip,
                take: limit,
            }),
        ]);
        const requestIds = Array.from(new Set(logs.map((log) => log.requestId).filter((value) => Boolean(value))));
        const relatedRequests = requestIds.length
            ? await prisma.venueRequest.findMany({
                where: {
                    id: {
                        in: requestIds,
                    },
                },
                include: {
                    venue: true,
                    ministry: true,
                    requester: true,
                },
            })
            : [];
        const relatedRequestMap = new Map(relatedRequests.map((requestRecord) => [requestRecord.id, requestRecord]));
        const items = logs.map((log) => ({
            ...log,
            venueRequest: log.requestId ? relatedRequestMap.get(log.requestId) ?? null : null,
        }));
        return res.json({
            success: true,
            data: {
                items,
                total,
                page,
                limit,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
        });
    }
    catch (error) {
        return next(error);
    }
}
async function getAuditStats(_req, res, next) {
    try {
        const now = new Date();
        const monthStart = startOfMonth(now);
        const [totalRequestsThisMonth, approvedRequests, totalConflictsDetected, totalRequests, rejectedRequests, groupedByMinistry,] = await Promise.all([
            prisma.venueRequest.count({
                where: {
                    createdAt: {
                        gte: monthStart,
                    },
                },
            }),
            prisma.venueRequest.findMany({
                where: {
                    status: "APPROVED",
                },
                select: {
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            prisma.schedulingConflict.count(),
            prisma.venueRequest.count(),
            prisma.venueRequest.count({
                where: {
                    status: "REJECTED",
                },
            }),
            prisma.venueRequest.groupBy({
                by: ["ministryId"],
                _count: {
                    _all: true,
                },
            }),
        ]);
        const averageApprovalTimeHours = approvedRequests.length
            ? approvedRequests.reduce((sum, requestRecord) => {
                const durationMs = requestRecord.updatedAt.getTime() - requestRecord.createdAt.getTime();
                return sum + durationMs / (1000 * 60 * 60);
            }, 0) / approvedRequests.length
            : 0;
        const rejectionRate = totalRequests > 0 ? (rejectedRequests / totalRequests) * 100 : 0;
        const ministryIds = groupedByMinistry.map((entry) => entry.ministryId);
        const ministries = ministryIds.length
            ? await prisma.ministry.findMany({
                where: {
                    id: {
                        in: ministryIds,
                    },
                },
                select: {
                    id: true,
                    name: true,
                },
            })
            : [];
        const ministryNameMap = new Map(ministries.map((ministry) => [ministry.id, ministry.name]));
        const requestsByMinistry = groupedByMinistry.map((entry) => ({
            ministryId: entry.ministryId,
            ministryName: ministryNameMap.get(entry.ministryId) ?? "Unknown",
            total: entry._count._all,
        }));
        const weekStarts = [];
        const currentWeekStart = startOfWeek(now);
        for (let i = 7; i >= 0; i -= 1) {
            const weekStart = new Date(currentWeekStart);
            weekStart.setDate(currentWeekStart.getDate() - i * 7);
            weekStarts.push(weekStart);
        }
        const rangeStart = weekStarts[0];
        const requestsInRange = await prisma.venueRequest.findMany({
            where: {
                createdAt: {
                    gte: rangeStart,
                },
            },
            select: {
                createdAt: true,
            },
        });
        const weeklyRequestVolume = weekStarts.map((weekStart) => {
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);
            const count = requestsInRange.filter((requestRecord) => requestRecord.createdAt >= weekStart && requestRecord.createdAt < weekEnd).length;
            return {
                weekStart,
                weekEnd,
                total: count,
            };
        });
        return res.json({
            totalRequestsThisMonth,
            averageApprovalTimeHours,
            totalConflictsDetected,
            rejectionRate,
            requestsByMinistry,
            weeklyRequestVolume,
        });
    }
    catch (error) {
        return next(error);
    }
}
exports.default = {
    getAuditLogs,
    getAuditStats,
};
//# sourceMappingURL=audit.controller.js.map