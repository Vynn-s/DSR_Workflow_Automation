import type { RuleResult } from "./rules";
export interface RequestInput {
    venueId: string;
    ministryId: string;
    requestDate: Date;
    startTime: string;
    endTime: string;
    attendees: number;
}
export interface DSSDecision {
    allPassed: boolean;
    results: RuleResult[];
    recommendation: string;
    canProceed: boolean;
}
export declare function evaluateRequest(input: RequestInput, venueCapacity: number, authorizedMinistryIds: string[], hasConflict: boolean): DSSDecision;
export default evaluateRequest;
//# sourceMappingURL=rulesEngine.d.ts.map