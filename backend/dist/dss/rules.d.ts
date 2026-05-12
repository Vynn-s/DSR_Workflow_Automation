export interface RuleResult {
    ruleName: string;
    passed: boolean;
    message: string;
}
export declare function checkAdvanceNotice(requestDate: Date, minimumDays: number): RuleResult;
export declare function checkCapacity(attendees: number, venueCapacity: number): RuleResult;
export declare function checkMinistryAuthorization(ministryId: string, authorizedMinistryIds: string[]): RuleResult;
export declare function checkNoConflict(hasConflict: boolean): RuleResult;
export declare function checkBusinessHours(startTime: string, endTime: string): RuleResult;
//# sourceMappingURL=rules.d.ts.map