"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.determineApprovalRoute = determineApprovalRoute;
exports.getNextApprover = getNextApprover;
exports.isApprovalComplete = isApprovalComplete;
function determineApprovalRoute(ministry, venue) {
    return {
        routes: [
            {
                role: "PARISH_SECRETARY",
                order: 1,
                description: "First level review and verification",
            },
            {
                role: "PARISH_PRIEST",
                order: 2,
                description: "Final approval and authorization",
            },
        ],
        totalStages: 2,
        description: `Two-stage approval route for ${ministry} requests at ${venue}.`,
    };
}
function getNextApprover(currentRole) {
    if (currentRole === "REQUESTER") {
        return "PARISH_SECRETARY";
    }
    if (currentRole === "PARISH_SECRETARY") {
        return "PARISH_PRIEST";
    }
    if (currentRole === "PARISH_PRIEST") {
        return null;
    }
    return null;
}
function isApprovalComplete(currentStatus) {
    return currentStatus === "APPROVED" || currentStatus === "REJECTED";
}
exports.default = {
    determineApprovalRoute,
    getNextApprover,
    isApprovalComplete,
};
//# sourceMappingURL=approvalRouter.js.map