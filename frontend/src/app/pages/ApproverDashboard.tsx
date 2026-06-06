import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { CheckCircle, XCircle, FileText, User, Calendar as CalendarIcon, Paperclip, Download, AlertCircle, CheckCircle2, Brain, TrendingUp, Shield, AlertTriangle, Sparkles, ArrowLeft } from "lucide-react";
import { formatRequestId } from "../../lib/requestId";
import { fetchVenues, type LiveVenue } from "../../lib/venues";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { AnimatedNumber, EmptyState, PageHeader, SkeletonRows } from "../components/ui/page";

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedDate: string;
  dataUrl: string;
}

interface Signature {
  role: string;
  signatory: string;
  status: "signed" | "pending";
  required?: boolean;
  priestId?: string;
  priestName?: string;
  signedDate?: string;
}

interface DSSRecommendation {
  decision: "approve" | "review" | "reject";
  confidence: number;
  reasons: string[];
  risks: string[];
  conflicts?: DssApiDecision["conflicts"];
}

type DssApiDecision = {
  allPassed: boolean;
  results: Array<{
    ruleName: string;
    passed: boolean;
    message: string;
  }>;
  recommendation: string;
  canProceed: boolean;
  conflicts?: Array<{
    id: string;
    eventName: string;
    purpose: string;
    requesterName: string;
    venueName: string;
    status: string;
    startDateTime: string;
    endDateTime: string;
    startTimeLabel: string;
    endTimeLabel: string;
    dateLabel: string;
  }>;
};

interface Request {
  id: string;
  venueId: string;
  ministryId: string;
  attendees: number;
  startDateTime: string;
  endDateTime: string;
  venue: string;
  date: string;
  time: string;
  purpose: string;
  requester: string;
  queueStatus: "PENDING" | "SECRETARY_REVIEW" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
  status: "Approved" | "Rejected" | "Pending" | "Under Review";
  submittedDate: string;
  attachments?: Attachment[];
  signatures?: Signature[];
  dssRecommendation?: DSSRecommendation;
  approvedById?: string | null;
  approvedByName?: string | null;
}

type ApiApprovalQueueItem = {
  id: string;
  venueId: string;
  ministryId: string;
  attendees: number;
  eventName: string;
  purpose: string;
  startDateTime: string;
  endDateTime: string;
  status: string;
  createdAt: string;
  requester: {
    name: string;
    email: string;
  };
  venue: {
    name: string;
  };
  ministry: {
    name: string;
  };
  approvalActions?: Array<{
    remarks?: string | null;
    createdAt: string;
    approver: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  attachments?: Attachment[];
  signatures?: Signature[];
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeRange(startDateTime: string, endDateTime: string) {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  return `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function mapDssDecision(decision: DssApiDecision): DSSRecommendation {
  const passedRules = decision.results.filter((result) => result.passed).map((result) => result.message);
  const failedRules = decision.results.filter((result) => !result.passed).map((result) => result.message);
  const passedCount = decision.results.filter((result) => result.passed).length;
  const confidence = decision.results.length > 0 ? Math.round((passedCount / decision.results.length) * 100) : 0;
  const recommendation: DSSRecommendation["decision"] = decision.canProceed && confidence >= 85
    ? "approve"
    : confidence >= 70
      ? "review"
      : "reject";

  return {
    decision: recommendation,
    confidence,
    reasons: passedRules.length > 0 ? passedRules : [decision.recommendation],
    risks: failedRules,
    conflicts: decision.conflicts ?? [],
  };
}

function getDssTone(decision?: DSSRecommendation["decision"]) {
  switch (decision) {
    case "approve":
      return {
        panel: "border-emerald-300 bg-gradient-to-br from-emerald-50 via-emerald-100/40 to-emerald-50",
        icon: "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/40",
        badge: "bg-emerald-600 text-white dark:text-white shadow-emerald-600/30",
        accent: "text-emerald-700",
      };
    case "review":
      return {
        panel: "border-amber-300 bg-gradient-to-br from-amber-50 via-amber-100/40 to-amber-50",
        icon: "bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/40",
        badge: "bg-amber-600 text-white dark:text-white shadow-amber-600/30",
        accent: "text-amber-700",
      };
    case "reject":
    default:
      return {
        panel: "border-rose-300 bg-gradient-to-br from-rose-50 via-rose-100/40 to-rose-50",
        icon: "bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/40",
        badge: "bg-rose-600 text-white dark:text-white shadow-rose-600/30",
        accent: "text-rose-700",
      };
  }
}

function mapApprovalStatus(status: string): Request["status"] {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "SECRETARY_REVIEW":
    case "PRIEST_REVIEW":
      return "Under Review";
    case "PENDING":
    default:
      return "Pending";
  }
}

function isActionableQueueStatus(status: Request["queueStatus"]) {
  return status === "PENDING" || status === "SECRETARY_REVIEW";
}

export function ApproverDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedReviewId = searchParams.get("requestId");
  const returnToAdmin = searchParams.get("from") === "admin";
  const [requests, setRequests] = useState<Request[]>([]);
  const [archivedRequests, setArchivedRequests] = useState<Request[]>([]);
  const [activeTab, setActiveTab] = useState<"queue" | "archive">("queue");
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [remarks, setRemarks] = useState("");
  const [venues, setVenues] = useState<LiveVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [archiveLoading, setArchiveLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [dssLoading, setDssLoading] = useState(false);
  const [dssError, setDssError] = useState<string | null>(null);
  const [priests, setPriests] = useState<Array<{ id: string; name: string; email: string }>>([]);

  const { isLoading: authLoading } = useAuth();

  const handleDownloadAttachment = (attachment: Attachment) => {
    const link = document.createElement("a");
    link.href = attachment.dataUrl;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    document.title = "Approvals — CathedralFlow";

    if (authLoading) return;
    let isMounted = true;

    async function loadRequests() {
      try {
        setRequestsLoading(true);
        setRequestsError(null);

        const response = await api.get<{ queue: ApiApprovalQueueItem[] }>("/approvals/queue");
        const liveRequests = (response.queue ?? []).map((request) => ({
          id: request.id,
          venueId: request.venueId,
          ministryId: request.ministryId,
          attendees: request.attendees,
          startDateTime: request.startDateTime,
          endDateTime: request.endDateTime,
          venue: request.venue.name,
          date: formatDateTime(request.startDateTime).split(",")[0],
          time: formatTimeRange(request.startDateTime, request.endDateTime),
          purpose: request.purpose || request.eventName,
          requester: request.requester.name,
          queueStatus: request.status as Request["queueStatus"],
          status: mapApprovalStatus(request.status),
          submittedDate: formatDateTime(request.createdAt),
          attachments: request.attachments ?? [],
          signatures: request.signatures ?? [],
          approvedById: [...(request.approvalActions ?? [])].reverse().find((action) => action.approver)?.approver?.id ?? null,
          approvedByName: [...(request.approvalActions ?? [])].reverse().find((action) => action.approver)?.approver?.name ?? null,
        } satisfies Request));

        if (isMounted) {
          setRequests(liveRequests);
          setSelectedRequest((currentSelected) => {
            if (requestedReviewId) {
              return liveRequests.find((request) => request.id === requestedReviewId) ?? liveRequests[0] ?? null;
            }

            if (!currentSelected) {
              return liveRequests[0] ?? null;
            }

            return liveRequests.find((request) => request.id === currentSelected.id) ?? liveRequests[0] ?? null;
          });
        }
      } catch (error) {
        console.warn("Failed to load approval queue");
        if (isMounted) {
          setRequests([]);
          setRequestsError("Unable to load approval queue right now.");
        }
      } finally {
        if (isMounted) {
          setRequestsLoading(false);
        }
      }
    }

    async function loadVenues() {
      try {
        setVenuesLoading(true);
        const liveVenues = await fetchVenues();

        if (isMounted) {
          setVenues(liveVenues);
        }
      } catch (error) {
        console.warn("Failed to load venues for approver dashboard");
        if (isMounted) {
          setVenues([]);
        }
      } finally {
        if (isMounted) {
          setVenuesLoading(false);
        }
      }
    }

    async function loadArchive() {
      try {
        setArchiveLoading(true);
        setArchiveError(null);

        const response = await api.get<{ archive: ApiApprovalQueueItem[] }>("/approvals/archive");
        const liveArchive = (response.archive ?? []).map((request) => ({
          id: request.id,
          venueId: request.venueId,
          ministryId: request.ministryId,
          attendees: request.attendees,
          startDateTime: request.startDateTime,
          endDateTime: request.endDateTime,
          venue: request.venue.name,
          date: formatDateTime(request.startDateTime).split(",")[0],
          time: formatTimeRange(request.startDateTime, request.endDateTime),
          purpose: request.purpose || request.eventName,
          requester: request.requester.name,
          queueStatus: request.status as Request["queueStatus"],
          status: mapApprovalStatus(request.status),
          submittedDate: formatDateTime(request.createdAt),
          attachments: request.attachments ?? [],
          signatures: request.signatures ?? [],
        } satisfies Request));

        if (isMounted) {
          setArchivedRequests(liveArchive);
        }
      } catch (error) {
        console.warn("Failed to load approval archive");
        if (isMounted) {
          setArchivedRequests([]);
          setArchiveError("Unable to load approval archive right now.");
        }
      } finally {
        if (isMounted) {
          setArchiveLoading(false);
        }
      }
    }

    void loadRequests();
    void loadVenues();
    void loadArchive();

    async function loadPriests() {
      try {
        const response = await api.get<{ priests: Array<{ id: string; name: string; email: string }> }>("/dss/priests");
        if (isMounted) {
          setPriests(response.priests ?? []);
        }
      } catch (error) {
        console.warn("Failed to load priest list for approver dashboard");
        if (isMounted) {
          setPriests([]);
        }
      }
    }

    void loadPriests();

    return () => {
      isMounted = false;
    };
  }, [authLoading, requestedReviewId]);

  useEffect(() => {
    let isMounted = true;

    async function evaluateSelectedRequest() {
      if (!selectedRequest || activeTab !== "queue") {
        setDssError(null);
        return;
      }

      setDssLoading(true);
      setDssError(null);

      try {
        const decision = await api.post<DssApiDecision>("/dss/evaluate", {
          requestId: selectedRequest.id,
        });

        if (isMounted) {
          const dssRecommendation = mapDssDecision(decision);
          setSelectedRequest((current) => (current?.id === selectedRequest.id ? { ...current, dssRecommendation } : current));
        }
      } catch (error) {
        const serverMessage = (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
        console.warn("Failed to evaluate DSS for selected request", serverMessage ?? error);
        if (isMounted) {
          setSelectedRequest((current) => (current?.id === selectedRequest.id ? { ...current, dssRecommendation: undefined } : current));
          setDssError(serverMessage ?? "Unable to load DSS guidance right now.");
        }
      } finally {
        if (isMounted) {
          setDssLoading(false);
        }
      }
    }

    void evaluateSelectedRequest();

    return () => {
      isMounted = false;
    };
  }, [activeTab, selectedRequest?.id]);

  const refreshQueue = async () => {
    const response = await api.get<{ queue: ApiApprovalQueueItem[] }>("/approvals/queue");
    const liveRequests = (response.queue ?? []).map((request) => ({
      id: request.id,
      venueId: request.venueId,
      ministryId: request.ministryId,
      attendees: request.attendees,
      startDateTime: request.startDateTime,
      endDateTime: request.endDateTime,
      venue: request.venue.name,
      date: formatDateTime(request.startDateTime).split(",")[0],
      time: formatTimeRange(request.startDateTime, request.endDateTime),
      purpose: request.purpose || request.eventName,
      requester: request.requester.name,
      queueStatus: request.status as Request["queueStatus"],
      status: mapApprovalStatus(request.status),
      submittedDate: formatDateTime(request.createdAt),
      attachments: request.attachments ?? [],
      signatures: request.signatures ?? [],
    } satisfies Request));

    setRequests(liveRequests);
    setSelectedRequest((currentSelected) => {
      if (!currentSelected) {
        return liveRequests[0] ?? null;
      }

      return liveRequests.find((request) => request.id === currentSelected.id) ?? liveRequests[0] ?? null;
    });
  };

  const handleApprove = async () => {
    if (!selectedRequest || isActionLoading) {
      return;
    }

    if (!isActionableQueueStatus(selectedRequest.queueStatus)) {
      setActionError("This request has already been processed.");
      await refreshQueue();
      return;
    }

    const requestId = selectedRequest.id;

    try {
      setIsActionLoading(true);
      setActionError(null);
      setActionSuccess(null);

      await api.post(`/approvals/${encodeURIComponent(requestId)}/approve`, {
        remarks: remarks.trim() || undefined,
      });

      setRemarks("");

      try {
        await refreshQueue();
      } catch (refreshError) {
          console.warn("Failed to refresh approval queue after approve");
      }

      setActionSuccess("Request accepted successfully.");
      toast.success("Request approved");
    } catch (error) {
      console.warn("Failed to approve request");
      setActionError("Unable to approve this request right now.");
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || isActionLoading) {
      return;
    }

    if (!isActionableQueueStatus(selectedRequest.queueStatus)) {
      setActionError("This request has already been processed.");
      await refreshQueue();
      return;
    }

    const requestId = selectedRequest.id;

    try {
      setIsActionLoading(true);
      setActionError(null);
      setActionSuccess(null);

      await api.post(`/approvals/${encodeURIComponent(requestId)}/reject`, {
        remarks: remarks.trim() || "Rejected from approver dashboard",
      });

      setRequests((currentRequests) => currentRequests.filter((request) => request.id !== requestId));
      setSelectedRequest((currentSelected) => {
        if (currentSelected?.id !== requestId) {
          return currentSelected;
        }

        const nextRequests = requests.filter((request) => request.id !== requestId);
        return nextRequests[0] ?? null;
      });
      setRemarks("");

      try {
        await refreshQueue();
      } catch (refreshError) {
        console.warn("Failed to refresh approval queue after reject");
      }

      setActionSuccess("Request rejected successfully.");
      toast.error("Request rejected");
    } catch (error) {
      console.warn("Failed to reject request");
      setActionError("Unable to reject this request right now.");
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const displayRequests = activeTab === "queue" ? requests : archivedRequests;
  const statusBadgeClass = (status: Request["status"]) => {
    switch (status) {
      case "Approved":
        return "bg-[#00A859]/15 text-[#00A859] border-[#00A859]/20";
      case "Rejected":
        return "bg-red-500/15 text-red-500 border-red-500/20";
      case "Under Review":
        return "bg-[#0F3B8C]/20 text-blue-300 border-[#0F3B8C]/30";
      default:
        return "bg-[#C99700]/15 text-amber-300 border-[#C99700]/20";
    }
  };
  const allKnownRequests = [...requests, ...archivedRequests];
  const requesterHistory = selectedRequest
    ? allKnownRequests.filter((request) => request.requester === selectedRequest.requester && request.id !== selectedRequest.id)
    : [];
  const requesterApproved = requesterHistory.filter((request) => request.status === "Approved").length;
  const requesterRejected = requesterHistory.filter((request) => request.status === "Rejected").length;
  const requesterApprovalRate = requesterHistory.length > 0 ? Math.round((requesterApproved / requesterHistory.length) * 100) : null;
  const dssConflicts = selectedRequest?.dssRecommendation?.conflicts ?? [];
  const localApprovedConflict = selectedRequest
    ? archivedRequests.find((request) => {
        if (request.status !== "Approved" || request.venueId !== selectedRequest.venueId || request.id === selectedRequest.id) return false;
        const selectedStart = new Date(selectedRequest.startDateTime).getTime();
        const selectedEnd = new Date(selectedRequest.endDateTime).getTime();
        const requestStart = new Date(request.startDateTime).getTime();
        const requestEnd = new Date(request.endDateTime).getTime();
        return requestStart < selectedEnd && requestEnd > selectedStart;
      })
    : null;
  const conflictLabel = dssConflicts[0]
    ? `${dssConflicts[0].eventName} by ${dssConflicts[0].requesterName}, ${dssConflicts[0].startTimeLabel} - ${dssConflicts[0].endTimeLabel}`
    : localApprovedConflict
      ? `${localApprovedConflict.purpose} by ${localApprovedConflict.requester}, ${localApprovedConflict.time}`
      : null;
  const missingCompleteness = selectedRequest
    ? [
        !selectedRequest.purpose ? "Purpose" : null,
        !selectedRequest.attendees ? "Attendance Count" : null,
        (selectedRequest.attachments?.length ?? 0) === 0 ? "Authorization Letter" : null,
        (selectedRequest.signatures ?? []).some((signature) => signature.required !== false && signature.status !== "signed") ? "Required Signature" : null,
      ].filter((value): value is string => Boolean(value))
    : [];
  const recommendedAction = conflictLabel
    ? "reject"
    : missingCompleteness.length > 0
      ? "return"
      : selectedRequest?.dssRecommendation?.decision === "approve"
        ? "approve"
        : "review";
  const recommendationLabel = recommendedAction === "approve"
    ? "Recommended: Approve"
    : recommendedAction === "reject"
      ? "Recommended: Reject — scheduling conflict"
      : recommendedAction === "return"
        ? "Recommended: Return for completion"
        : "Needs careful review";
  const recommendationClass = recommendedAction === "approve"
    ? "bg-[#00A859]/10 text-[#007a41] border-[#00A859]/20 dark:text-[#00A859]"
    : recommendedAction === "reject"
      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20"
      : recommendedAction === "return"
        ? "bg-[#B45309]/10 text-[#92400E] border-[#B45309]/25 dark:text-amber-300"
        : "bg-[#0F3B8C]/10 text-[#0F3B8C] border-[#0F3B8C]/20 dark:text-blue-300";
  const decisionExplanation = conflictLabel
    ? `You should reject this request because it overlaps with ${conflictLabel}.`
    : missingCompleteness.length > 0
      ? `This request needs ${missingCompleteness.join(", ")} before a fair approval decision. You should return it for completion instead of rejecting it.`
      : recommendedAction === "approve"
        ? "You can approve this request because the key checks are complete and no scheduling conflict is visible."
        : "You should review this carefully because the available checks are mixed or incomplete.";
  const actionButtonClass = (action: "approve" | "return" | "reject") => {
    const isRecommended = recommendedAction === action;
    return isRecommended ? "scale-[1.02] opacity-100 ring-2 ring-[#0F3B8C]/25" : "opacity-55 hover:opacity-100";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Pending Approvals" description="Review and approve or reject booking requests." />
        {returnToAdmin && (
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#0F3B8C]/20 bg-[#0F3B8C]/10 px-4 py-2 text-xs font-black text-[#0F3B8C] hover:bg-[#0F3B8C] hover:text-white dark:text-blue-300 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 space-y-4">
          {actionSuccess && (
            <div className="bg-[#00A859]/10 border border-[#00A859]/20 text-[#00A859] rounded-xl px-4 py-3 text-xs font-bold">
              {actionSuccess}
            </div>
          )}

          {actionError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 text-xs font-bold">
              {actionError}
            </div>
          )}
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 backdrop-blur-md p-5 space-y-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setActiveTab("queue"); setSelectedRequest(requests[0] ?? null); }} className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-colors duration-150 ${activeTab === "queue" ? "bg-[#0F3B8C] text-white hover:bg-[#0d3380] hover:text-white dark:hover:bg-[#1a4fab] dark:hover:text-white border-[#0F3B8C]" : "bg-white dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"}`}>Queue ({requests.length})</button>
              <button onClick={() => { setActiveTab("archive"); setSelectedRequest(archivedRequests[0] ?? null); }} className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-colors duration-150 ${activeTab === "archive" ? "bg-[#0F3B8C] text-white hover:bg-[#0d3380] hover:text-white dark:hover:bg-[#1a4fab] dark:hover:text-white border-[#0F3B8C]" : "bg-white dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"}`}>Archive ({archivedRequests.length})</button>
            </div>

            <div className="rounded-2xl p-4 border bg-zinc-50 dark:bg-zinc-900/70 border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-100">Live Venue Catalog</h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Shared source of truth for booking reviews</p>
                </div>
                <span className="text-2xl font-bold text-[#00A859]">{venuesLoading ? "..." : <AnimatedNumber value={venues.length} />}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {venues.slice(0, 4).map((venue) => (
                  <div key={venue.id} className="rounded-xl px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50">
                    <p className="text-[10px] font-black truncate text-zinc-900 dark:text-zinc-200">{venue.name}</p>
                    <p className="text-[9px] text-zinc-400 dark:text-zinc-500">{venue.capacity} seats</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">{activeTab === "queue" ? "Pending Requests" : "Archived Requests"}</h3>
                <span className="text-[10px] font-black text-amber-300">{displayRequests.length} {activeTab === "queue" ? "pending" : "archived"}</span>
              </div>
              {(activeTab === "queue" && requestsLoading) || (activeTab === "archive" && archiveLoading) ? (
                <SkeletonRows rows={4} />
              ) : activeTab === "queue" && requestsError ? (
                <div className="p-10 text-xs text-red-400">{requestsError}</div>
              ) : activeTab === "archive" && archiveError ? (
                <div className="p-10 text-xs text-red-400">{archiveError}</div>
              ) : displayRequests.length > 0 ? (
                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                  {displayRequests.map((request) => (
                    <button key={request.id} onClick={() => setSelectedRequest(request)} className={`w-full text-left p-4 rounded-2xl border border-l-4 transition-colors duration-150 ${selectedRequest?.id === request.id ? "border-[#0F3B8C] ring-2 ring-[#0F3B8C]/25 bg-[#0F3B8C]/5 dark:bg-[#0F3B8C]/15" : "border-zinc-200 border-l-zinc-200 dark:border-zinc-800 dark:border-l-zinc-800 bg-transparent hover:border-[#0F3B8C]/30 hover:border-l-[#0F3B8C] hover:bg-zinc-50 dark:hover:bg-zinc-900/70"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono font-black text-zinc-400 dark:text-zinc-500">{formatRequestId(request.id)}</p>
                          <p className="text-xs font-black truncate text-zinc-900 dark:text-zinc-100">{request.venue}</p>
                          <p className="text-[11px] truncate mt-1 text-zinc-500 dark:text-zinc-400">{request.purpose}</p>
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 text-[10px] font-black rounded-full border ${statusBadgeClass(request.status)}`}>{request.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-[10px] text-zinc-400 dark:text-zinc-500">
                        <span className="flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {request.date}</span>
                        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {request.time}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState icon={CheckCircle2} title={`No ${activeTab === "queue" ? "pending" : "archived"} requests`} description="Requests that need action will appear here." />
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          {selectedRequest ? (
            <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 backdrop-blur-md p-5 space-y-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div>
                  <p className="text-[10px] font-mono font-black text-zinc-400 dark:text-zinc-500">{formatRequestId(selectedRequest.id)}</p>
                  <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">{selectedRequest.purpose}</h2>
                  <p className="text-xs mt-1 text-zinc-500 dark:text-zinc-400">{selectedRequest.venue} • {selectedRequest.requester}</p>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-black rounded-full border ${statusBadgeClass(selectedRequest.status)}`}>{selectedRequest.status}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl border bg-zinc-50 dark:bg-zinc-900/70 border-zinc-200 dark:border-zinc-800"><p className="text-[10px] uppercase font-black text-zinc-400 dark:text-zinc-500">Schedule</p><p className="text-sm font-black mt-1 text-zinc-900 dark:text-zinc-100">{selectedRequest.date}</p><p className="text-[10px] text-zinc-400 dark:text-zinc-500">{selectedRequest.time}</p></div>
                <div className="p-4 rounded-2xl border bg-zinc-50 dark:bg-zinc-900/70 border-zinc-200 dark:border-zinc-800"><p className="text-[10px] uppercase font-black text-zinc-400 dark:text-zinc-500">Requester</p><p className="text-sm font-black mt-1 text-zinc-900 dark:text-zinc-100">{selectedRequest.requester}</p><p className="text-[10px] text-zinc-400 dark:text-zinc-500">Submitted {selectedRequest.submittedDate}</p></div>
                <div className="p-4 rounded-2xl border bg-zinc-50 dark:bg-zinc-900/70 border-zinc-200 dark:border-zinc-800"><p className="text-[10px] uppercase font-black text-zinc-400 dark:text-zinc-500">Approved By</p><select disabled value={selectedRequest?.approvedById ?? ""} className="mt-1 w-full bg-white dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0F3B8C]"><option value="">{selectedRequest?.approvedByName ?? "Not yet approved"}</option>{priests.map((priest) => (<option key={priest.id} value={priest.id}>{priest.name}</option>))}</select></div>
              </div>

              {activeTab === "queue" && (
                <div className="rounded-2xl border border-[#0F3B8C]/30 bg-gradient-to-br from-[#0F3B8C]/10 to-[#00A859]/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100"><Sparkles className="w-4 h-4 text-[#C99700]" /> Smart Decision Assistant</h3>
                    <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-black text-[#0F3B8C] ring-1 ring-[#0F3B8C]/15 dark:bg-zinc-950/60 dark:text-blue-300">
                      {dssLoading ? "Evaluating" : selectedRequest.dssRecommendation ? `${selectedRequest.dssRecommendation.confidence}% confidence` : "Not enough data yet"}
                    </span>
                  </div>
                  <div className="my-3 border-t border-zinc-200 dark:border-zinc-800" />
                  {dssError ? (
                    <p className="text-sm text-[#92400E] dark:text-amber-300">{dssError}</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="rounded-xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                          <p className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400">Conflict Analysis</p>
                          <p className={`mt-1 text-xs font-bold ${conflictLabel ? "text-red-700 dark:text-red-300" : "text-[#007a41] dark:text-[#00A859]"}`}>{conflictLabel ? "Conflict detected" : "No scheduling conflict"}</p>
                          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{conflictLabel ?? `${selectedRequest.venue} is clear for ${selectedRequest.time}.`}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                          <p className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400">Requester History</p>
                          <p className="mt-1 text-xs font-bold text-zinc-900 dark:text-zinc-100">{requesterHistory.length === 0 ? "First-time requester" : `${requesterHistory.length} past request${requesterHistory.length === 1 ? "" : "s"}`}</p>
                          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{requesterApprovalRate === null ? "Review carefully because no prior pattern is loaded." : `${requesterApproved} approved, ${requesterRejected} rejected — ${requesterApprovalRate}% approval rate.`}</p>
                        </div>
                        <div className="rounded-xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                          <p className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400">Completeness Score</p>
                          <p className={`mt-1 text-xs font-bold ${missingCompleteness.length === 0 ? "text-[#007a41] dark:text-[#00A859]" : "text-[#92400E] dark:text-amber-300"}`}>{missingCompleteness.length === 0 ? "Complete" : `Missing: ${missingCompleteness.join(", ")}`}</p>
                          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{missingCompleteness.length === 0 ? "Purpose, attendance, signatures, and attachments are ready for decision." : "You should return this for completion instead of rejecting it."}</p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-200 bg-white/85 p-3 dark:border-zinc-800 dark:bg-zinc-950/60">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${recommendationClass}`}>{recommendationLabel}</span>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{decisionExplanation}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={handleApprove} disabled={isActionLoading} className={`py-3 rounded-xl bg-[#00A859] text-white hover:bg-[#009950] hover:text-white dark:hover:bg-[#00bf65] dark:hover:text-white font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-60 transition-all duration-150 active:scale-95 ${actionButtonClass("approve")}`}><CheckCircle className="w-4 h-4" />{isActionLoading ? "Processing..." : "Approve"}</button>
                        <button type="button" disabled className={`py-3 rounded-xl bg-orange-500/15 text-orange-500 border border-orange-500/20 font-bold text-xs disabled:opacity-50 ${actionButtonClass("return")}`}>Return</button>
                        <button onClick={handleReject} disabled={isActionLoading} className={`py-3 rounded-xl bg-red-500/15 text-red-500 hover:bg-red-500/25 hover:text-red-600 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/30 dark:hover:text-red-300 border border-red-500/20 font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-60 transition-all duration-150 active:scale-95 ${actionButtonClass("reject")}`}><XCircle className="w-4 h-4" />{isActionLoading ? "Processing..." : "Reject"}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

                {/* Attachments */}
                {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                  <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Attached Documents ({selectedRequest.attachments.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedRequest.attachments.map((attachment) => (
                        <div 
                          key={attachment.id} 
                          className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors duration-150"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="p-2 bg-[#0F3B8C]/20 rounded-lg">
                              <FileText className="w-4 h-4 text-blue-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200 truncate">
                                {attachment.name}
                              </p>
                              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                {attachment.type} • {attachment.size}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDownloadAttachment(attachment)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#00A859] hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 rounded-md transition-colors duration-150"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signatures */}
                {selectedRequest.signatures && selectedRequest.signatures.length > 0 && (
                  <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Required Signatures ({selectedRequest.signatures.filter(s => s.status === "signed").length}/{selectedRequest.signatures.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedRequest.signatures.map((signature, index) => (
                        <div 
                          key={index}
                          className={`p-3 border rounded-lg ${
                            signature.status === "signed" 
                              ? "bg-[#00A859]/10 border-[#00A859]/20" 
                              : "bg-[#C99700]/10 border-[#C99700]/20"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2">
                              <div className={`p-1.5 rounded-full ${
                                signature.status === "signed" 
                                  ? "bg-emerald-500" 
                                  : "bg-amber-500"
                              }`}>
                                {signature.status === "signed" ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                                ) : (
                                  <AlertCircle className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">
                                  {signature.signatory}
                                </p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {signature.role}
                                </p>
                                {signature.priestName && (
                                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                                    Priest Signatory: {signature.priestName}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              {signature.status === "signed" ? (
                                <div>
                                    <p className="text-xs font-medium text-emerald-300">
                                    Signed
                                  </p>
                                    <p className="text-xs text-emerald-400">
                                    {signature.signedDate}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs font-medium text-amber-300">
                                  Awaiting Signature
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remarks Field - Only for Queue */}
                {activeTab === "queue" && (
                  <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800">
                    <label
                      htmlFor="remarks"
                      className="block text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 mb-2"
                    >
                      Remarks (Optional)
                    </label>
                    <textarea
                      id="remarks"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0F3B8C] resize-none"
                      placeholder="Add any notes or comments"
                    />
                  </div>
                )}

            </div>
          ) : (
            <div className="rounded-3xl border border-zinc-900 bg-white dark:bg-zinc-950/60 p-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-zinc-900 rounded-full mb-6">
                <FileText className="w-10 h-10 text-zinc-400 dark:text-zinc-500" />
              </div>
              <p className="text-zinc-900 dark:text-zinc-100 font-black text-lg">Select a request</p>
              <p className="text-zinc-400 dark:text-zinc-500 mt-2 text-xs">Click on a request to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
