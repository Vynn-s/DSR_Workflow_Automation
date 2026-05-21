import { useEffect, useState } from "react";
import { Filter, Activity, TrendingUp, Eye, X, User, Clock, FileText, MapPin, Monitor, RefreshCw } from "lucide-react";
import api from "../../lib/api";

interface AuditEntry {
  id: string;
  rawAction?: string;
  createdAt?: string;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  details: string;
  fullDetails?: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string; // human-friendly/short display
    requestIdRaw?: string; // raw UUID or canonical id
    requestIdAltRaw?: string; // alternate id present in details if different
    requestIdAlt?: string; // short display for alternate id
    venue?: string;
    previousValue?: string;
    newValue?: string;
    affectedUsers?: string[];
    systemNotes?: string;
  };
}

type AuditRole = "REQUESTER" | "PARISH_SECRETARY" | "PARISH_PRIEST" | "ADMIN";

type AuditLogItem = {
  id: string;
  action: string;
  createdAt: string;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  performedBy?: {
    id: string;
    name: string;
    email: string;
    role: AuditRole;
  } | null;
  venueRequest?: {
    id: string;
    startDateTime?: string;
    status?: string;
    venue?: { id: string; name: string } | null;
    requester?: { id: string; name: string; email: string } | null;
    ministry?: { id: string; name: string } | null;
  } | null;
};

type AuditLogsResponse = {
  success: boolean;
  data: {
    items: AuditLogItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type AuditStats = {
  totalRequestsThisMonth: number;
  averageApprovalTimeHours: number;
  totalConflictsDetected: number;
  rejectionRate: number;
  requestsByMinistry: Array<{
    ministryId: string;
    ministryName: string;
    total: number;
  }>;
  weeklyRequestVolume: Array<{
    weekStart: string;
    weekEnd: string;
    total: number;
  }>;
};

function formatRole(role?: AuditRole): string {
  switch (role) {
    case "REQUESTER":
      return "Requester";
    case "ADMIN":
      return "Administrator";
    case "PARISH_SECRETARY":
    case "PARISH_PRIEST":
      return "Approver";
    default:
      return "System";
  }
}

function formatAction(action: string): string {
  switch (action) {
    case "REQUEST_CREATED":
      return "Submitted Request";
    case "REQUEST_APPROVED":
      return "Approved Request";
    case "REQUEST_REJECTED":
      return "Rejected Request";
    case "REQUEST_REVISION_REQUESTED":
      return "Requested Revision";
    case "DSS_EVALUATION":
      return "DSS Evaluation";
    default:
      return action.replaceAll("_", " ");
  }
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function mapAuditEntry(item: AuditLogItem): AuditEntry {
  const details = item.details ?? {};
  const rawPrimary = item.venueRequest?.id ?? undefined;
  const rawDetailsId = getString((details as any).requestId);
  let requestIdDisplay: string | undefined = undefined;
  let requestIdAltRaw: string | undefined = undefined;
  let requestIdAltDisplay: string | undefined = undefined;

  function shortId(id?: string) {
    if (!id) return undefined;
    // If UUID-like, use first segment as an easy lookup token
    const parts = id.split("-");
    if (parts.length > 1) return `REQ-${parts[0].toUpperCase()}`;
    return id;
  }

  if (rawPrimary && rawDetailsId) {
    if (rawPrimary === rawDetailsId) {
      requestIdDisplay = shortId(rawPrimary);
    } else {
      requestIdDisplay = shortId(rawPrimary);
      requestIdAltRaw = rawDetailsId;
      requestIdAltDisplay = shortId(rawDetailsId);
    }
  } else if (rawPrimary) {
    requestIdDisplay = shortId(rawPrimary);
  } else if (rawDetailsId) {
    requestIdDisplay = shortId(rawDetailsId);
  }
  const venue = item.venueRequest?.venue?.name ?? getString(details.venue) ?? getString(details.venueName);
  const previousValue = getString(details.previousStatus) ?? getString(details.previousValue);
  const newValue = getString(details.nextStatus) ?? getString(details.newValue) ?? getString(details.decision);
  const systemNotes = getString(details.remarks) ?? getString(details.systemNotes) ?? getString(details.decision);
  const affectedUsers = Array.isArray(details.affectedUsers)
    ? details.affectedUsers.filter((value): value is string => typeof value === "string")
    : undefined;

  return {
    id: item.id,
    rawAction: item.action,
    createdAt: item.createdAt,
    timestamp: item.createdAt,
    user: item.performedBy?.name ?? "System",
    role: formatRole(item.performedBy?.role),
    action: formatAction(item.action),
    details: venue
      ? `${formatAction(item.action)}${requestId ? ` ${requestId}` : ""} at ${venue}`
      : requestId
      ? `${formatAction(item.action)} ${requestId}`
      : formatAction(item.action),
    fullDetails: {
      ipAddress: item.ipAddress ?? undefined,
      userAgent: getString(details.userAgent),
      requestId: requestIdDisplay,
      requestIdRaw: rawPrimary ?? rawDetailsId,
      requestIdAltRaw,
      requestIdAlt: requestIdAltDisplay,
      venue,
      previousValue,
      newValue,
      affectedUsers,
      systemNotes,
    },
  };
}

export function AuditLogPage() {
  const [filterRole, setFilterRole] = useState<string>("All");
  const [filterAction, setFilterAction] = useState<string>("All");
  const [filterDate, setFilterDate] = useState<string>("");
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [auditTotal, setAuditTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAuditData() {
      setLoading(true);
      setError(null);

      const params: Record<string, string> = {};

      if (filterRole !== "All") {
        params.role = filterRole;
      }

      if (filterAction !== "All") {
        params.action = filterAction;
      }

      if (filterDate) {
        const start = new Date(filterDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        params.dateFrom = start.toISOString();
        params.dateTo = end.toISOString();
      }

      params.limit = "100";

      const [logsResult, statsResult] = await Promise.allSettled([
        api.get<AuditLogsResponse>("/audit", { params }),
        api.get<AuditStats>("/audit/stats", { params }),
      ]);

      if (!mounted) {
        return;
      }

      if (logsResult.status === "fulfilled") {
        setAuditTotal(logsResult.value.data.total ?? 0);
        setAuditLogs((logsResult.value.data.items ?? []).map(mapAuditEntry));
      } else {
        console.error("Failed to load audit logs:", logsResult.reason);
        setAuditTotal(0);
        setAuditLogs([]);
        setError("Unable to load audit logs right now.");
      }

      if (statsResult.status === "fulfilled") {
        setAuditStats(statsResult.value);
      } else {
        console.error("Failed to load audit stats:", statsResult.reason);
        setAuditStats(null);
      }

      setLoading(false);
    }

    void loadAuditData();

    return () => {
      mounted = false;
    };
  }, [filterAction, filterDate, filterRole]);

  const requestsSubmitted = auditLogs.filter((entry) => entry.rawAction === "REQUEST_CREATED").length;
  const approvalsMade = auditLogs.filter((entry) => entry.rawAction === "REQUEST_APPROVED").length;
  const averageTurnaround = auditStats ? `${auditStats.averageApprovalTimeHours.toFixed(1)} hours` : "N/A";

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900 mb-2 tracking-tight">
          Audit Log & Reports
        </h1>
        <p className="text-slate-600">
          View system activity and user actions
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Filters</h3>
        </div>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label
              htmlFor="role-filter"
              className="block text-sm font-semibold text-slate-700 mb-2"
            >
              Filter by Role
            </label>
            <select
              id="role-filter"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            >
              <option value="All">All Roles</option>
              <option value="REQUESTER">Requester</option>
              <option value="PARISH_SECRETARY">Parish Secretary</option>
              <option value="PARISH_PRIEST">Parish Priest</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>

          <div className="flex-1">
            <label
              htmlFor="action-filter"
              className="block text-sm font-semibold text-slate-700 mb-2"
            >
              Filter by Action
            </label>
            <select
              id="action-filter"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            >
              <option value="All">All Actions</option>
              <option value="REQUEST_CREATED">Submitted Request</option>
              <option value="REQUEST_APPROVED">Approved Request</option>
              <option value="REQUEST_REJECTED">Rejected Request</option>
              <option value="REQUEST_REVISION_REQUESTED">Requested Revision</option>
              <option value="DSS_EVALUATION">DSS Evaluation</option>
            </select>
          </div>

          <div className="flex-1">
            <label
              htmlFor="date-filter"
              className="block text-sm font-semibold text-slate-700 mb-2"
            >
              Filter by Date
            </label>
            <input
              id="date-filter"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>

          <button
            onClick={() => {
              setFilterRole("All");
              setFilterAction("All");
              setFilterDate("");
            }}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-slate-200/60 flex items-center gap-2">
          <Activity className="w-5 h-5 text-slate-600" />
          <h2 className="font-semibold text-slate-900 text-lg">
            Activity Log
          </h2>
          <span className="ml-auto px-3 py-1 bg-slate-100 text-slate-700 text-sm font-medium rounded-full">
            {auditTotal} entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50 border-b border-slate-200/60">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && auditLogs.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-900 whitespace-nowrap font-mono">
                    {new Date(entry.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {entry.user}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border ${
                        entry.role === "Administrator"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : entry.role === "Approver"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      {entry.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    {entry.action}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {entry.details}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => setSelectedEntry(entry)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4 animate-pulse">
              <Activity className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">Loading audit entries...</p>
          </div>
        )}

        {auditLogs.length === 0 && !loading && (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
              <Activity className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">
              No audit entries found
            </p>
            <p className="text-slate-500 text-sm mt-1">
              Try adjusting your filters
            </p>
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-slate-600" />
          <h2 className="font-semibold text-slate-900 text-lg">
            Utilization Reports
          </h2>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-6 hover:shadow-xl transition-shadow">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Actions Logged</p>
            <p className="text-3xl font-semibold text-slate-900">
              {auditTotal}
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-6 hover:shadow-xl transition-shadow">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Requests Submitted</p>
            <p className="text-3xl font-semibold text-slate-900">{auditStats?.totalRequestsThisMonth ?? requestsSubmitted}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-6 hover:shadow-xl transition-shadow">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Approvals Made</p>
            <p className="text-3xl font-semibold text-slate-900">{approvalsMade}</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-6 hover:shadow-xl transition-shadow">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Average Turnaround</p>
            <p className="text-3xl font-semibold text-slate-900">{averageTurnaround}</p>
          </div>
        </div>

        {auditStats && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Requests by Ministry</p>
              <div className="space-y-4">
                {auditStats.requestsByMinistry.length > 0 ? auditStats.requestsByMinistry.map((ministry) => (
                  <div key={ministry.ministryId}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-slate-800">{ministry.ministryName}</span>
                      <span className="text-slate-500">{ministry.total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${Math.max(8, (ministry.total / Math.max(1, auditStats.totalRequestsThisMonth)) * 100)}%` }}
                      />
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No ministry activity yet.</p>
                )}
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Weekly Request Volume</p>
              <div className="space-y-4">
                {auditStats.weeklyRequestVolume.map((week) => (
                  <div key={week.weekStart}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-slate-800">{new Date(week.weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                      <span className="text-slate-500">{week.total}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.max(8, Math.min(100, week.total * 12))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Preview Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 text-lg">Activity Details</h3>
                <p className="text-sm text-slate-600 mt-0.5">Entry ID: {selectedEntry.id}</p>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    User
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{selectedEntry.user}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Timestamp
                  </p>
                  <p className="text-sm font-mono text-slate-900">{selectedEntry.timestamp}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Role</p>
                  <span
                    className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full border ${
                      selectedEntry.role === "Administrator"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : selectedEntry.role === "Approver"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    {selectedEntry.role}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Action Type</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedEntry.action}</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  Action Description
                </p>
                <p className="text-sm text-slate-900 bg-slate-50 p-3 rounded-lg">
                  {selectedEntry.details}
                </p>
              </div>

              {/* Full Details */}
              {selectedEntry.fullDetails && (
                <div className="border-t border-slate-200 pt-6">
                  <h4 className="text-sm font-semibold text-slate-900 mb-4">Technical Details</h4>
                  
                  <div className="space-y-4">
                    {selectedEntry.fullDetails.ipAddress && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Monitor className="w-3.5 h-3.5" />
                          IP Address
                        </p>
                        <p className="text-sm font-mono text-slate-900 bg-slate-50 px-3 py-2 rounded-lg inline-block">
                          {selectedEntry.fullDetails.ipAddress}
                        </p>
                      </div>
                    )}

                    {selectedEntry.fullDetails.userAgent && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">User Agent</p>
                        <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg break-all">
                          {selectedEntry.fullDetails.userAgent}
                        </p>
                      </div>
                    )}

                    {selectedEntry.fullDetails.requestIdRaw && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Request ID</p>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-mono text-slate-900">{selectedEntry.fullDetails.requestId ?? selectedEntry.fullDetails.requestIdRaw}</p>
                          <button
                            onClick={() => {
                              try {
                                void navigator.clipboard.writeText(selectedEntry.fullDetails.requestIdRaw || "");
                              } catch (err) {
                                console.error("Clipboard write failed", err);
                              }
                            }}
                            className="px-3 py-1 text-xs bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                          >
                            Copy
                          </button>
                        </div>

                        {selectedEntry.fullDetails.requestIdAltRaw && (
                          <div className="mt-2">
                            <p className="text-xs text-slate-500 mb-1">Alternate ID</p>
                            <div className="flex items-center gap-3">
                              <p className="text-xs font-mono text-slate-700">{selectedEntry.fullDetails.requestIdAlt ?? selectedEntry.fullDetails.requestIdAltRaw}</p>
                              <button
                                onClick={() => {
                                  try {
                                    void navigator.clipboard.writeText(selectedEntry.fullDetails.requestIdAltRaw || "");
                                  } catch (err) {
                                    console.error("Clipboard write failed", err);
                                  }
                                }}
                                className="px-2 py-0.5 text-xs bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedEntry.fullDetails.venue && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          Venue
                        </p>
                        <p className="text-sm font-semibold text-slate-900">{selectedEntry.fullDetails.venue}</p>
                      </div>
                    )}

                    {selectedEntry.fullDetails.previousValue && selectedEntry.fullDetails.newValue && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5" />
                          Value Change
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
                            <p className="text-xs text-rose-600 mb-1">Previous</p>
                            <p className="text-sm font-semibold text-rose-900">{selectedEntry.fullDetails.previousValue}</p>
                          </div>
                          <div className="text-slate-400">→</div>
                          <div className="flex-1 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                            <p className="text-xs text-emerald-600 mb-1">New</p>
                            <p className="text-sm font-semibold text-emerald-900">{selectedEntry.fullDetails.newValue}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedEntry.fullDetails.affectedUsers && selectedEntry.fullDetails.affectedUsers.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Affected Users</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedEntry.fullDetails.affectedUsers.map((user, index) => (
                            <span key={index} className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs">
                              {user}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedEntry.fullDetails.systemNotes && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">System Notes</p>
                        <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                          {selectedEntry.fullDetails.systemNotes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 sticky bottom-0">
              <button
                onClick={() => setSelectedEntry(null)}
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
