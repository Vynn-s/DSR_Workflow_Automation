export interface RuleResult {
    ruleName: string;
    passed: boolean;
    message: string;
    required?: boolean;
}
export declare function checkAdvanceNotice(requestDate: Date, minimumDays: number): RuleResult;
export declare function checkCapacity(attendees: number, venueCapacity: number): RuleResult;
export declare function checkMinistryAuthorization(ministryId: string, authorizedMinistryIds: string[]): RuleResult;
export declare function checkNoConflict(hasConflict: boolean): RuleResult;
export declare function checkBusinessHours(startTime: string, endTime: string): RuleResult;
export interface SignatureState {
    required?: boolean;
    status: "pending" | "signed";
}
export declare function checkRequiredSignatures(signatures: SignatureState[]): RuleResult;
export declare function checkAttachmentSupport(attachmentCount: number): RuleResult;
//# sourceMappingURL=rules.d.ts.map