"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalAction = exports.RequestStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["REQUESTER"] = "REQUESTER";
    UserRole["PARISH_SECRETARY"] = "PARISH_SECRETARY";
    UserRole["PARISH_PRIEST"] = "PARISH_PRIEST";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
var RequestStatus;
(function (RequestStatus) {
    RequestStatus["PENDING"] = "PENDING";
    RequestStatus["SECRETARY_REVIEW"] = "SECRETARY_REVIEW";
    RequestStatus["PRIEST_REVIEW"] = "PRIEST_REVIEW";
    RequestStatus["APPROVED"] = "APPROVED";
    RequestStatus["REJECTED"] = "REJECTED";
    RequestStatus["REVISION_REQUESTED"] = "REVISION_REQUESTED";
})(RequestStatus || (exports.RequestStatus = RequestStatus = {}));
var ApprovalAction;
(function (ApprovalAction) {
    ApprovalAction["APPROVED"] = "APPROVED";
    ApprovalAction["REJECTED"] = "REJECTED";
    ApprovalAction["REVISION_REQUESTED"] = "REVISION_REQUESTED";
    ApprovalAction["FORWARDED"] = "FORWARDED";
})(ApprovalAction || (exports.ApprovalAction = ApprovalAction = {}));
//# sourceMappingURL=index.js.map