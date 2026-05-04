export interface ApprovalRoute {
	role: string;
	order: number;
	description: string;
}

export interface ApprovalRoutingResult {
	routes: ApprovalRoute[];
	totalStages: number;
	description: string;
}

export function determineApprovalRoute(
	ministry: string,
	venue: string,
): ApprovalRoutingResult {
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

export function getNextApprover(currentRole: string): string | null {
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

export function isApprovalComplete(currentStatus: string): boolean {
	return currentStatus === "APPROVED" || currentStatus === "REJECTED";
}

export default {
	determineApprovalRoute,
	getNextApprover,
	isApprovalComplete,
};
