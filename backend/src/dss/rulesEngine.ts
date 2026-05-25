import type { RuleResult } from "./rules";
import {
	checkAttachmentSupport,
	checkAdvanceNotice,
	checkBusinessHours,
	checkCapacity,
	checkMinistryAuthorization,
	checkNoConflict,
	checkRequiredSignatures,
	SignatureState,
} from "./rules";

export interface RequestInput {
	venueId: string;
	ministryId: string;
	requestId?: string;
	requestDate: Date;
	startTime: string;
	endTime: string;
	attendees: number;
	signatures?: SignatureState[];
	attachmentCount?: number;
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
		checkAdvanceNotice(input.requestDate, 3),
		checkCapacity(input.attendees, venueCapacity),
		checkMinistryAuthorization(input.ministryId, authorizedMinistryIds),
		checkNoConflict(hasConflict),
		checkBusinessHours(input.startTime, input.endTime),
		checkRequiredSignatures(input.signatures ?? []),
		checkAttachmentSupport(input.attachmentCount ?? 0),
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

export default evaluateRequest;
