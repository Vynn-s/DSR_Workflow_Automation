import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Plus, Clock, CheckCircle2, XCircle, Eye, X, FileEdit, Bell } from "lucide-react";
import api from "../../lib/api";

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
}

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
  }>;
};

export function RequesterDashboard() {
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadRequests() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const response = await api.get<{ requests: ApiRequest[] }>("/requests");
          const liveRequests = (response.requests ?? []).map((request) => {
          const status = mapStatus(request.status);
          const submittedDate = formatDateTime(request.createdAt);
          const submitted = formatDateTime(request.createdAt);
          const underReview = request.status === "SECRETARY_REVIEW" || request.status === "PRIEST_REVIEW"
            ? formatDateTime(request.updatedAt)
            : undefined;
          const completed = request.status === "APPROVED" || request.status === "REJECTED"
            ? formatDateTime(request.updatedAt)
            : undefined;

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
          } satisfies Request;
        });

        if (isMounted) {
          setRequests(liveRequests);
        }
      } catch (error) {
        console.error("Failed to load requests:", error);
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

    return () => {
      isMounted = false;
    };
  }, []);

  // Mock notifications
  const notifications = [
    {
      id: 1,
      type: "approved",
      message: "Your request REQ-001 for Main Chapel has been approved",
      date: "2026-01-29",
      read: false
    },
    {
      id: 2,
      type: "rejected",
      message: "Your request REQ-003 for Multipurpose Room has been rejected",
      date: "2026-01-26",
      read: false
    },
    {
      id: 3,
      type: "review",
      message: "Your request REQ-002 is now under review",
      date: "2026-02-01",
      read: true
    }
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Rejected":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "Pending":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Under Review":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Draft":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
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

  return (
    <div>
      {/* Page Header */}
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-semibold text-slate-900 mb-3 tracking-tight">
            Dashboard
          </h1>
          <p className="text-lg text-slate-600">
            View your booking requests and submit new venue reservations
          </p>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-3.5 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 hover:border-blue-300 transition-all shadow-sm hover:shadow-md"
          >
            <Bell className="w-5 h-5 text-slate-700" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 bg-gradient-to-br from-rose-500 to-rose-600 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg shadow-rose-500/50">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-3 w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-900/20 z-50 overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 border-b border-blue-500">
                <h3 className="font-semibold text-white text-lg">Notifications</h3>
                <p className="text-sm text-blue-100 mt-0.5">{unreadCount} unread</p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      !notif.read ? "bg-blue-50 border-l-4 border-l-blue-500" : ""
                    }`}
                  >
                    <p className="text-sm text-slate-900 mb-1.5 leading-relaxed">{notif.message}</p>
                    <p className="text-xs text-slate-500">{notif.date}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 text-center bg-slate-50 border-t border-slate-200">
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="mb-8">
        <Link
          to="/requester/new-request"
          className="inline-flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-xl shadow-blue-900/30 hover:shadow-2xl hover:shadow-blue-900/40 font-medium text-lg hover:-translate-y-0.5 transform"
        >
          <Plus className="w-5 h-5" />
          Submit New Booking Request
        </Link>
      </div>

      {/* Requests */}
      {isLoading ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 p-10 text-center text-slate-600">
          Loading your submitted requests...
        </div>
      ) : loadError ? (
        <div className="bg-white border border-rose-200 rounded-2xl shadow-xl shadow-slate-900/10 p-10 text-center">
          <p className="font-semibold text-rose-700">{loadError}</p>
          <p className="text-sm text-slate-500 mt-2">If you just submitted a request, refresh after a few seconds.</p>
        </div>
      ) : !hasRequests ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl shadow-xl shadow-slate-900/10 p-16 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-100 via-indigo-100 to-blue-100 rounded-full mb-6 shadow-lg shadow-blue-900/10">
            <FileEdit className="w-12 h-12 text-blue-600" />
          </div>
          <h3 className="text-2xl font-semibold text-slate-900 mb-3">
            No Requests Yet
          </h3>
          <p className="text-slate-600 mb-8 max-w-md mx-auto text-lg leading-relaxed">
            You haven't submitted any booking requests yet. Start by submitting a new request for your venue or facility needs.
          </p>
          <Link
            to="/requester/new-request"
            className="inline-flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-xl shadow-blue-900/30 font-medium text-lg"
          >
            <Plus className="w-5 h-5" />
            Submit New Booking Request
          </Link>
        </div>
      ) : (
        /* Requests Table */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900 text-xl">My Requests</h2>
            <p className="text-sm text-slate-600 mt-1">Track the status of your venue bookings</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Request ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Venue
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Purpose
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-5 text-sm font-semibold text-slate-900">
                      {request.id}
                    </td>
                    <td className="px-6 py-5 text-sm font-medium text-slate-900">
                      {request.venue}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-700">
                      {request.date}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-700">
                      {request.time}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-700">
                      {request.purpose}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-full border ${getStatusColor(
                          request.status
                        )}`}
                      >
                        {getStatusIcon(request.status)}
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all"
                      >
                        <Eye className="w-4 h-4" />
                        View Timeline
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Timeline Modal */}
      {selectedRequest && selectedRequest.timeline && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-xl">Request Status Timeline</h3>
                <p className="text-sm text-blue-100 mt-1">{selectedRequest.id}</p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8">
              {/* Request Details */}
              <div className="mb-8 p-6 bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200 rounded-xl">
                <div className="grid grid-cols-2 gap-6 text-sm">
                  <div>
                    <p className="text-slate-600 font-medium mb-1">Venue</p>
                    <p className="font-semibold text-slate-900 text-base">{selectedRequest.venue}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 font-medium mb-1">Date</p>
                    <p className="font-semibold text-slate-900 text-base">{selectedRequest.date}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 font-medium mb-1">Time</p>
                    <p className="font-semibold text-slate-900 text-base">{selectedRequest.time}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 font-medium mb-1">Purpose</p>
                    <p className="font-semibold text-slate-900 text-base">{selectedRequest.purpose}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-6">
                {/* Submitted */}
                <div className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40">
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                    {(selectedRequest.timeline.underReview || selectedRequest.timeline.completed) && (
                      <div className="w-1 h-16 bg-gradient-to-b from-blue-400 to-blue-200 mt-3 rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <h4 className="font-semibold text-slate-900 text-lg">Submitted</h4>
                    <p className="text-sm text-slate-600 font-medium mt-1">{selectedRequest.timeline.submitted}</p>
                    <p className="text-xs text-slate-500 mt-2">Request has been submitted for review</p>
                  </div>
                </div>

                {/* Under Review */}
                <div className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
                      selectedRequest.timeline.underReview
                        ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/40"
                        : "bg-slate-200 shadow-slate-300/40"
                    }`}>
                      <Clock className={`w-6 h-6 ${
                        selectedRequest.timeline.underReview ? "text-white" : "text-slate-400"
                      }`} />
                    </div>
                    {selectedRequest.timeline.completed && (
                      <div className="w-1 h-16 bg-gradient-to-b from-blue-400 to-blue-200 mt-3 rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <h4 className={`font-semibold text-lg ${
                      selectedRequest.timeline.underReview ? "text-slate-900" : "text-slate-400"
                    }`}>
                      Under Review
                    </h4>
                    {selectedRequest.timeline.underReview ? (
                      <>
                        <p className="text-sm text-slate-600 font-medium mt-1">{selectedRequest.timeline.underReview}</p>
                        <p className="text-xs text-slate-500 mt-2">Being reviewed by approver</p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400 mt-1">Awaiting review</p>
                    )}
                  </div>
                </div>

                {/* Completed */}
                <div className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
                      selectedRequest.timeline.completed
                        ? selectedRequest.status === "Approved"
                          ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/40"
                          : "bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/40"
                        : "bg-slate-200 shadow-slate-300/40"
                    }`}>
                      {selectedRequest.timeline.completed ? (
                        selectedRequest.status === "Approved" ? (
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        ) : (
                          <XCircle className="w-6 h-6 text-white" />
                        )
                      ) : (
                        <Clock className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold text-lg ${
                      selectedRequest.timeline.completed ? "text-slate-900" : "text-slate-400"
                    }`}>
                      {selectedRequest.status === "Approved" ? "Approved" : selectedRequest.status === "Rejected" ? "Rejected" : "Decision Pending"}
                    </h4>
                    {selectedRequest.timeline.completed ? (
                      <>
                        <p className="text-sm text-slate-600 font-medium mt-1">{selectedRequest.timeline.completed}</p>
                        {selectedRequest.approverRemarks && (
                          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                            <p className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">Approver Remarks:</p>
                            <p className="text-sm text-slate-900 leading-relaxed">{selectedRequest.approverRemarks}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-400 mt-1">Awaiting decision</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 px-8 py-5 bg-slate-50">
              <button
                onClick={() => setSelectedRequest(null)}
                className="w-full px-6 py-3.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl hover:from-slate-900 hover:to-black transition-all shadow-lg shadow-slate-900/30 font-medium"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
