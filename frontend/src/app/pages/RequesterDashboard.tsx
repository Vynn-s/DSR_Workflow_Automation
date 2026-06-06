import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Plus, Clock, CheckCircle2, XCircle, FileEdit, Bell, Search, CalendarDays, CalendarX, Sparkles } from "lucide-react";
import api from "../../lib/api";
import { formatRequestId } from "../../lib/requestId";
import { AnimatedNumber, EmptyState, FadeIn, PageHeader, SkeletonRows } from "../components/ui/page";

interface Request {
  id: string;
  venue: string;
  date: string;
  time: string;
  purpose: string;
  status: "Approved" | "Rejected" | "Pending" | "Draft" | "Under Review";
  submittedDate: string;
  timeline?: {
    submitted: string;
    underReview?: string;
    completed?: string;
  };
  approverRemarks?: string;
  approvedById?: string | null;
  approvedByName?: string | null;
  signatures?: Array<{
    role: string;
    signatory: string;
    required: boolean;
    status: "pending" | "signed";
    priestId?: string;
    priestName?: string;
    signedDate?: string;
  }>;
}

type ApiRequest = {
  id: string;
  venue: {
    id: string;
    name: string;
  };
  eventName: string;
  purpose: string;
  status: string;
  startDateTime: string;
  endDateTime: string;
  createdAt: string;
  updatedAt: string;
  approvalActions?: Array<{
    remarks?: string | null;
    createdAt: string;
    approver?: {
      id: string;
      name: string;
      email: string;
    };
  }>;
};

type ApiNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  details?: string | null;
  requestId?: string | null;
  read: boolean;
  createdAt: string;
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

function getDaysSince(value: string): number | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
}

function getRequesterDssTag(request: Request) {
  const pendingDays = getDaysSince(request.timeline?.submitted ?? request.submittedDate);
  switch (request.status) {
    case "Approved":
      return { label: "Confirmed — your venue is reserved", className: "bg-[#00A859]/10 text-[#007a41] border-[#00A859]/20 dark:text-[#00A859]" };
    case "Rejected":
      return { label: "Review the comment before resubmitting", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20" };
    case "Under Review":
      return { label: "Approver is reviewing this now", className: "bg-[#0F3B8C]/10 text-[#0F3B8C] border-[#0F3B8C]/20 dark:text-blue-300" };
    case "Pending":
      return pendingDays !== null && pendingDays > 2
        ? { label: `Pending for ${pendingDays} days — you may follow up`, className: "bg-[#B45309]/10 text-[#92400E] border-[#B45309]/25 dark:text-amber-300" }
        : { label: "Awaiting approver review", className: "bg-[#B45309]/10 text-[#92400E] border-[#B45309]/25 dark:text-amber-300" };
    default:
      return { label: "Draft — finish and submit when ready", className: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700" };
  }
}

function mapStatus(status: string): Request["status"] {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "SECRETARY_REVIEW":
    case "PRIEST_REVIEW":
      return "Under Review";
    case "REVISION_REQUESTED":
      return "Pending";
    case "PENDING":
    default:
      return "Pending";
  }
}

async function fetchLiveRequests() {
  const response = await api.get<{ requests: ApiRequest[] }>("/requests");

  return (response.requests ?? []).map((request) => {
    const status = mapStatus(request.status);
    const submittedDate = formatDateTime(request.createdAt);
    const submitted = formatDateTime(request.createdAt);
    const underReview = request.status === "SECRETARY_REVIEW" || request.status === "PRIEST_REVIEW"
      ? formatDateTime(request.updatedAt)
      : undefined;
    const completed = request.status === "APPROVED" || request.status === "REJECTED"
      ? formatDateTime(request.updatedAt)
      : undefined;

    const latestApprovalAction = [...(request.approvalActions ?? [])].reverse().find((action) => action.approver);

    return {
      id: request.id,
      venue: request.venue.name,
      date: formatDateTime(request.startDateTime).split(",")[0],
      time: formatTimeRange(request.startDateTime, request.endDateTime),
      purpose: request.purpose || request.eventName,
      status,
      submittedDate,
      timeline: {
        submitted,
        underReview,
        completed,
      },
      approverRemarks: [...(request.approvalActions ?? [])].reverse().find((action) => Boolean(action.remarks))?.remarks ?? undefined,
      approvedById: latestApprovalAction?.approver?.id ?? null,
      approvedByName: latestApprovalAction?.approver?.name ?? null,
    } satisfies Request;
  });
}

export function RequesterDashboard() {
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const notificationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = "Requester Dashboard — CathedralFlow";

    let isMounted = true;

    async function loadRequests() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const liveRequests = await fetchLiveRequests();

        if (isMounted) {
          setRequests(liveRequests);
        }
      } catch (error) {
        console.warn("Failed to load requests");
        if (isMounted) {
          setRequests([]);
          setLoadError("Unable to load your submitted requests right now.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadRequests();

    const handleWindowFocus = () => {
      void loadRequests();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadRequests();
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      try {
        const response = await api.get<{ notifications: ApiNotification[]; unreadCount: number }>("/notifications", {
          params: { limit: 5 },
        });

        if (isMounted) {
          setNotifications(response.notifications ?? []);
          setUnreadCount(response.unreadCount ?? 0);
        }
      } catch {
        if (isMounted) {
          setNotifications([]);
          setUnreadCount(0);
        }
      }
    }

    void loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!showNotifications) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showNotifications]);

  const markNotificationRead = async (notification: ApiNotification) => {
    if (notification.read) return;

    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      await api.patch(`/notifications/${notification.id}/read`);
    } catch {
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: false } : item));
      setUnreadCount((current) => current + 1);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-[#00A859]/10 text-[#00A859] border-[#00A859]/20";
      case "Rejected":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "Pending":
        return "bg-[#B45309]/10 text-[#92400E] dark:text-amber-300 border-[#B45309]/25 dark:border-[#C99700]/20";
      case "Under Review":
        return "bg-[#0F3B8C]/20 text-blue-300 border-[#0F3B8C]/30";
      case "Draft":
        return "bg-zinc-800 text-zinc-300 border-zinc-300 dark:border-zinc-700";
      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-300 dark:border-zinc-700";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Approved":
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "Rejected":
        return <XCircle className="w-3.5 h-3.5" />;
      case "Pending":
      case "Under Review":
        return <Clock className="w-3.5 h-3.5" />;
      case "Draft":
        return <FileEdit className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  const hasRequests = requests.length > 0;
  const stats = {
    all: requests.length,
    pending: requests.filter((request) => request.status === "Pending" || request.status === "Under Review").length,
    approved: requests.filter((request) => request.status === "Approved").length,
    rejected: requests.filter((request) => request.status === "Rejected").length,
    completed: requests.filter((request) => request.status === "Approved" || request.status === "Rejected").length,
  };
  const filteredRequests = requests.filter((request) => {
    const matchesSearch = [formatRequestId(request.id), request.venue, request.date, request.time, request.purpose, request.status]
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || request.status === statusFilter || (statusFilter === "Completed" && (request.status === "Approved" || request.status === "Rejected"));

    return matchesSearch && matchesStatus;
  });
  const detailRequest = selectedRequest ?? filteredRequests[0] ?? requests[0] ?? null;
  const completedApprovalDurations = requests
    .map((request) => {
      const submitted = request.timeline?.submitted ? new Date(request.timeline.submitted).getTime() : NaN;
      const completed = request.timeline?.completed ? new Date(request.timeline.completed).getTime() : NaN;
      return Number.isNaN(submitted) || Number.isNaN(completed) ? null : Math.max(0, completed - submitted);
    })
    .filter((value): value is number => value !== null);
  const averageApprovalHours = completedApprovalDurations.length > 0
    ? completedApprovalDurations.reduce((sum, value) => sum + value, 0) / completedApprovalDurations.length / (60 * 60 * 1000)
    : null;
  const detailDssTag = detailRequest ? getRequesterDssTag(detailRequest) : null;
  const detailDssMessage = detailRequest?.status === "Approved"
    ? "You should prepare for the event now that the venue is reserved. Confirm attendance, setup needs, and arrival time before the event date."
    : detailRequest?.status === "Rejected"
      ? `This request was rejected. You should review the comment${detailRequest.approverRemarks ? `: "${detailRequest.approverRemarks}"` : " and clarify the missing requirement before resubmitting"}.`
      : detailRequest?.status === "Under Review"
        ? "Your request is already with an approver. You should wait for the decision unless the event date is very close."
        : detailRequest
          ? `Your request is waiting for review. ${averageApprovalHours !== null ? `Based on loaded history, decisions take about ${averageApprovalHours.toFixed(1)} hours on average.` : "Not enough historical approval data is available yet."}`
          : "Select a request to see what you should do next.";
  const detailDssSuggestion = detailRequest?.status === "Approved"
    ? "Checklist: confirm attendance count, arrange setup with facilities, and keep your approval record ready."
    : detailRequest?.status === "Rejected"
      ? "If you resubmit, address the approver comment directly in your purpose or signed letter."
      : detailRequest?.status === "Under Review"
        ? "If this has been under review for more than two days, consider a polite follow-up."
        : "Keep your signed letter and event details ready in case the approver asks for clarification.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="DSR Workflow Automation Board"
        description="Dashboard summary, DSR records, workflow status, and live parish DSS guidance."
        actions={(
          <div ref={notificationRef} className="relative z-[120] isolate flex items-center gap-3">
          <Link
            to="/requester/new-request"
            className="inline-flex items-center gap-2 rounded-xl bg-[#00A859] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#009950] hover:text-white hover:shadow-lg active:scale-95 dark:hover:bg-[#00bf65] dark:hover:text-white"
          >
            <Plus className="w-4 h-4 text-white" />
            New DSR Request
          </Link>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-3 rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition-colors duration-150 hover:border-[#0F3B8C]/40 hover:bg-[#0F3B8C]/5 hover:text-[#0F3B8C] dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 bg-red-500 text-white dark:text-white text-[10px] font-black rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full z-[130] mt-3 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/15 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="px-5 py-4 border-b border-zinc-200 bg-gradient-to-br from-[#0F3B8C]/10 to-white dark:border-zinc-800 dark:from-[#0F3B8C]/25 dark:to-zinc-950">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black text-zinc-900 dark:text-zinc-100 text-sm">Notifications</h3>
                  <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-black text-red-500 dark:text-red-300">{unreadCount} unread</span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Recent DSR status updates</p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length > 0 ? notifications.map((notif) => (
                  <button
                    type="button"
                    key={notif.id}
                    onClick={() => markNotificationRead(notif)}
                    className={`flex gap-3 p-4 border-b border-zinc-100 transition-colors duration-150 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900/70 ${!notif.read ? "bg-[#0F3B8C]/5" : ""}`}
                  >
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${!notif.read ? "bg-[#0F3B8C]" : "bg-zinc-300 dark:bg-zinc-700"}`} />
                    <div className="min-w-0 text-left">
                      <p className="text-xs text-zinc-700 mb-1.5 leading-relaxed font-semibold dark:text-zinc-200">{notif.message}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{formatDateTime(notif.createdAt)}</p>
                    </div>
                  </button>
                )) : (
                  <div className="p-6 text-center text-xs font-semibold text-zinc-400 dark:text-zinc-500">No notifications yet</div>
                )}
              </div>
              <div className="p-4 text-center bg-zinc-50 border-t border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800">
                <Link
                  to="/requester/notifications"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-150"
                >
                  View all notifications
                </Link>
              </div>
            </div>
          )}
          </div>
        )}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["All", "All", stats.all, "text-[#00A859]"],
          ["Pending", "Pending", stats.pending, "text-[#92400E] dark:text-amber-300"],
          ["Approved", "Approved", stats.approved, "text-[#00A859]"],
          ["Rejected", "Rejected", stats.rejected, "text-red-500"],
          ["Completed", "Completed", stats.completed, "text-blue-500"],
        ].map(([tab, label, value, color]) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(String(tab))}
            className={`text-left p-4 rounded-2xl border bg-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-[#0F3B8C]/30 hover:bg-[#0F3B8C]/5 hover:shadow-md active:scale-95 dark:bg-zinc-950/60 dark:border-zinc-800 dark:hover:bg-zinc-900 ${statusFilter === tab ? "ring-2 ring-[#0F3B8C]/40 border-[#0F3B8C]" : "border-zinc-200"}`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block text-zinc-500 dark:text-zinc-400">{label}</span>
            <span className={`mt-2 text-2xl font-bold block ${color}`}><AnimatedNumber value={Number(value)} /></span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <SkeletonRows rows={4} />
        </div>
      ) : loadError ? (
        <div className="bg-white dark:bg-zinc-950/60 border border-red-500/20 rounded-3xl p-10 text-center">
          <p className="font-semibold text-red-400">{loadError}</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-2">If you just submitted a request, refresh after a few seconds.</p>
        </div>
      ) : !hasRequests ? (
        <EmptyState
          icon={CalendarX}
          title="No requests yet"
          description="Your submitted DSRs will appear here once you create your first venue request."
          action={<Link to="/requester/new-request" className="inline-flex items-center gap-2.5 rounded-xl bg-[#00A859] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-[#009950] hover:text-white active:scale-95 dark:hover:bg-[#00bf65] dark:hover:text-white"><Plus className="w-4 h-4 text-white" />New Request</Link>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 backdrop-blur-md p-5 space-y-4 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100">My Request Center</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Track your DSR submissions and workflow status.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search reference, venue, date, status, purpose..."
                className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0F3B8C]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {["All", "Pending", "Under Review", "Approved", "Rejected", "Completed"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black border ${statusFilter === tab ? "bg-[#0F3B8C] text-white hover:bg-[#0d3380] hover:text-white dark:hover:bg-[#1a4fab] dark:hover:text-white border-[#0F3B8C]" : "border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {filteredRequests.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 space-y-2">
                  <div className="text-3xl">DSR</div>
                  <h3 className="text-xs font-bold">No DSR records found</h3>
                  <p className="text-[10px] max-w-[260px] mx-auto">Try changing the search or status filter.</p>
                </div>
              ) : filteredRequests.map((request, index) => (
                <FadeIn key={request.id} delay={index * 35}>
                <div
                  onClick={() => setSelectedRequest(request)}
                  className={`group p-4 rounded-2xl cursor-pointer transition-all duration-150 flex items-start justify-between gap-4 border border-l-4 hover:-translate-y-0.5 ${detailRequest?.id === request.id ? "border-[#0F3B8C] bg-[#0F3B8C]/5 shadow-md shadow-zinc-900/5 dark:bg-[#0F3B8C]/15" : "border-zinc-200 border-l-zinc-200 hover:border-[#0F3B8C]/30 hover:border-l-[#0F3B8C] hover:bg-zinc-50 hover:shadow-sm dark:border-zinc-800 dark:border-l-zinc-800 dark:hover:bg-zinc-900/70"}`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <span className="text-[9px] font-mono font-bold text-zinc-400 dark:text-zinc-500">{formatRequestId(request.id)}</span>
                    <h3 className="text-xs font-extrabold truncate text-zinc-900 dark:text-zinc-100">{request.venue}</h3>
                    <p className="text-[11px] truncate text-zinc-500 dark:text-zinc-400">{request.purpose}</p>
                    <p className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500"><CalendarDays className="w-3 h-3" /> {request.date} • {request.time}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black rounded-full border ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      {request.status}
                    </span>
                    <span className={`max-w-[190px] rounded-full border px-2 py-0.5 text-right text-[9px] font-bold leading-tight ${getRequesterDssTag(request).className}`}>
                      {getRequesterDssTag(request).label}
                    </span>
                  </div>
                </div>
                </FadeIn>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 backdrop-blur-md p-5 space-y-5 shadow-sm">
            {detailRequest ? (
              <>
                <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 font-bold">{formatRequestId(detailRequest.id)}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black rounded-full border ${getStatusColor(detailRequest.status)}`}>
                      {getStatusIcon(detailRequest.status)}
                      {detailRequest.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-black mt-2 leading-snug text-zinc-900 dark:text-zinc-100">{detailRequest.purpose}</h3>
                  <p className="text-[11px] mt-1 text-zinc-500 dark:text-zinc-400">{detailRequest.venue}</p>
                </div>

                <div className="rounded-2xl border border-[#0F3B8C]/30 bg-gradient-to-br from-[#0F3B8C]/10 to-[#00A859]/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#C99700]" />
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Smart Decision Assistant</h4>
                    </div>
                    {detailDssTag && <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${detailDssTag.className}`}>{detailRequest.status}</span>}
                  </div>
                  <div className="my-3 border-t border-zinc-200 dark:border-zinc-800" />
                  <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{detailDssMessage}</p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{detailDssSuggestion}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"><span className="text-[10px] font-bold uppercase block text-zinc-400 dark:text-zinc-500">Date</span><p className="font-semibold text-zinc-900 dark:text-zinc-100">{detailRequest.date}</p></div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"><span className="text-[10px] font-bold uppercase block text-zinc-400 dark:text-zinc-500">Time</span><p className="font-semibold text-zinc-900 dark:text-zinc-100">{detailRequest.time}</p></div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"><span className="text-[10px] font-bold uppercase block text-zinc-400 dark:text-zinc-500">Submitted</span><p className="font-semibold text-zinc-900 dark:text-zinc-100">{detailRequest.submittedDate}</p></div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"><span className="text-[10px] font-bold uppercase block text-zinc-400 dark:text-zinc-500">Approver</span><p className="font-semibold text-zinc-900 dark:text-zinc-100">{detailRequest.approvedByName ?? detailRequest.approvedById ?? "Pending"}</p></div>
                </div>

                {detailRequest.approverRemarks && (
                  <div className="p-4 bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                    <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Approver Remarks</p>
                    <p className="text-xs text-zinc-600 leading-relaxed dark:text-zinc-300">{detailRequest.approverRemarks}</p>
                  </div>
                )}

                {detailRequest.timeline && (
                  <div className="space-y-4 pt-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Audit Trail Timeline</h4>
                    {[
                      ["Submitted", detailRequest.timeline.submitted, "Request has been submitted for review", true],
                      ["Under Review", detailRequest.timeline.underReview, "Being reviewed by approver", Boolean(detailRequest.timeline.underReview)],
                      [detailRequest.status === "Approved" ? "Approved" : detailRequest.status === "Rejected" ? "Rejected" : "Decision Pending", detailRequest.timeline.completed, "Final workflow decision", Boolean(detailRequest.timeline.completed)],
                    ].map(([title, date, body, active], index) => (
                      <div key={String(title)} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${active ? "bg-[#0F3B8C] text-white hover:bg-[#0d3380] hover:text-white dark:hover:bg-[#1a4fab] dark:hover:text-white" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-500"}`}>
                            {index === 2 && detailRequest.status === "Rejected" ? <XCircle className="w-4 h-4" /> : active ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                          </div>
                          {index < 2 && <div className="w-px h-10 bg-zinc-200 mt-2 dark:bg-zinc-800" />}
                        </div>
                        <div className="flex-1 pb-2">
                          <p className={`text-xs font-black ${active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500"}`}>{title}</p>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">{date || "Awaiting update"}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">{body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs font-semibold">Select a DSR record to view details.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
