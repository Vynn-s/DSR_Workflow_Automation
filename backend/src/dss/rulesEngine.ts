import type { RuleResult } from "./rules";
import {
	checkAdvanceNotice,
	checkBusinessHours,
	checkCapacity,
	checkMinistryAuthorization,
	checkNoConflict,
} from "./rules";

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

export function evaluateRequest(
	input: RequestInput,
	venueCapacity: number,
	authorizedMinistryIds: string[],
	hasConflict: boolean,
): DSSDecision {
	const results: RuleResult[] = [
		checkAdvanceNotice(input.requestDate, 7),
		checkCapacity(input.attendees, venueCapacity),
		checkMinistryAuthorization(input.ministryId, authorizedMinistryIds),
		checkNoConflict(hasConflict),
		checkBusinessHours(input.startTime, input.endTime),
	];

	const allPassed = results.every((result) => result.passed);
	const failedRules = results.filter((result) => !result.passed).map((result) => result.ruleName);

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

export default evaluateRequest;
