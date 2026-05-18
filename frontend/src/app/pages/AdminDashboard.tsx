import { useEffect, useMemo, useState } from "react";
import { Users, Building2, Brain, BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import api from "../../lib/api";
import { fetchVenues, type LiveVenue } from "../../lib/venues";

type ReportView = "weekly" | "monthly" | "yearly";

type LiveUserRow = {
  id: string;
  name: string;
  email: string;
  role: "REQUESTER" | "PARISH_SECRETARY" | "PARISH_PRIEST" | "ADMIN";
  lastSeen: string;
};

type AuditLogItem = {
  id: string;
  action: string;
  createdAt: string;
  performedBy?: {
    id: string;
    name: string;
    email: string;
    role: LiveUserRow["role"];
  } | null;
  venueRequest?: {
    id: string;
    startDateTime?: string;
    venue?: { name: string } | null;
    requester?: { name: string } | null;
    ministry?: { name: string } | null;
    status?: string;
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

type ChartRow = {
  label: string;
  requests: number;
  approved: number;
  rejected: number;
};

type DSSInsights = {
  peakDemand: {
    day: string;
    time: string;
    venue: string;
  };
  efficiency: {
    avgApprovalTime: string;
    approvalRate: string;
    trend: string;
  };
  recommendations: string[];
  risks: string[];
};

function formatRole(role: LiveUserRow["role"]): string {
  switch (role) {
    case "REQUESTER":
      return "Requester";
    case "PARISH_SECRETARY":
      return "Parish Secretary";
    case "PARISH_PRIEST":
      return "Parish Priest";
    case "ADMIN":
      return "Administrator";
    default:
      return role;
  }
}

function getDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getActionBucket(action: string): "requests" | "approved" | "rejected" {
  if (action === "REQUEST_CREATED") {
    return "requests";
  }
  if (action === "REQUEST_APPROVED") {
    return "approved";
  }
  return "rejected";
}

function buildReportRows(logs: AuditLogItem[], view: ReportView): ChartRow[] {
  const buckets =
    view === "weekly"
      ? Array.from({ length: 7 }, (_, index) => {
          const start = new Date();
          const currentDay = start.getDay();
          const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
          start.setDate(start.getDate() + mondayOffset + index);
          start.setHours(0, 0, 0, 0);
          const end = new Date(start);
          end.setDate(start.getDate() + 1);
          return { label: start.toLocaleDateString("en-US", { weekday: "short" }), start, end };
        })
      : view === "monthly"
      ? Array.from({ length: 4 }, (_, index) => {
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const start = new Date(monthStart);
          start.setDate(1 + index * 7);
          start.setHours(0, 0, 0, 0);
          const end = new Date(now.getFullYear(), now.getMonth(), 1 + (index + 1) * 7);
          end.setHours(0, 0, 0, 0);
          if (index === 3) {
            end.setMonth(end.getMonth() + 1, 1);
          }
          return { label: `Week ${index + 1}`, start, end };
        })
      : Array.from({ length: 12 }, (_, index) => {
          const now = new Date();
          const start = new Date(now.getFullYear(), index, 1);
          const end = new Date(now.getFullYear(), index + 1, 1);
          return {
            label: start.toLocaleDateString("en-US", { month: "short" }),
            start,
            end,
          };
        });

  return buckets.map((bucket) => {
    const counts = { requests: 0, approved: 0, rejected: 0 };

    for (const log of logs) {
      const createdAt = new Date(log.createdAt);
      if (createdAt < bucket.start || createdAt >= bucket.end) {
        continue;
      }

      const mappedBucket = getActionBucket(log.action);
      counts[mappedBucket] += 1;
    }

    return {
      label: bucket.label,
      ...counts,
    };
  });
}

function buildLiveUsers(logs: AuditLogItem[]): LiveUserRow[] {
  const users = new Map<string, LiveUserRow>();

  for (const log of logs) {
    const actor = log.performedBy;
    if (!actor) {
      continue;
    }

    const existing = users.get(actor.id);
    if (!existing || new Date(log.createdAt).getTime() > new Date(existing.lastSeen).getTime()) {
      users.set(actor.id, {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: actor.role,
        lastSeen: log.createdAt,
      });
    }
  }

  return Array.from(users.values()).sort((left, right) => new Date(right.lastSeen).getTime() - new Date(left.lastSeen).getTime());
}

function getTopVenueName(logs: AuditLogItem[]): string {
  const counts = new Map<string, number>();

  for (const log of logs) {
    const venueName = log.venueRequest?.venue?.name;
    if (!venueName) {
      continue;
    }

    counts.set(venueName, (counts.get(venueName) ?? 0) + 1);
  }

  const topVenue = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0];
  return topVenue?.[0] ?? "Main Chapel";
}

function getBusiestDay(logs: AuditLogItem[]): string {
  const counts = new Map<string, number>();
  const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (const log of logs) {
    const requestDate = log.venueRequest?.startDateTime;
    if (!requestDate) {
      continue;
    }

    const day = labels[new Date(requestDate).getDay()];
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const busiest = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0];
  return busiest?.[0] ?? "Sunday";
}

function getBusiestTimeWindow(logs: AuditLogItem[]): string {
  const counts = new Map<number, number>();

  for (const log of logs) {
    const requestDate = log.venueRequest?.startDateTime;
    if (!requestDate) {
      continue;
    }

    const hour = new Date(requestDate).getHours();
    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }

  const busiestHour = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 10;
  const startHour = busiestHour % 12 === 0 ? 12 : busiestHour % 12;
  const suffix = busiestHour >= 12 ? "PM" : "AM";
  const nextHour = (busiestHour + 1) % 24;
  const endHour = nextHour % 12 === 0 ? 12 : nextHour % 12;
  const endSuffix = nextHour >= 12 ? "PM" : "AM";
  return `${startHour}:00 ${suffix} - ${endHour}:00 ${endSuffix}`;
}

function buildInsights(stats: AuditStats | null, logs: AuditLogItem[]): DSSInsights {
  const topVenue = getTopVenueName(logs);
  const busiestDay = getBusiestDay(logs);
  const busiestTime = getBusiestTimeWindow(logs);
  const approvalRate = stats ? Math.max(0, 100 - stats.rejectionRate) : 0;
  const topMinistry = stats?.requestsByMinistry?.[0];

  const recommendations = [
    stats && stats.averageApprovalTimeHours > 6
      ? `Average approval time is ${stats.averageApprovalTimeHours.toFixed(1)} hours. Consider redistributing approvals.`
      : "Approval turnaround is within the normal operating window.",
    topMinistry
      ? `${topMinistry.ministryName} has the highest request volume (${topMinistry.total} requests).`
      : "Request volume is currently distributed across ministries.",
    `Busiest venue: ${topVenue}. Consider keeping a closer watch on its booking cadence.`,
  ];

  const risks = [
    stats && stats.totalConflictsDetected > 0
      ? `${stats.totalConflictsDetected} scheduling conflict(s) detected in the current dataset.`
      : "No scheduling conflicts detected in the current dataset.",
    stats && stats.rejectionRate > 20
      ? `Rejection rate is ${stats.rejectionRate.toFixed(1)}%. Review request quality and venue allocation rules.`
      : "Rejection rate remains within a manageable range.",
  ];

  return {
    peakDemand: {
      day: busiestDay,
      time: busiestTime,
      venue: topVenue,
    },
    efficiency: {
      avgApprovalTime: stats ? `${stats.averageApprovalTimeHours.toFixed(1)} hours` : "N/A",
      approvalRate: `${approvalRate.toFixed(0)}%`,
      trend: stats && stats.averageApprovalTimeHours <= 6 && stats.rejectionRate < 20 ? "improving" : "under review",
    },
    recommendations,
    risks,
  };
}

export function AdminDashboard() {
  const [reportView, setReportView] = useState<ReportView>("weekly");
  const [venues, setVenues] = useState<LiveVenue[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [venuesError, setVenuesError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [venueDraft, setVenueDraft] = useState({
    name: "",
    description: "",
    capacity: "",
    status: "ACTIVE" as LiveVenue["status"],
  });
  const [savingVenueId, setSavingVenueId] = useState<string | null>(null);
  const [venueSaveMessage, setVenueSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setVenuesLoading(true);
      setAnalyticsLoading(true);
      setVenuesError(null);
      setAnalyticsError(null);

      const [liveVenuesResult, auditStatsResult, auditLogsResult] = await Promise.allSettled([
        fetchVenues(),
        api.get<AuditStats>("/audit/stats"),
        api.get<AuditLogsResponse>("/audit"),
      ]);

      if (!isMounted) {
        return;
      }

      if (liveVenuesResult.status === "fulfilled") {
        setVenues(liveVenuesResult.value);
        setSelectedVenueId((currentSelectedVenueId) => {
          if (currentSelectedVenueId && liveVenuesResult.value.some((venue) => venue.id === currentSelectedVenueId)) {
            return currentSelectedVenueId;
          }

          return liveVenuesResult.value[0]?.id ?? null;
        });
      } else {
        console.error("Failed to load venue data:", liveVenuesResult.reason);
        setVenues([]);
        setVenuesError("Unable to load venue data right now.");
      }

      if (auditStatsResult.status === "fulfilled") {
        setAuditStats(auditStatsResult.value);
      } else {
        console.error("Failed to load audit stats:", auditStatsResult.reason);
        setAuditStats(null);
      }

      if (auditLogsResult.status === "fulfilled") {
        setAuditLogs(auditLogsResult.value.data.items ?? []);
      } else {
        console.error("Failed to load audit logs:", auditLogsResult.reason);
        setAuditLogs([]);
      }

      if (auditStatsResult.status === "rejected" || auditLogsResult.status === "rejected") {
        setAnalyticsError("Unable to load dashboard analytics right now.");
      }

      setVenuesLoading(false);
      setAnalyticsLoading(false);
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const liveUsers = useMemo(() => buildLiveUsers(auditLogs), [auditLogs]);
  const reportData = useMemo(() => buildReportRows(auditLogs, reportView), [auditLogs, reportView]);
  const insights = useMemo(() => buildInsights(auditStats, auditLogs), [auditStats, auditLogs]);
  const requestsThisMonth = auditStats?.totalRequestsThisMonth ?? reportData.reduce((sum, row) => sum + row.requests, 0);
  const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? null;

  useEffect(() => {
    if (!selectedVenue) {
      return;
    }

    setVenueDraft({
      name: selectedVenue.name,
      description: selectedVenue.description ?? "",
      capacity: String(selectedVenue.capacity),
      status: selectedVenue.status,
    });
  }, [selectedVenue]);

  const startEditingVenue = (venue: LiveVenue) => {
    setSelectedVenueId(venue.id);
    setVenueDraft({
      name: venue.name,
      description: venue.description ?? "",
      capacity: String(venue.capacity),
      status: venue.status,
    });
    setVenueSaveMessage(null);
  };

  const saveVenueChanges = async () => {
    if (!selectedVenueId) {
      return;
    }

    setSavingVenueId(selectedVenueId);
    setVenueSaveMessage(null);

    try {
      const updatedVenue = await api.put<{ venue: LiveVenue }>(`/venues/${selectedVenueId}`, {
        name: venueDraft.name.trim(),
        description: venueDraft.description.trim() || null,
        capacity: Number(venueDraft.capacity),
        status: venueDraft.status,
      });

      setVenues((current) => current.map((venue) => (venue.id === selectedVenueId ? updatedVenue.venue : venue)));
      setVenueSaveMessage("Venue updated successfully.");
    } catch (error) {
      console.error("Failed to save venue:", error);
      setVenueSaveMessage("Unable to save venue changes right now.");
    } finally {
      setSavingVenueId(null);
    }
  };

  const statusStyles: Record<LiveVenue["status"], string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    INACTIVE: "bg-slate-100 text-slate-700 border-slate-200",
    MAINTENANCE: "bg-amber-50 text-amber-700 border-amber-200",
  };

  const getXAxisKey = () => "label";

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-semibold text-slate-900 mb-3 tracking-tight">
          Administrator Dashboard
        </h1>
        <p className="text-lg text-slate-600">
          Live request analytics, users, venues, and DSS signals
        </p>
      </div>

      {analyticsError && (
        <div className="mb-8 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {analyticsError}
        </div>
      )}

      <div className="mb-10">
        <div className="bg-gradient-to-br from-indigo-50 via-blue-100/40 to-indigo-50 border-2 border-indigo-300 rounded-2xl shadow-xl shadow-slate-900/10 p-8">
          <div className="flex items-start gap-5">
            <div className="p-4 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg shadow-indigo-500/40">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 text-2xl mb-4">
                Decision Support System - System Insights
              </h3>

              <div className="grid grid-cols-3 gap-5 mb-6">
                <div className="bg-white rounded-xl p-5 border-2 border-indigo-200 shadow-lg shadow-indigo-900/10">
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    Peak Demand
                  </p>
                  <p className="text-sm text-slate-900 mb-1.5 font-medium">
                    <span className="font-bold">{insights.peakDemand.day}</span> • {insights.peakDemand.time}
                  </p>
                  <p className="text-xs text-slate-600 font-medium">{insights.peakDemand.venue}</p>
                </div>

                <div className="bg-white rounded-xl p-5 border-2 border-indigo-200 shadow-lg shadow-indigo-900/10">
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    System Efficiency
                  </p>
                  <p className="text-sm text-slate-900 mb-1.5 font-medium">
                    Approval: <span className="font-bold">{insights.efficiency.avgApprovalTime}</span>
                  </p>
                  <p className="text-xs text-slate-600 font-medium">Rate: {insights.efficiency.approvalRate}</p>
                </div>

                <div className="bg-white rounded-xl p-5 border-2 border-indigo-200 shadow-lg shadow-indigo-900/10">
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3">System Status</p>
                  <div className="flex items-center gap-2 mb-1.5">
                    {insights.efficiency.trend === "improving" ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    )}
                    <span className="text-sm font-bold text-slate-900">
                      {insights.efficiency.trend === "improving" ? "All Systems Operational" : "Review Recommended"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">Trend: {insights.efficiency.trend}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Recommendations
                  </h4>
                  <ul className="space-y-1.5">
                    {insights.recommendations.map((rec, index) => (
                      <li key={index} className="text-xs text-slate-700 flex items-start gap-2">
                        <span className="text-emerald-600 mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Attention Required
                  </h4>
                  <ul className="space-y-1.5">
                    {insights.risks.map((risk, index) => (
                      <li key={index} className="text-xs text-slate-700 flex items-start gap-2">
                        <span className="text-amber-600 mt-0.5">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="mt-5 text-xs text-slate-500">
                Live request count this month: <span className="font-semibold text-slate-700">{requestsThisMonth}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-10">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-xl">Booking Request Analytics</h2>
                <p className="text-sm text-slate-600 mt-0.5">Track booking trends over time</p>
              </div>
            </div>

            <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl">
              <button
                onClick={() => setReportView("weekly")}
                className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  reportView === "weekly"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30"
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setReportView("monthly")}
                className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  reportView === "monthly"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30"
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setReportView("yearly")}
                className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  reportView === "yearly"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30"
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                Yearly
              </button>
            </div>
          </div>

          <div className="p-8">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={reportData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey={getXAxisKey()} stroke="#64748b" style={{ fontSize: "12px" }} />
                <YAxis stroke="#64748b" style={{ fontSize: "12px" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="requests" fill="#3b82f6" name="Total Requests" radius={[4, 4, 0, 0]} />
                <Bar dataKey="approved" fill="#10b981" name="Approved" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejected" fill="#ef4444" name="Rejected" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mb-10">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-purple-50/30 border-b border-slate-200 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 text-xl">User Management</h2>
              <p className="text-sm text-slate-600 mt-0.5">Live actors from recent audit activity</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {liveUsers.length > 0 ? (
                  liveUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5 text-sm font-semibold text-slate-900">{user.id}</td>
                      <td className="px-6 py-5 text-sm font-semibold text-slate-900">{user.name}</td>
                      <td className="px-6 py-5 text-sm text-slate-700">{user.email}</td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center px-4 py-1.5 text-xs font-bold rounded-full border ${
                            user.role === "ADMIN"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : user.role === "PARISH_PRIEST"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : user.role === "PARISH_SECRETARY"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {formatRole(user.role)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-6 py-8 text-sm text-slate-500" colSpan={4}>
                      {analyticsLoading ? "Loading live users..." : "No recent audit activity available."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-emerald-50/30 border-b border-slate-200 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Building2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 text-xl">Venue Management</h2>
              <p className="text-sm text-slate-600 mt-0.5">Configured venue facilities from live data</p>
            </div>
          </div>

          {venuesLoading ? (
            <div className="p-8 text-sm text-slate-600">Loading venue data...</div>
          ) : venuesError ? (
            <div className="p-8 text-sm text-rose-700">{venuesError}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Venue Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Capacity</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {venues.map((venue) => (
                    <tr key={venue.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5 text-sm font-semibold text-slate-900">{venue.id}</td>
                      <td className="px-6 py-5 text-sm font-semibold text-slate-900">{venue.name}</td>
                      <td className="px-6 py-5 text-sm text-slate-700">{venue.capacity} people</td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-4 py-1.5 text-xs font-bold rounded-full border ${statusStyles[venue.status]}`}>
                          {venue.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-700">
                        <button
                          type="button"
                          onClick={() => startEditingVenue(venue)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedVenue && (
        <div className="mb-10 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 p-8">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-semibold text-slate-900 text-xl">Edit Venue</h2>
              <p className="text-sm text-slate-600 mt-0.5">Update the selected venue details and status.</p>
            </div>
            <span className={`inline-flex items-center px-4 py-1.5 text-xs font-bold rounded-full border ${statusStyles[selectedVenue.status]}`}>
              {selectedVenue.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Venue Name</label>
              <input
                value={venueDraft.name}
                onChange={(e) => setVenueDraft((current) => ({ ...current, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Capacity</label>
              <input
                type="number"
                min={1}
                value={venueDraft.capacity}
                onChange={(e) => setVenueDraft((current) => ({ ...current, capacity: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
              <textarea
                rows={4}
                value={venueDraft.description}
                onChange={(e) => setVenueDraft((current) => ({ ...current, description: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
              <select
                value={venueDraft.status}
                onChange={(e) => setVenueDraft((current) => ({ ...current, status: e.target.value as LiveVenue["status"] }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>

            <div className="flex items-end justify-end gap-3">
              <button
                type="button"
                onClick={saveVenueChanges}
                disabled={savingVenueId === selectedVenue.id}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                {savingVenueId === selectedVenue.id ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {venueSaveMessage && (
            <p className="mt-4 text-sm text-slate-600" role="status">
              {venueSaveMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
