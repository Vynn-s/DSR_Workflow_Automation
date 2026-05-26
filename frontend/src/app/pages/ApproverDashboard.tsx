import { useEffect, useState } from "react";
import { CheckCircle, XCircle, FileText, User, Calendar as CalendarIcon, Paperclip, Download, Eye, AlertCircle, CheckCircle2, Brain, TrendingUp, Shield, AlertTriangle } from "lucide-react";
import { formatRequestId } from "../../lib/requestId";
import { fetchVenues, type LiveVenue } from "../../lib/venues";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

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
  signedDate?: string;
}

interface DSSRecommendation {
  decision: "approve" | "review" | "reject";
  confidence: number;
  reasons: string[];
  risks: string[];
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

function formatDateForDss(value: string) {
  return value.slice(0, 10);
}

function formatTimeForDss(value: string) {
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
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
  };
}

function getDssTone(decision?: DSSRecommendation["decision"]) {
  switch (decision) {
    case "approve":
      return {
        panel: "border-emerald-300 bg-gradient-to-br from-emerald-50 via-emerald-100/40 to-emerald-50",
        icon: "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/40",
        badge: "bg-emerald-600 text-white shadow-emerald-600/30",
        accent: "text-emerald-700",
      };
    case "review":
      return {
        panel: "border-amber-300 bg-gradient-to-br from-amber-50 via-amber-100/40 to-amber-50",
        icon: "bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/40",
        badge: "bg-amber-600 text-white shadow-amber-600/30",
        accent: "text-amber-700",
      };
    case "reject":
    default:
      return {
        panel: "border-rose-300 bg-gradient-to-br from-rose-50 via-rose-100/40 to-rose-50",
        icon: "bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/40",
        badge: "bg-rose-600 text-white shadow-rose-600/30",
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
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [dssLoading, setDssLoading] = useState(false);
  const [dssError, setDssError] = useState<string | null>(null);

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
        } satisfies Request));

        if (isMounted) {
          setRequests(liveRequests);
          setSelectedRequest((currentSelected) => {
            if (!currentSelected) {
              return liveRequests[0] ?? null;
            }

            return liveRequests.find((request) => request.id === currentSelected.id) ?? liveRequests[0] ?? null;
          });
        }
      } catch (error) {
        console.error("Failed to load approval queue:", error);
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
        console.error("Failed to load venues for approver dashboard:", error);
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
        console.error("Failed to load approval archive:", error);
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

    return () => {
      isMounted = false;
    };
  }, [authLoading]);

  useEffect(() => {
    let isMounted = true;

    async function evaluateSelectedRequest() {
      if (!selectedRequest || activeTab !== "queue") {
        setDssError(null);
        return;
      }

      if (!selectedRequest.venueId || !selectedRequest.ministryId) {
        setSelectedRequest((current) => (current?.id === selectedRequest.id ? { ...current, dssRecommendation: undefined } : current));
        setDssError("DSS details are unavailable for this request.");
        return;
      }

      setDssLoading(true);
      setDssError(null);

      try {
        const decision = await api.post<DssApiDecision>("/dss/evaluate", {
          venueId: selectedRequest.venueId,
          requestId: selectedRequest.id,
          ministryId: selectedRequest.ministryId,
          requestDate: formatDateForDss(selectedRequest.startDateTime),
          startTime: formatTimeForDss(selectedRequest.startDateTime),
          endTime: formatTimeForDss(selectedRequest.endDateTime),
          attendees: selectedRequest.attendees,
          attachmentCount: selectedRequest.attachments?.length ?? 0,
          signatures: selectedRequest.signatures ?? [],
        });

        if (isMounted) {
          const dssRecommendation = mapDssDecision(decision);
          setSelectedRequest((current) => (current?.id === selectedRequest.id ? { ...current, dssRecommendation } : current));
        }
      } catch (error) {
        console.error("Failed to evaluate DSS for selected request:", error);
        if (isMounted) {
          setSelectedRequest((current) => (current?.id === selectedRequest.id ? { ...current, dssRecommendation: undefined } : current));
          setDssError("Unable to load DSS guidance right now.");
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
  }, [activeTab, selectedRequest?.id, selectedRequest?.venueId, selectedRequest?.ministryId, selectedRequest?.date, selectedRequest?.time, selectedRequest?.attendees]);

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

      await api.post(`/approvals/${requestId}/approve`, {
        remarks: remarks.trim() || undefined,
      });

      setRemarks("");

      try {
        await refreshQueue();
      } catch (refreshError) {
        console.error("Failed to refresh approval queue after approve:", refreshError);
      }

      setActionSuccess("Request accepted successfully.");
    } catch (error) {
      console.error("Failed to approve request:", error);
      setActionError("Unable to approve this request right now.");
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

      await api.post(`/approvals/${requestId}/reject`, {
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
        console.error("Failed to refresh approval queue after reject:", refreshError);
      }

      setActionSuccess("Request rejected successfully.");
    } catch (error) {
      console.error("Failed to reject request:", error);
      setActionError("Unable to reject this request right now.");
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-semibold text-slate-900 mb-3 tracking-tight">
          Pending Approvals
        </h1>
        <p className="text-lg text-slate-600">
          Review and approve or reject booking requests
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8 flex gap-4 border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab("queue");
            setSelectedRequest(requests[0] ?? null);
          }}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === "queue"
              ? "text-blue-600 border-b-2 border-b-blue-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Queue ({requests.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("archive");
            setSelectedRequest(archivedRequests[0] ?? null);
          }}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === "archive"
              ? "text-blue-600 border-b-2 border-b-blue-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Archive ({archivedRequests.length})
        </button>
      </div>

      <div className="mb-8 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
        <div className="px-8 py-5 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 text-lg">Live Venue Catalog</h2>
            <p className="text-sm text-slate-600 mt-0.5">Shared source of truth for booking reviews</p>
          </div>
          <span className="px-4 py-2 bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-full shadow-lg shadow-blue-500/30">
            {venuesLoading ? "Loading..." : `${venues.length} venues`}
          </span>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            {venues.map((venue) => (
              <span
                key={venue.id}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700"
              >
                <span>{venue.name}</span>
                <span className="text-slate-400">•</span>
                <span>{venue.capacity} seats</span>
              </span>
            ))}
            {!venuesLoading && venues.length === 0 && (
              <p className="text-sm text-slate-500">No venue data available.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Requests List */}
        <div className="col-span-2 space-y-6">
          {actionSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm">
              {actionSuccess}
            </div>
          )}

          {actionError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">
              {actionError}
            </div>
          )}

          {/* DSS Insights Panel */}
          {activeTab === "queue" && selectedRequest && (
            (() => {
              const dssTone = getDssTone(selectedRequest.dssRecommendation?.decision);

              return (
            <div
              className={`rounded-2xl border-2 shadow-xl shadow-slate-900/10 p-8 ${
                dssLoading
                  ? "border-slate-300 bg-slate-50"
                  : dssError
                  ? "border-amber-300 bg-amber-50"
                  : dssTone.panel
              }`}
            >
              <div className="flex items-start gap-5">
                <div
                  className={`p-4 rounded-xl shadow-lg ${
                    dssLoading
                      ? "bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-500/30"
                      : dssError
                      ? "bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30"
                      : dssTone.icon
                  }`}
                >
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900 text-xl">
                      Decision Support System Analysis
                    </h3>
                    {dssLoading ? (
                      <span className="px-4 py-2 text-sm font-bold rounded-full bg-slate-700 text-white shadow-sm">
                        Evaluating...
                      </span>
                    ) : dssError ? (
                      <span className="px-4 py-2 text-sm font-bold rounded-full bg-amber-600 text-white shadow-sm">
                        Guidance unavailable
                      </span>
                    ) : selectedRequest.dssRecommendation ? (
                      <span className={`px-4 py-2 text-sm font-bold rounded-full shadow-sm ${dssTone.badge}`}>
                        {selectedRequest.dssRecommendation.confidence}% Confidence
                      </span>
                    ) : null}
                  </div>

                  {dssLoading ? (
                    <p className="text-base text-slate-700">Running DSS checks against the live request data.</p>
                  ) : dssError ? (
                    <p className="text-base text-slate-700">{dssError}</p>
                  ) : selectedRequest.dssRecommendation ? (
                    <>
                      <p className="text-base text-slate-700 mb-6">
                        Recommendation: <span className={`font-bold uppercase ${dssTone.accent}`}>
                          {selectedRequest.dssRecommendation.decision}
                        </span>
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Supporting Factors
                          </h4>
                          <ul className="space-y-1.5">
                            {selectedRequest.dssRecommendation.reasons.map((reason, index) => (
                              <li key={index} className="text-xs text-slate-700 flex items-start gap-2">
                                <span className="text-emerald-600 mt-0.5">•</span>
                                <span>{reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {selectedRequest.dssRecommendation.risks.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Risk Factors
                            </h4>
                            <ul className="space-y-1.5">
                              {selectedRequest.dssRecommendation.risks.map((risk, index) => (
                                <li key={index} className="text-xs text-slate-700 flex items-start gap-2">
                                  <span className="text-rose-600 mt-0.5">•</span>
                                  <span>{risk}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-base text-slate-700">No DSS result is available for this request.</p>
                  )}
                </div>
              </div>
            </div>
              );
            })()
          )}

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-amber-50/30 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 text-xl">
                {activeTab === "queue" ? "Pending Requests" : "Archived Requests"}
              </h2>
              <span className="px-4 py-2 bg-gradient-to-br from-amber-500 to-amber-600 text-white text-sm font-bold rounded-full shadow-lg shadow-amber-500/40">
                {activeTab === "queue" ? requests.length : archivedRequests.length} {activeTab === "queue" ? "pending" : "archived"}
              </span>
            </div>

            {activeTab === "queue" ? (
              <>
                {requestsLoading ? (
                  <div className="p-10 text-sm text-slate-600">Loading approval queue...</div>
                ) : requestsError ? (
                  <div className="p-10 text-sm text-rose-700">{requestsError}</div>
                ) : requests.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {requests.map((request) => (
                      <div
                        key={request.id}
                        className={`p-6 cursor-pointer transition-all ${
                          selectedRequest?.id === request.id
                            ? "bg-blue-50 border-l-4 border-l-blue-600"
                            : "hover:bg-slate-50"
                        }`}
                        onClick={() => setSelectedRequest(request)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-slate-900 mb-1.5 text-lg">
                              {formatRequestId(request.id)}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <FileText className="w-4 h-4 text-slate-500" />
                              <span className="font-medium">{request.venue}</span>
                            </div>
                          </div>
                          <span className="px-3 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-700">
                            {request.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">{request.purpose}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-10 text-center">
                    <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">No pending requests</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {archiveLoading ? (
                  <div className="p-10 text-sm text-slate-600">Loading archive...</div>
                ) : archiveError ? (
                  <div className="p-10 text-sm text-rose-700">{archiveError}</div>
                ) : archivedRequests.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {archivedRequests.map((request) => (
                      <div
                        key={request.id}
                        className={`p-6 cursor-pointer transition-all ${
                          selectedRequest?.id === request.id
                            ? "bg-blue-50 border-l-4 border-l-blue-600"
                            : "hover:bg-slate-50"
                        }`}
                        onClick={() => setSelectedRequest(request)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-slate-900 mb-1.5 text-lg">
                              {formatRequestId(request.id)}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <FileText className="w-4 h-4 text-slate-500" />
                              <span className="font-medium">{request.venue}</span>
                            </div>
                          </div>
                          <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                            request.status === "Approved" ? "bg-emerald-100 text-emerald-700" :
                            request.status === "Rejected" ? "bg-rose-100 text-rose-700" :
                            "bg-amber-100 text-amber-700"
                          }`}>
                            {request.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">{request.purpose}</p>
                        <p className="text-xs text-slate-500 mt-2">Processed on {request.submittedDate}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-10 text-center">
                    <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">No archived requests</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Request Details & Actions */}
        <div className="col-span-1">
          {selectedRequest ? (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 sticky top-6 overflow-hidden">
              <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-200">
                <h2 className="font-semibold text-slate-900 text-xl">Request Details</h2>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Request ID</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatRequestId(selectedRequest.id)}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Venue</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedRequest.venue}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date & Time</p>
                  <p className="text-sm font-semibold text-slate-900 mb-1">
                    {selectedRequest.date}
                  </p>
                  <p className="text-sm text-slate-700">
                    {selectedRequest.time}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Purpose</p>
                  <p className="text-sm text-slate-900">
                    {selectedRequest.purpose}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Requester</p>
                  <p className="text-sm text-slate-900">
                    {selectedRequest.requester}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Submitted On</p>
                  <p className="text-sm text-slate-900">
                    {selectedRequest.submittedDate}
                  </p>
                </div>

                {/* Attachments */}
                {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                  <div className="pt-5 border-t border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Attached Documents ({selectedRequest.attachments.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedRequest.attachments.map((attachment) => (
                        <div 
                          key={attachment.id} 
                          className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {attachment.name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {attachment.type} • {attachment.size}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleDownloadAttachment(attachment)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                          <button
                            onClick={() => setPreviewAttachment(attachment)}
                            className="ml-2 flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Preview
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signatures */}
                {selectedRequest.signatures && selectedRequest.signatures.length > 0 && (
                  <div className="pt-5 border-t border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Required Signatures ({selectedRequest.signatures.filter(s => s.status === "signed").length}/{selectedRequest.signatures.length})
                    </h3>
                    <div className="space-y-2">
                      {selectedRequest.signatures.map((signature, index) => (
                        <div 
                          key={index}
                          className={`p-3 border rounded-lg ${
                            signature.status === "signed" 
                              ? "bg-emerald-50 border-emerald-200" 
                              : "bg-amber-50 border-amber-200"
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
                                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                ) : (
                                  <AlertCircle className="w-3.5 h-3.5 text-white" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {signature.signatory}
                                </p>
                                <p className="text-xs text-slate-600">
                                  {signature.role}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              {signature.status === "signed" ? (
                                <div>
                                  <p className="text-xs font-medium text-emerald-700">
                                    Signed
                                  </p>
                                  <p className="text-xs text-emerald-600">
                                    {signature.signedDate}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs font-medium text-amber-700">
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
                  <div className="pt-5 border-t border-slate-200">
                    <label
                      htmlFor="remarks"
                      className="block text-sm font-semibold text-slate-700 mb-2"
                    >
                      Remarks (Optional)
                    </label>
                    <textarea
                      id="remarks"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none"
                      placeholder="Add any notes or comments"
                    />
                  </div>
                )}

                {/* Action Buttons - Only for Queue */}
                {activeTab === "queue" && (
                  <div className="pt-5 border-t border-slate-200 space-y-3">
                    <button
                      onClick={handleApprove}
                      disabled={isActionLoading}
                      className="w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-xl shadow-emerald-900/30 hover:shadow-2xl hover:shadow-emerald-900/40 font-semibold text-base hover:-translate-y-0.5 transform disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                      <CheckCircle className="w-5 h-5" />
                      {isActionLoading ? "Processing..." : "Approve Request"}
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={isActionLoading}
                      className="w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-xl hover:from-rose-700 hover:to-rose-800 transition-all shadow-xl shadow-rose-900/30 hover:shadow-2xl hover:shadow-rose-900/40 font-semibold text-base hover:-translate-y-0.5 transform disabled:opacity-60 disabled:hover:translate-y-0"
                    >
                      <XCircle className="w-5 h-5" />
                      {isActionLoading ? "Processing..." : "Reject Request"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-xl shadow-slate-900/10">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-slate-100 to-blue-50 rounded-full mb-6 shadow-lg shadow-slate-900/10">
                <FileText className="w-10 h-10 text-slate-500" />
              </div>
              <p className="text-slate-900 font-semibold text-lg">Select a request</p>
              <p className="text-slate-500 mt-2">Click on a request to view details</p>
            </div>
          )}
        </div>
      </div>

      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Preview Attachment</h3>
                <p className="text-sm text-slate-600">{previewAttachment.name}</p>
              </div>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-700" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 flex-1 overflow-auto">
              {previewAttachment.type.startsWith("image/") ? (
                <img
                  src={previewAttachment.dataUrl}
                  alt={previewAttachment.name}
                  className="max-w-full h-auto mx-auto rounded-lg shadow-lg"
                />
              ) : previewAttachment.type === "application/pdf" ? (
                <iframe
                  title={previewAttachment.name}
                  src={previewAttachment.dataUrl}
                  className="w-full h-[70vh] rounded-lg bg-white"
                />
              ) : (
                <div className="text-center py-16">
                  <p className="text-slate-700 font-medium">Preview not available for this file type.</p>
                  <p className="text-sm text-slate-500 mt-2">Use Download to open the document locally.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}