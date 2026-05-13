export declare enum UserRole {
    REQUESTER = "REQUESTER",
    PARISH_SECRETARY = "PARISH_SECRETARY",
    PARISH_PRIEST = "PARISH_PRIEST",
    ADMIN = "ADMIN"
}
export declare enum RequestStatus {
    PENDING = "PENDING",
    SECRETARY_REVIEW = "SECRETARY_REVIEW",
    PRIEST_REVIEW = "PRIEST_REVIEW",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    REVISION_REQUESTED = "REVISION_REQUESTED"
}
export declare enum ApprovalAction {
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    REVISION_REQUESTED = "REVISION_REQUESTED",
    FORWARDED = "FORWARDED"
}
export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
}
export interface VenueRequestInput {
    venueId: string;
    ministryId: string;
    eventName: string;
    purpose: string;
    startDateTime: Date;
    endDateTime: Date;
    attendees: number;
    specialRequirements?: string;
}
export interface ApprovalActionInput {
    requestId: string;
    remarks?: string;
}
export interface PaginationParams {
    page: number;
    limit: number;
}
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}
export interface PaginatedResponse<T> extends ApiResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
//# sourceMappingURL=index.d.ts.map