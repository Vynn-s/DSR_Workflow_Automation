export interface RuleResult {
	ruleName: string;
	passed: boolean;
	message: string;
	required?: boolean;
}

function buildResult(ruleName: string, passed: boolean, message: string, required = true): RuleResult {
	return {
		ruleName,
		passed,
		message,
		required,
	};
}

function getDayDifference(fromDate: Date, toDate: Date): number {
	const millisecondsPerDay = 24 * 60 * 60 * 1000;
	const from = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
	const to = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
	return Math.floor((to - from) / millisecondsPerDay);
}

function parseTimeToMinutes(time: string): number | null {
	const match = /^(\d{2}):(\d{2})$/.exec(time);

	if (!match) {
		return null;
	}

	const hours = Number(match[1]);
	const minutes = Number(match[2]);

	if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
		return null;
	}

	return hours * 60 + minutes;
}

export function checkAdvanceNotice(requestDate: Date, minimumDays: number): RuleResult {
	const today = new Date();
	const daysUntilEvent = getDayDifference(today, requestDate);
	const passed = daysUntilEvent >= minimumDays;

	return buildResult(
		"checkAdvanceNotice",
		passed,
		passed
			? `Advance notice requirement met: ${daysUntilEvent} day(s) until event.`
			: `Advance notice requirement not met: only ${daysUntilEvent} day(s) until event, minimum is ${minimumDays}.`,
	);
}

export function checkCapacity(attendees: number, venueCapacity: number): RuleResult {
	const passed = attendees <= venueCapacity;

	return buildResult(
		"checkCapacity",
		passed,
		passed
			? `Capacity check passed: ${attendees} attendee(s) for venue capacity ${venueCapacity}.`
			: `Capacity check failed: ${attendees} attendee(s) exceeds venue capacity ${venueCapacity}.`,
	);
}

export function checkMinistryAuthorization(
	ministryId: string,
	authorizedMinistryIds: string[],
): RuleResult {
	const passed = authorizedMinistryIds.includes(ministryId);

	return buildResult(
		"checkMinistryAuthorization",
		passed,
		passed
			? `Ministry ${ministryId} is authorized for this venue.`
			: `Ministry ${ministryId} is not authorized for this venue.`,
	);
}

export function checkNoConflict(hasConflict: boolean): RuleResult {
	const passed = !hasConflict;

	return buildResult(
		"checkNoConflict",
		passed,
		passed ? "No scheduling conflict detected." : "Scheduling conflict detected for this venue and time.",
	);
}

export function checkBusinessHours(startTime: string, endTime: string): RuleResult {
	const startMinutes = parseTimeToMinutes(startTime);
	const endMinutes = parseTimeToMinutes(endTime);
	const openingMinutes = 6 * 60;
	const closingMinutes = 22 * 60;

	const passed =
		startMinutes !== null &&
		endMinutes !== null &&
		startMinutes >= openingMinutes &&
		endMinutes <= closingMinutes &&
		endMinutes > startMinutes;

	return buildResult(
		"checkBusinessHours",
		passed,
		passed
			? `Business hours check passed for ${startTime} to ${endTime}.`
			: "Business hours check failed: events must run between 06:00 and 22:00 with a valid start and end time.",
	);
}

export interface SignatureState {
	required?: boolean;
	status: "pending" | "signed";
}

export function checkRequiredSignatures(signatures: SignatureState[]): RuleResult {
	const requiredSignatures = signatures.filter((signature) => signature.required !== false);
	const passed = requiredSignatures.length === 0 || requiredSignatures.every((signature) => signature.status === "signed");

	return buildResult(
		"checkRequiredSignatures",
		passed,
		passed
			? requiredSignatures.length > 0
				? `Required signatures are complete: ${requiredSignatures.length} signer(s) signed.`
				: "No required signatures are configured for this request."
			: `${requiredSignatures.filter((signature) => signature.status !== "signed").length} required signature(s) are still pending.`,
	);
}

export function checkAttachmentSupport(attachmentCount: number): RuleResult {
	const passed = attachmentCount > 0;

	return buildResult(
		"checkAttachmentSupport",
		passed,
		passed
			? `Supporting attachment provided (${attachmentCount}).`
			: "No attachment provided. Supporting documentation would improve review confidence.",
		false,
	);
}
