"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRequest = evaluateRequest;
const rules_1 = require("./rules");
function evaluateRequest(input, venueCapacity, authorizedMinistryIds, hasConflict) {
    const results = [
        (0, rules_1.checkAdvanceNotice)(input.requestDate, 3),
        (0, rules_1.checkCapacity)(input.attendees, venueCapacity),
        (0, rules_1.checkMinistryAuthorization)(input.ministryId, authorizedMinistryIds),
        (0, rules_1.checkNoConflict)(hasConflict),
        (0, rules_1.checkBusinessHours)(input.startTime, input.endTime),
        (0, rules_1.checkRequiredSignatures)(input.signatures ?? []),
        (0, rules_1.checkAttachmentSupport)(input.attachmentCount ?? 0),
    ];
    const blockingResults = results.filter((result) => result.required !== false);
    const allPassed = blockingResults.every((result) => result.passed);
    const failedRules = blockingResults.filter((result) => !result.passed).map((result) => result.ruleName);
    const recommendation = allPassed
        ? "All DSS checks passed. Request can proceed."
        : `Request requires review. Failed checks: ${failedRules.join(", ")}.`;
    return {
        allPassed,
        results,
        recommendation,
        canProceed: allPassed,
    };
}
exports.default = evaluateRequest;
//# sourceMappingURL=rulesEngine.js.map