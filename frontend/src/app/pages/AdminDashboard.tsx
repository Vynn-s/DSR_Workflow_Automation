import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Users, Building2, Brain, BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Clock, Edit2, Plus, X, KeyRound, Save, Trash2, Sparkles } from "lucide-react";
import api from "../../lib/api";
import { fetchVenues, type LiveVenue } from "../../lib/venues";
import { useAuth } from "../../context/AuthContext";
import { AnimatedNumber, PageHeader, SkeletonRows } from "../components/ui/page";

type ReportView = "weekly" | "monthly" | "yearly";

type LiveUserRow = {
  id: string;
  name: string;
  email: string;
  role: "REQUESTER" | "PARISH_SECRETARY" | "PARISH_PRIEST" | "ADMIN";
  lastSeen: string;
};

type UserRoleOption = "REQUESTER" | "PARISH_SECRETARY" | "ADMIN";

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: LiveUserRow["role"];
  ministryId?: string | null;
  ministryName?: string | null;
  createdAt: string;
  updatedAt: string;
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
  totalApprovedRequests: number;
  totalRejectedRequests: number;
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

type AdminUsersResponse = {
  users: AdminUserRow[];
};

type MinistryOption = {
  id: string;
  name: string;
};

type MinistriesResponse = {
  ministries: MinistryOption[];
};

type CreateAdminUserResponse = {
  user: AdminUserRow;
  temporaryPassword: string;
};

type CreateVenueResponse = {
  venue: LiveVenue;
};

type DeleteVenueResponse = {
  venueId: string;
};

type DeleteAdminUserResponse = {
  userId: string;
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
  busiestWindow: string;
  efficiency: {
    avgApprovalTime: string;
    approvalRate: string;
    trend: string;
  };
  bookingPatterns: {
    topEventType: string;
    topMinistry: string;
    topVenue: string;
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
    case "ADMIN":
      return "Administrator";
    default:
      return role;
  }
}

function normalizeRoleOption(role: LiveUserRow["role"]): UserRoleOption {
  return role === "PARISH_PRIEST" ? "ADMIN" : role;
}

function getDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getReportWindow(view: ReportView) {
  const now = new Date();

  if (view === "weekly") {
    const start = new Date(now);
    const currentDay = start.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    start.setDate(start.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }

  if (view === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }

  const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear() + 1, 0, 1, 0, 0, 0, 0);

  return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

function getActionBucket(action: string): "requests" | "approved" | "rejected" | null {
  // Only map explicit request lifecycle actions. Ignore unrelated audit events.
  if (action === "REQUEST_CREATED") {
    return "requests";
  }
  if (action === "REQUEST_APPROVED") {
    return "approved";
  }
  if (action === "REQUEST_REJECTED") {
    return "rejected";
  }

  return null;
}

function isVisibleAuditAction(action: string): boolean {
  return action !== "DSS_EVALUATION";
}

function getRequestLabel(log: AuditLogItem): string | null {
  const eventName = log.venueRequest?.eventName?.trim();
  if (eventName) {
    return eventName;
  }

  const purpose = log.venueRequest?.purpose?.trim();
  return purpose || null;
}

function getTopCountLabel<T>(items: T[], getLabel: (item: T) => string | null | undefined, fallback: string): { label: string; total: number } {
  const counts = new Map<string, number>();

  for (const item of items) {
    const label = getLabel(item)?.trim();
    if (!label) {
      continue;
    }

    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const top = Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
  return top ? { label: top[0], total: top[1] } : { label: fallback, total: 0 };
}

function getPeakBookingWindow(logs: AuditLogItem[]) {
  const counts = new Map<string, number>();

  for (const log of logs) {
    const requestStart = log.venueRequest?.startDateTime;
    if (!requestStart) {
      continue;
    }

    const date = new Date(requestStart);
    const day = date.toLocaleDateString("en-US", { weekday: "long" });
    const hour = date.getHours();
    const hourLabel = `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour >= 12 ? "PM" : "AM"}`;
    const window = `${day} • ${hourLabel}`;
    counts.set(window, (counts.get(window) ?? 0) + 1);
  }

  const top = Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
  return top?.[0] ?? "No bookings yet";
}

function buildReportRows(logs: AuditLogItem[], view: ReportView): ChartRow[] {
  const visibleLogs = logs.filter((log) => isVisibleAuditAction(log.action));
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

    for (const log of visibleLogs) {
      const createdAt = new Date(log.createdAt);
      if (createdAt < bucket.start || createdAt >= bucket.end) {
        continue;
      }

      const mappedBucket = getActionBucket(log.action);
      if (!mappedBucket) continue;

      counts[mappedBucket] += 1;
    }

    return {
      label: bucket.label,
      ...counts,
    };
  });
}

async function fetchAuditLogs(window?: { dateFrom: string; dateTo: string }): Promise<AuditLogItem[]> {
  const limit = 100;
  const firstPage = await api.get<AuditLogsResponse>("/audit", {
    params: {
      limit: String(limit),
      page: "1",
      ...(window ?? {}),
    },
  });

  const items = [...(firstPage.data.items ?? [])];
  const totalPages = Math.max(1, firstPage.data.totalPages ?? 1);
  const cappedPages = Math.min(totalPages, 10);

  for (let page = 2; page <= cappedPages; page += 1) {
    const response = await api.get<AuditLogsResponse>("/audit", {
      params: {
        limit: String(limit),
        page: String(page),
        ...(window ?? {}),
      },
    });
    items.push(...(response.data.items ?? []));
  }

  return items;
}

function getTopVenueName(logs: AuditLogItem[]): string {
  return getTopCountLabel(logs, (log) => log.venueRequest?.venue?.name ?? null, "Mezzanine Hall A").label;
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

  const busiestHour = Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ?? 10;
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
  const peakWindow = getPeakBookingWindow(logs);
  const topEventType = getTopCountLabel(logs, getRequestLabel, "No event data available");
  const topMinistry = getTopCountLabel(logs, (log) => log.venueRequest?.ministry?.name ?? null, "No ministry data available");
  const topVenueCount = getTopCountLabel(logs, (log) => log.venueRequest?.venue?.name ?? null, "No venue data available");
  const approvalRate = stats ? Math.max(0, 100 - stats.rejectionRate) : 0;
  const topMinistryStat = stats?.requestsByMinistry?.[0];

  const recommendations = [
    peakWindow !== "No bookings yet"
      ? `Peak booking demand is concentrated on ${peakWindow}. Watch staffing and approvals around that window.`
      : "No live booking pattern data is available yet.",
    topEventType.total > 0
      ? `Most frequently booked event type: ${topEventType.label} (${topEventType.total} requests).`
      : "No event type trends are available yet.",
    topVenueCount.total > 0
      ? `Most booked venue: ${topVenueCount.label} (${topVenueCount.total} requests).`
      : `Busiest venue observed: ${topVenue}.`,
    topMinistry.total > 0
      ? `Most active ministry in the logs: ${topMinistry.label} (${topMinistry.total} requests).`
      : topMinistryStat
        ? `${topMinistryStat.ministryName} has the highest request volume (${topMinistryStat.total} requests).`
        : "Ministry demand is currently distributed across the live records.",
  ];

  const risks = [
    stats && stats.totalConflictsDetected > 0
      ? `${stats.totalConflictsDetected} scheduling conflict(s) detected in the live dataset.`
      : "No scheduling conflicts detected in the live dataset.",
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
    busiestWindow: peakWindow,
    efficiency: {
      avgApprovalTime: stats ? `${stats.averageApprovalTimeHours.toFixed(1)} hours` : "N/A",
      approvalRate: `${approvalRate.toFixed(0)}%`,
      trend: stats && stats.averageApprovalTimeHours <= 6 && stats.rejectionRate < 20 ? "improving" : "under review",
    },
    bookingPatterns: {
      topEventType: topEventType.total > 0 ? `${topEventType.label} (${topEventType.total})` : "No event data available",
      topMinistry: topMinistry.total > 0 ? `${topMinistry.label} (${topMinistry.total})` : topMinistryStat ? `${topMinistryStat.ministryName} (${topMinistryStat.total})` : "No ministry data available",
      topVenue: topVenueCount.total > 0 ? `${topVenueCount.label} (${topVenueCount.total})` : topVenue,
    },
    recommendations,
    risks,
  };
}

export function AdminDashboard() {
  const { isLoading: isAuthLoading } = useAuth();
  const [reportView, setReportView] = useState<ReportView>("weekly");
  const [usersTab, setUsersTab] = useState<"activity" | "manage">("activity");
  const [venues, setVenues] = useState<LiveVenue[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [ministries, setMinistries] = useState<MinistryOption[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [adminUsersLoading, setAdminUsersLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [venuesError, setVenuesError] = useState<string | null>(null);
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null);
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
  const [venueSaveMessageType, setVenueSaveMessageType] = useState<"success" | "error" | null>(null);
  const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
  const [isCreateVenueModalOpen, setIsCreateVenueModalOpen] = useState(false);
  const [newVenueDraft, setNewVenueDraft] = useState({
    name: "",
    description: "",
    capacity: "",
    status: "ACTIVE" as LiveVenue["status"],
  });
  const [creatingVenue, setCreatingVenue] = useState(false);
  const [venueCreateMessage, setVenueCreateMessage] = useState<string | null>(null);
  const [venueCreateMessageType, setVenueCreateMessageType] = useState<"success" | "error" | null>(null);
  const [deleteVenueTarget, setDeleteVenueTarget] = useState<LiveVenue | null>(null);
  const [deleteVenuePassword, setDeleteVenuePassword] = useState("");
  const [deletingVenueId, setDeletingVenueId] = useState<string | null>(null);
  const [venueDeleteMessage, setVenueDeleteMessage] = useState<string | null>(null);
  const [venueDeleteMessageType, setVenueDeleteMessageType] = useState<"success" | "error" | null>(null);
  const [newUserDraft, setNewUserDraft] = useState({
    email: "",
    name: "",
    role: "REQUESTER" as UserRoleOption,
    ministryId: "",
    temporaryPassword: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [userCreateMessage, setUserCreateMessage] = useState<string | null>(null);
  const [userCreateMessageType, setUserCreateMessageType] = useState<"success" | "error" | null>(null);
  const [savingUserRoleId, setSavingUserRoleId] = useState<string | null>(null);
  const [userRoleDrafts, setUserRoleDrafts] = useState<Record<string, UserRoleOption>>({});
  const [savingUserMinistryId, setSavingUserMinistryId] = useState<string | null>(null);
  const [userMinistryDrafts, setUserMinistryDrafts] = useState<Record<string, string>>({});
  const [deleteTargetUser, setDeleteTargetUser] = useState<AdminUserRow | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userDeleteMessage, setUserDeleteMessage] = useState<string | null>(null);
  const [userDeleteMessageType, setUserDeleteMessageType] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    document.title = "Admin Dashboard — CathedralFlow";

    if (isAuthLoading) {
      return;
    }

    let isMounted = true;

    async function loadDashboard() {
      setVenuesLoading(true);
      setAdminUsersLoading(true);
      setAnalyticsLoading(true);
      setVenuesError(null);
      setAdminUsersError(null);
      setAnalyticsError(null);

      const window = getReportWindow(reportView);

      const [liveVenuesResult, adminUsersResult, ministriesResult, auditStatsResult, auditLogsResult] = await Promise.allSettled([
        fetchVenues(),
        api.get<AdminUsersResponse>("/admin/users"),
        api.get<MinistriesResponse>("/admin/ministries"),
        api.get<AuditStats>("/audit/stats", { params: window }),
        fetchAuditLogs(window),
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
        console.warn("Failed to load venue data");
        setVenues([]);
        setVenuesError("Unable to load venue data right now.");
      }

      if (adminUsersResult.status === "fulfilled") {
        setAdminUsers(adminUsersResult.value.users ?? []);
        setUserRoleDrafts(
          Object.fromEntries(
            (adminUsersResult.value.users ?? []).map((user) => [user.id, normalizeRoleOption(user.role)])
          )
        );
        setUserMinistryDrafts(
          Object.fromEntries(
            (adminUsersResult.value.users ?? []).map((user) => [user.id, user.ministryId ?? ""])
          )
        );
      } else {
        console.warn("Failed to load admin users");
        setAdminUsers([]);
        setAdminUsersError("Unable to load admin users right now.");
      }

      if (ministriesResult.status === "fulfilled") {
        setMinistries(ministriesResult.value.ministries ?? []);
      } else {
        console.warn("Failed to load ministries");
        setMinistries([]);
      }

      if (auditStatsResult.status === "fulfilled") {
        setAuditStats(auditStatsResult.value);
      } else {
        console.warn("Failed to load audit stats");
        setAuditStats(null);
      }

      if (auditLogsResult.status === "fulfilled") {
        setAuditLogs(auditLogsResult.value);
      } else {
        console.warn("Failed to load audit logs");
        setAuditLogs([]);
      }

      if (auditStatsResult.status === "rejected" || auditLogsResult.status === "rejected") {
        setAnalyticsError("Unable to load dashboard analytics right now.");
      }

      setVenuesLoading(false);
      setAdminUsersLoading(false);
      setAnalyticsLoading(false);
    }

    void loadDashboard();

    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") {
        void loadDashboard();
      }
    };

    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadDashboard();
      }
    }, 30000);

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [isAuthLoading, reportView]);

  const activityUsers = useMemo(() => adminUsers, [adminUsers]);
  const visibleAuditLogs = useMemo(() => auditLogs.filter((log) => isVisibleAuditAction(log.action)), [auditLogs]);
  const reportData = useMemo(() => buildReportRows(visibleAuditLogs, reportView), [visibleAuditLogs, reportView]);
  const insights = useMemo(() => buildInsights(auditStats, visibleAuditLogs), [auditStats, visibleAuditLogs]);
  const requestsThisMonth = auditStats?.totalRequestsThisMonth ?? 0;
  const approvedRequestsThisPeriod = auditStats?.totalApprovedRequests ?? 0;
  const rejectedRequestsThisPeriod = auditStats?.totalRejectedRequests ?? 0;
  const venueStatusCounts = useMemo(() => {
    return venues.reduce(
      (counts, venue) => {
        counts[venue.status] += 1;
        return counts;
      },
      { ACTIVE: 0, INACTIVE: 0, MAINTENANCE: 0 } as Record<LiveVenue["status"], number>,
    );
  }, [venues]);
  const userRoleCounts = useMemo(() => {
    return adminUsers.reduce(
      (counts, user) => {
        counts[normalizeRoleOption(user.role)] += 1;
        return counts;
      },
      { REQUESTER: 0, PARISH_SECRETARY: 0, ADMIN: 0 } as Record<UserRoleOption, number>,
    );
  }, [adminUsers]);
  const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? null;
  const pendingQueuePreview = visibleAuditLogs.filter((log) => {
    const status = log.venueRequest?.status;
    return status === "PENDING" || status === "SECRETARY_REVIEW" || status === "PRIEST_REVIEW";
  });

  const startEditingVenue = (venue: LiveVenue) => {
    setSelectedVenueId(venue.id);
    setVenueDraft({
      name: venue.name,
      description: venue.description ?? "",
      capacity: String(venue.capacity),
      status: venue.status,
    });
    setVenueSaveMessage(null);
    setVenueSaveMessageType(null);
    setIsVenueModalOpen(true);
  };

  const closeVenueModal = () => {
    setIsVenueModalOpen(false);
    setVenueSaveMessage(null);
    setVenueSaveMessageType(null);
  };

  const saveVenueChanges = async () => {
    if (!selectedVenueId) {
      return;
    }

    setSavingVenueId(selectedVenueId);
    setVenueSaveMessage(null);
    setVenueSaveMessageType(null);

    try {
      const updatedVenue = await api.put<{ venue: LiveVenue }>(`/venues/${encodeURIComponent(selectedVenueId)}`, {
        name: venueDraft.name.trim(),
        description: venueDraft.description.trim() || null,
        capacity: Number(venueDraft.capacity),
        status: venueDraft.status,
      });

      setVenues((current) => current.map((venue) => (venue.id === selectedVenueId ? updatedVenue.venue : venue)));
      setVenueSaveMessage(`Venue updated successfully at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`);
      setVenueSaveMessageType("success");
      toast.success("Venue updated");
      closeVenueModal();
    } catch (error) {
      console.warn("Failed to save venue");
      setVenueSaveMessage("Unable to save venue changes right now.");
      setVenueSaveMessageType("error");
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSavingVenueId(null);
    }
  };

  const startCreatingVenue = () => {
    setNewVenueDraft({
      name: "",
      description: "",
      capacity: "",
      status: "ACTIVE",
    });
    setVenueCreateMessage(null);
    setVenueCreateMessageType(null);
    setIsCreateVenueModalOpen(true);
  };

  const closeCreateVenueModal = () => {
    setIsCreateVenueModalOpen(false);
    setVenueCreateMessage(null);
    setVenueCreateMessageType(null);
  };

  const createVenue = async () => {
    if (!newVenueDraft.name.trim() || !newVenueDraft.capacity.trim()) {
      setVenueCreateMessage("Venue name and capacity are required.");
      setVenueCreateMessageType("error");
      return;
    }

    setCreatingVenue(true);
    setVenueCreateMessage(null);
    setVenueCreateMessageType(null);

    try {
      const response = await api.post<CreateVenueResponse>("/venues", {
        name: newVenueDraft.name.trim(),
        description: newVenueDraft.description.trim() || null,
        capacity: Number(newVenueDraft.capacity),
        status: newVenueDraft.status,
      });

      setVenues((current) => [...current, response.venue].sort((left, right) => left.name.localeCompare(right.name)));
      setSelectedVenueId(response.venue.id);
      setVenueCreateMessage(`Venue created successfully: ${response.venue.name}.`);
      setVenueCreateMessageType("success");
      toast.success("Venue created");
      setNewVenueDraft({
        name: "",
        description: "",
        capacity: "",
        status: "ACTIVE",
      });
      setIsCreateVenueModalOpen(false);
    } catch (error) {
      console.warn("Failed to create venue");
      setVenueCreateMessage("Unable to create venue right now.");
      setVenueCreateMessageType("error");
      toast.error("Something went wrong. Please try again.");
    } finally {
      setCreatingVenue(false);
    }
  };

  const startDeleteVenue = (venue: LiveVenue) => {
    setDeleteVenueTarget(venue);
    setDeleteVenuePassword("");
    setVenueDeleteMessage(null);
    setVenueDeleteMessageType(null);
  };

  const closeDeleteVenueModal = () => {
    setDeleteVenueTarget(null);
    setDeleteVenuePassword("");
  };

  const confirmDeleteVenue = async () => {
    if (!deleteVenueTarget) {
      return;
    }

    if (!deleteVenuePassword.trim()) {
      setVenueDeleteMessage("Password is required before deleting a venue.");
      setVenueDeleteMessageType("error");
      return;
    }

    setDeletingVenueId(deleteVenueTarget.id);
    setVenueDeleteMessage(null);
    setVenueDeleteMessageType(null);

    try {
      await api.delete<DeleteVenueResponse>(`/venues/${encodeURIComponent(deleteVenueTarget.id)}`, {
        data: { password: deleteVenuePassword },
      });

      setVenues((current) => {
        const remainingVenues = current.filter((venue) => venue.id !== deleteVenueTarget.id);
        setSelectedVenueId((currentSelected) => {
          if (currentSelected !== deleteVenueTarget.id) {
            return currentSelected;
          }

          return remainingVenues[0]?.id ?? null;
        });

        return remainingVenues;
      });

      setVenueDeleteMessage(`Venue deleted successfully: ${deleteVenueTarget.name}.`);
      setVenueDeleteMessageType("success");
      closeDeleteVenueModal();
    } catch (error) {
      console.warn("Failed to delete venue");
      const apiMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message === "string"
          ? (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
          : null;

      setVenueDeleteMessage(apiMessage ?? "Unable to delete venue right now.");
      setVenueDeleteMessageType("error");
    } finally {
      setDeletingVenueId(null);
    }
  };

  const createAdminUser = async () => {
    if (!newUserDraft.email.trim() || !newUserDraft.name.trim()) {
      setUserCreateMessage("Email and name are required.");
      setUserCreateMessageType("error");
      return;
    }

    setCreatingUser(true);
    setUserCreateMessage(null);
    setUserCreateMessageType(null);

    try {
      const response = await api.post<CreateAdminUserResponse>("/admin/users", {
        email: newUserDraft.email.trim(),
        name: newUserDraft.name.trim(),
        role: newUserDraft.role,
        ministryId: newUserDraft.ministryId.trim() || null,
        temporaryPassword: newUserDraft.temporaryPassword.trim() || undefined,
      });

      setAdminUsers((current) => [response.user, ...current]);
      setUserRoleDrafts((current) => ({ ...current, [response.user.id]: normalizeRoleOption(response.user.role) }));
      setUserMinistryDrafts((current) => ({ ...current, [response.user.id]: response.user.ministryId ?? "" }));
      setNewUserDraft({
        email: "",
        name: "",
        role: "REQUESTER",
        ministryId: "",
        temporaryPassword: "",
      });
      setUserCreateMessage(
        `User created successfully. Temporary password: ${response.temporaryPassword}`,
      );
      setUserCreateMessageType("success");
      toast.success("User created");
    } catch (error) {
      console.warn("Failed to create admin user");
      const apiMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message === "string"
          ? (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
          : null;

      setUserCreateMessage(apiMessage ?? "Unable to create user right now.");
      setUserCreateMessageType("error");
      toast.error("Something went wrong. Please try again.");
    } finally {
      setCreatingUser(false);
    }
  };

  const saveUserRole = async (userId: string) => {
    const nextRole = userRoleDrafts[userId];
    const currentUser = adminUsers.find((user) => user.id === userId);

    if (!currentUser || !nextRole) {
      return;
    }

    if (normalizeRoleOption(currentUser.role) === nextRole) {
      setUserCreateMessage("Selected role is already up to date.");
      setUserCreateMessageType("success");
      toast.success("Role updated");
      return;
    }

    setSavingUserRoleId(userId);
    setUserCreateMessage(null);
    setUserCreateMessageType(null);

    try {
      const response = await api.patch<{ user: AdminUserRow }>(`/admin/users/${encodeURIComponent(userId)}/role`, {
        role: nextRole,
      });

      setAdminUsers((current) => current.map((user) => (user.id === userId ? response.user : user)));
      setUserRoleDrafts((current) => ({ ...current, [userId]: normalizeRoleOption(response.user.role) }));
      setUserCreateMessage(`Role updated successfully for ${response.user.email}.`);
      setUserCreateMessageType("success");
    } catch (error) {
      console.warn("Failed to update user role");
      setUserCreateMessage("Unable to update role right now.");
      setUserCreateMessageType("error");
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSavingUserRoleId(null);
    }
  };

  const saveUserMinistry = async (userId: string) => {
    const currentUser = adminUsers.find((user) => user.id === userId);
    if (!currentUser || currentUser.role !== "REQUESTER") {
      return;
    }

    const nextMinistryId = userMinistryDrafts[userId] || null;
    if ((currentUser.ministryId ?? null) === nextMinistryId) {
      setUserCreateMessage("Selected ministry is already up to date.");
      setUserCreateMessageType("success");
      toast.success("Ministry updated");
      return;
    }

    setSavingUserMinistryId(userId);
    setUserCreateMessage(null);
    setUserCreateMessageType(null);

    try {
      const response = await api.patch<{ user: AdminUserRow }>(`/admin/users/${encodeURIComponent(userId)}/ministry`, {
        ministryId: nextMinistryId,
      });

      setAdminUsers((current) => current.map((user) => (user.id === userId ? response.user : user)));
      setUserMinistryDrafts((current) => ({ ...current, [userId]: response.user.ministryId ?? "" }));
      setUserCreateMessage(`Ministry updated successfully for ${response.user.email}.`);
      setUserCreateMessageType("success");
    } catch (error) {
      console.warn("Failed to update user ministry");
      const apiMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message === "string"
          ? (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
          : null;

      setUserCreateMessage(apiMessage ?? "Unable to update ministry right now.");
      setUserCreateMessageType("error");
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSavingUserMinistryId(null);
    }
  };

  const startDeleteUser = (user: AdminUserRow) => {
    setDeleteTargetUser(user);
    setUserDeleteMessage(null);
    setUserDeleteMessageType(null);
  };

  const closeDeleteUserModal = () => {
    setDeleteTargetUser(null);
  };

  const confirmDeleteUser = async () => {
    if (!deleteTargetUser) {
      return;
    }

    setDeletingUserId(deleteTargetUser.id);
    setUserDeleteMessage(null);
    setUserDeleteMessageType(null);

    try {
      await api.delete<DeleteAdminUserResponse>(`/admin/users/${encodeURIComponent(deleteTargetUser.id)}`, {
        data: {},
      });

      setAdminUsers((current) => current.filter((user) => user.id !== deleteTargetUser.id));
      setUserRoleDrafts((current) => {
        const next = { ...current };
        delete next[deleteTargetUser.id];
        return next;
      });
      setUserMinistryDrafts((current) => {
        const next = { ...current };
        delete next[deleteTargetUser.id];
        return next;
      });
      setUserDeleteMessage(`Deleted ${deleteTargetUser.email} successfully.`);
      setUserDeleteMessageType("success");
      toast.success("User deleted");
      closeDeleteUserModal();
    } catch (error) {
      console.warn("Failed to delete user");
      const apiMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message === "string"
          ? (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
          : null;

      setUserDeleteMessage(apiMessage ?? "Unable to delete user right now.");
      setUserDeleteMessageType("error");
      toast.error("Something went wrong. Please try again.");
    } finally {
      setDeletingUserId(null);
    }
  };

  const statusStyles: Record<LiveVenue["status"], string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
    INACTIVE: "bg-rose-50 text-rose-700 border-rose-200",
    MAINTENANCE: "bg-blue-50 text-blue-700 border-blue-200",
  };

  const roleStyles: Record<LiveUserRow["role"], string> = {
    REQUESTER: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    PARISH_SECRETARY: "bg-emerald-50 text-emerald-700 border-emerald-200",
    PARISH_PRIEST: "bg-blue-50 text-blue-700 border-blue-200",
    ADMIN: "bg-purple-50 text-purple-700 border-purple-200",
  };

  return (
    <div>
      <div className="mb-6">
        <PageHeader title="Administrator Dashboard" description="Live request analytics, users, venues, and DSS signals." />
      </div>

      {analyticsError && (
        <div className="mb-8 rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-5 py-4 text-sm text-red-700 dark:text-red-400">
          {analyticsError}
        </div>
      )}

      <div className="mb-10 space-y-6">
        <div className="rounded-3xl border border-[#0F3B8C]/30 bg-[#0F3B8C]/10 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-white dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800">
              <Sparkles className="w-5 h-5 text-[#B45309] dark:text-amber-300" />
            </div>
            <div className="flex-1 space-y-5">
              <div>
                <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-100">Decision Support System - Booking Insights</h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">Live request demand, approval flow, and booking pressure signals.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60">
                  <p className="text-[10px] font-black text-[#B45309] dark:text-amber-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    Peak Request Demand
                  </p>
                  <p className="text-sm text-zinc-900 dark:text-zinc-100 mb-1.5 font-semibold">
                    <span className="font-bold">{insights.peakDemand.day}</span> • {insights.peakDemand.time}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{insights.peakDemand.venue}</p>
                </div>

                <div className="rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60">
                  <p className="text-[10px] font-black text-[#B45309] dark:text-amber-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    Approval Flow
                  </p>
                  <p className="text-sm text-zinc-900 dark:text-zinc-100 mb-1.5 font-semibold">
                    Approval: <span className="font-bold">{insights.efficiency.avgApprovalTime}</span>
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Rate: {insights.efficiency.approvalRate}</p>
                </div>

                <div className="rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60">
                  <p className="text-[10px] font-black text-[#B45309] dark:text-amber-300 uppercase tracking-wider mb-3">Booking Pressure</p>
                  <div className="flex items-center gap-2 mb-1.5">
                    {insights.efficiency.trend === "improving" ? (
                      <CheckCircle2 className="w-5 h-5 text-[#00A859]" />
                    ) : (
                        <AlertTriangle className="w-5 h-5 text-[#B45309] dark:text-amber-300" />
                    )}
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {insights.efficiency.trend === "improving" ? "Flow Looks Healthy" : "Review Booking Pressure"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Trend: {insights.efficiency.trend}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 p-4">
                  <p className="text-[10px] font-black text-[#B45309] dark:text-amber-300 uppercase tracking-wider mb-1">Top Event Type</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{insights.bookingPatterns.topEventType}</p>
                </div>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 p-4">
                  <p className="text-[10px] font-black text-[#B45309] dark:text-amber-300 uppercase tracking-wider mb-1">Top Ministry</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{insights.bookingPatterns.topMinistry}</p>
                </div>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 p-4">
                  <p className="text-[10px] font-black text-[#B45309] dark:text-amber-300 uppercase tracking-wider mb-1">Top Venue</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{insights.bookingPatterns.topVenue}</p>
                </div>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 p-4">
                  <p className="text-[10px] font-black text-[#B45309] dark:text-amber-300 uppercase tracking-wider mb-1">Busiest Window</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{insights.busiestWindow}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[10px] font-black text-[#B45309] dark:text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Operational Notes
                  </h4>
                  <ul className="space-y-1.5">
                    {insights.recommendations.map((rec, index) => (
                      <li key={index} className="text-xs text-zinc-600 dark:text-zinc-300 flex items-start gap-2">
                        <span className="text-[#00A859] mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-[10px] font-black text-[#B45309] dark:text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Watch List
                  </h4>
                  <ul className="space-y-1.5">
                    {insights.risks.map((risk, index) => (
                      <li key={index} className="text-xs text-zinc-600 dark:text-zinc-300 flex items-start gap-2">
                        <span className="text-[#B45309] dark:text-amber-300 mt-0.5">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Live request count this month: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{requestsThisMonth}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950/60 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-[#00A859]" />
              <div>
                <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-100">Admin Statistics</h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Approval workload, request trends, and venue demand for the portal.</p>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full bg-[#0F3B8C]/10 text-[#0F3B8C] dark:text-blue-300">Live DSR Analytics</span>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950/60 px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Venues</p>
                <p className="mt-2 text-3xl font-black text-[#00A859]">{venues.length}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950/60 px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Active</p>
                <p className="mt-2 text-3xl font-black text-[#92400E] dark:text-amber-300">{venueStatusCounts.ACTIVE}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950/60 px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Users</p>
                <p className="mt-2 text-3xl font-black text-[#0F3B8C] dark:text-blue-300">{adminUsers.length}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950/60 px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Admins</p>
                <p className="mt-2 text-3xl font-black text-red-500">{userRoleCounts.ADMIN}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="p-4 rounded-2xl border bg-white dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800">
                <p className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 mb-4">Status Distribution</p>
                {[
                  ["Active", venueStatusCounts.ACTIVE],
                  ["Inactive", venueStatusCounts.INACTIVE],
                  ["Maintenance", venueStatusCounts.MAINTENANCE],
                  ["Rejected", rejectedRequestsThisPeriod],
                ].map(([label, value]) => (
                  <div key={String(label)} className="mb-3">
                    <div className="flex justify-between text-[10px] font-bold mb-1 text-zinc-600 dark:text-zinc-300"><span>{label}</span><span>{value}</span></div>
                    <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"><div className="h-full rounded-full bg-[#00A859]" style={{ width: `${Math.max(8, (Number(value) / Math.max(1, venues.length + rejectedRequestsThisPeriod)) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl border bg-white dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800">
                <p className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 mb-4">Venue Demand</p>
                <div className="space-y-3">
                  {auditStats?.requestsByMinistry?.slice(0, 5).map((ministry) => (
                    <div key={ministry.ministryId} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                      <div>
                        <p className="text-[10px] font-bold truncate text-zinc-600 dark:text-zinc-300">{ministry.ministryName}</p>
                        <div className="h-2 mt-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"><div className="h-full rounded-full bg-[#0F3B8C]" style={{ width: `${Math.max(6, (ministry.total / Math.max(1, requestsThisMonth)) * 100)}%` }} /></div>
                      </div>
                      <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-300">{ministry.total}</span>
                    </div>
                  ))}
                  {(!auditStats?.requestsByMinistry || auditStats.requestsByMinistry.length === 0) && venues.slice(0, 5).map((venue) => (
                    <div key={venue.id} className="grid grid-cols-[1fr_auto] gap-3 items-center">
                      <div><p className="text-[10px] font-bold truncate text-zinc-600 dark:text-zinc-300">{venue.name}</p><div className="h-2 mt-1 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden"><div className="h-full rounded-full bg-[#0F3B8C]" style={{ width: "12%" }} /></div></div>
                      <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-300">0</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl border bg-white dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800">
                <p className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 mb-4">System Snapshot</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-[#00A859]/10"><p className="text-[9px] uppercase font-black text-[#00A859]">Approval Rate</p><p className="text-xl font-black text-zinc-900 dark:text-zinc-100">{insights.efficiency.approvalRate}</p></div>
                  <div className="p-3 rounded-xl bg-[#0F3B8C]/10"><p className="text-[9px] uppercase font-black text-[#0F3B8C] dark:text-blue-300">Venues</p><p className="text-xl font-black text-zinc-900 dark:text-zinc-100">{venues.length}</p></div>
                  <div className="p-3 rounded-xl bg-[#B45309]/10"><p className="text-[9px] uppercase font-black text-[#92400E] dark:text-amber-300">Ministries</p><p className="text-xl font-black text-zinc-900 dark:text-zinc-100">{ministries.length}</p></div>
                  <div className="p-3 rounded-xl bg-red-500/10"><p className="text-[9px] uppercase font-black text-red-500">Conflicts</p><p className="text-xl font-black text-zinc-900 dark:text-zinc-100">{auditStats?.totalConflictsDetected ?? 0}</p></div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-zinc-100">Requests by {reportView === "weekly" ? "Week" : reportView === "monthly" ? "Month" : "Year"}</h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Live approved and rejected request activity from the audit log.</p>
                </div>

                <div className="flex gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-950 p-1">
                  <button
                    type="button"
                    onClick={() => setReportView("weekly")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                      reportView === "weekly"
                        ? "bg-[#0F3B8C] text-white hover:bg-[#0d3380] hover:text-white dark:hover:bg-[#1a4fab] dark:hover:text-white shadow-sm"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    Week
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportView("monthly")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                      reportView === "monthly"
                        ? "bg-[#0F3B8C] text-white hover:bg-[#0d3380] hover:text-white dark:hover:bg-[#1a4fab] dark:hover:text-white shadow-sm"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportView("yearly")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                      reportView === "yearly"
                        ? "bg-[#0F3B8C] text-white hover:bg-[#0d3380] hover:text-white dark:hover:bg-[#1a4fab] dark:hover:text-white shadow-sm"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    Year
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#0F3B8C] dark:text-blue-300">Requested</p>
                  <p className="mt-1.5 text-2xl font-black text-zinc-900 dark:text-zinc-100">
                    <AnimatedNumber value={reportData.reduce((sum, row) => sum + row.requests, 0)} />
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#00A859]">Approved</p>
                  <p className="mt-1.5 text-2xl font-black text-zinc-900 dark:text-zinc-100">
                    <AnimatedNumber value={approvedRequestsThisPeriod} />
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-red-500">Rejected</p>
                  <p className="mt-1.5 text-2xl font-black text-zinc-900 dark:text-zinc-100">
                    <AnimatedNumber value={rejectedRequestsThisPeriod} />
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {reportData.map((row) => {
                  const total = row.requests + row.approved + row.rejected;

                  return (
                    <div key={row.label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{row.label}</p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{total} total request events</p>
                        </div>
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          {row.approved} approved • {row.rejected} rejected
                        </span>
                      </div>
                      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="flex h-full w-full">
                          <div className="bg-blue-500" style={{ width: `${total > 0 ? (row.requests / total) * 100 : 0}%` }} />
                          <div className="bg-emerald-500" style={{ width: `${total > 0 ? (row.approved / total) * 100 : 0}%` }} />
                          <div className="bg-rose-500" style={{ width: `${total > 0 ? (row.rejected / total) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {reportData.length === 0 && (
                  <p className="text-sm text-zinc-400 dark:text-zinc-500">No request activity found for this period.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950/60 p-5">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-sm font-black text-zinc-900 dark:text-zinc-100">Pending Approval Queue</h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Review the next DSRs waiting for assignment or decision.</p>
            </div>
            <span className="text-[10px] font-black text-[#92400E] dark:text-amber-300">{pendingQueuePreview.length} pending</span>
          </div>
          {pendingQueuePreview.length === 0 ? (
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">No pending approvals are waiting right now.</p>
          ) : (
            <div className="space-y-3">
              {pendingQueuePreview.slice(0, 4).map((log) => (
                <div key={log.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500">{log.venueRequest?.id ?? log.id}</p>
                      <h3 className="text-sm font-black truncate text-zinc-900 dark:text-zinc-100">{log.venueRequest?.venue?.name ?? "Venue pending"}</h3>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{log.venueRequest?.ministry?.name ?? "Ministry pending"} • {log.venueRequest?.startDateTime ? new Date(log.venueRequest.startDateTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Date pending"}</p>
                    </div>
                    <button type="button" className="px-3 py-2 rounded-xl bg-[#00A859] text-white hover:bg-[#009950] hover:text-white dark:hover:bg-[#00bf65] dark:hover:text-white text-[10px] font-black">Review</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-10">
        <div className="bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-8 py-6 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#0F3B8C]/10 rounded-lg">
                <Users className="w-6 h-6 text-[#0F3B8C] dark:text-blue-300" />
              </div>
              <div>
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-xl">Users</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">View live audit activity and manage Cognito users in one place</p>
              </div>
            </div>

            <div className="flex gap-2 rounded-xl bg-white dark:bg-zinc-950 p-1.5 border border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setUsersTab("activity")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                  usersTab === "activity"
                    ? "bg-[#0F3B8C] text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
                }`}
              >
                Activity
              </button>
              <button
                type="button"
                onClick={() => setUsersTab("manage")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150 ${
                  usersTab === "manage"
                    ? "bg-[#0F3B8C] text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
                }`}
              >
                Manage Users
              </button>
            </div>
          </div>

          {usersTab === "activity" ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 bg-white dark:bg-zinc-950/30">
                  {activityUsers.length > 0 ? (
                    activityUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 transition-colors duration-150">
                        <td className="px-6 py-5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{user.id}</td>
                        <td className="px-6 py-5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{user.name}</td>
                        <td className="px-6 py-5 text-sm text-zinc-600 dark:text-zinc-300">{user.email}</td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center px-4 py-1.5 text-xs font-bold rounded-full border ${
                              user.role === "ADMIN"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : user.role === "PARISH_PRIEST"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : user.role === "PARISH_SECRETARY"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                            }`}
                          >
                            {formatRole(user.role)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-6 py-8 text-sm text-zinc-500 dark:text-zinc-400" colSpan={4}>
                        {adminUsersLoading ? "Loading users..." : "No users available."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-4 gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 p-5">
                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Email</label>
                  <input
                    value={newUserDraft.email}
                    onChange={(e) => setNewUserDraft((current) => ({ ...current, email: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-[#0F3B8C] focus:outline-none focus:ring-2 focus:ring-[#0F3B8C]/30"
                    placeholder="user@example.com"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Full Name</label>
                  <input
                    value={newUserDraft.name}
                    onChange={(e) => setNewUserDraft((current) => ({ ...current, name: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-[#0F3B8C] focus:outline-none focus:ring-2 focus:ring-[#0F3B8C]/30"
                    placeholder="Jane Doe"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Role</label>
                  <select
                    value={newUserDraft.role}
                    onChange={(e) => setNewUserDraft((current) => ({ ...current, role: e.target.value as UserRoleOption }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-[#0F3B8C] focus:outline-none focus:ring-2 focus:ring-[#0F3B8C]/30"
                  >
                    <option value="REQUESTER">Requester</option>
                    <option value="PARISH_SECRETARY">Parish Secretary</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Ministry</label>
                  <select
                    value={newUserDraft.ministryId}
                    onChange={(e) => setNewUserDraft((current) => ({ ...current, ministryId: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-[#0F3B8C] focus:outline-none focus:ring-2 focus:ring-[#0F3B8C]/30"
                  >
                    <option value="">Unassigned</option>
                    {ministries.map((ministry) => (
                      <option key={ministry.id} value={ministry.id}>
                        {ministry.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Temporary Password</label>
                  <input
                    value={newUserDraft.temporaryPassword}
                    onChange={(e) => setNewUserDraft((current) => ({ ...current, temporaryPassword: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-[#0F3B8C] focus:outline-none focus:ring-2 focus:ring-[#0F3B8C]/30"
                    placeholder="Leave blank to auto-generate"
                  />
                </div>

                <div className="col-span-4 flex justify-end">
                  <button
                    type="button"
                    onClick={createAdminUser}
                    disabled={creatingUser}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0F3B8C] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d3380] dark:hover:bg-[#1a4fab] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <KeyRound className="w-4 h-4" />
                    {creatingUser ? "Creating..." : "Create User in Cognito"}
                  </button>
                </div>
              </div>

              {userCreateMessage && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    userCreateMessageType === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                  role="status"
                >
                  {userCreateMessage}
                </div>
              )}

              {adminUsersError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {adminUsersError}
                </div>
              )}

              {userDeleteMessage && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    userDeleteMessageType === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                  role="status"
                >
                  {userDeleteMessage}
                </div>
              )}

              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Current Users</h3>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    {adminUsersLoading ? "Loading..." : `${adminUsers.length} users`}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Name</th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Email</th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Role</th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Updated Role</th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Ministry</th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 bg-white dark:bg-zinc-950/30">
                      {adminUsers.length > 0 ? adminUsers.map((user) => (
                        <tr key={user.id} className="even:bg-zinc-50 dark:even:bg-zinc-900/40 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 transition-colors duration-150">
                          <td className="px-5 py-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{user.name}</td>
                          <td className="px-5 py-4 text-sm text-zinc-600 dark:text-zinc-300">{user.email}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${roleStyles[user.role]}`}>
                              {formatRole(user.role)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <select
                              value={userRoleDrafts[user.id] ?? user.role}
                              onChange={(e) => setUserRoleDrafts((current) => ({ ...current, [user.id]: e.target.value as UserRoleOption }))}
                              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#0F3B8C] focus:outline-none focus:ring-2 focus:ring-[#0F3B8C]/30"
                            >
                              <option value="REQUESTER">Requester</option>
                              <option value="PARISH_SECRETARY">Parish Secretary</option>
                              <option value="ADMIN">Administrator</option>
                            </select>
                          </td>
                          <td className="px-5 py-4">
                            {user.role === "REQUESTER" ? (
                              <div className="flex min-w-[260px] items-center gap-2">
                                <select
                                  value={userMinistryDrafts[user.id] ?? user.ministryId ?? ""}
                                  onChange={(e) => setUserMinistryDrafts((current) => ({ ...current, [user.id]: e.target.value }))}
                                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:border-[#0F3B8C] focus:outline-none focus:ring-2 focus:ring-[#0F3B8C]/30"
                                >
                                  <option value="">Unassigned</option>
                                  {ministries.map((ministry) => (
                                    <option key={ministry.id} value={ministry.id}>
                                      {ministry.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => saveUserMinistry(user.id)}
                                  disabled={savingUserMinistryId === user.id}
                                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  {savingUserMinistryId === user.id ? "Saving..." : "Save"}
                                </button>
                              </div>
                            ) : (
                              <span className="text-sm text-zinc-500 dark:text-zinc-400">Not applicable</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => saveUserRole(user.id)}
                                disabled={savingUserRoleId === user.id}
                                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Save className="w-3.5 h-3.5" />
                                {savingUserRoleId === user.id ? "Saving..." : "Save Role"}
                              </button>

                              <button
                                type="button"
                                onClick={() => startDeleteUser(user)}
                                disabled={deletingUserId === user.id}
                                className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/25 hover:text-red-600 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/30 dark:hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400" colSpan={6}>
                            {adminUsersLoading ? "Loading admin users..." : "No users found."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">Showing {adminUsers.length} of {adminUsers.length} results</p>

                <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                  New users are created in Cognito and synced to the database. Role updates also update Cognito groups.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl shadow-slate-900/20">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Delete User</h2>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">This action is protected by admin login and role checks.</p>
              </div>
              <button
                type="button"
                onClick={closeDeleteUserModal}
                className="rounded-lg p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                This will permanently remove <span className="font-semibold">{deleteTargetUser.name}</span> ({deleteTargetUser.email}).
                Users with request or audit history cannot be deleted.
              </div>

              {userDeleteMessage && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    userDeleteMessageType === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                  role="status"
                >
                  {userDeleteMessage}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
              <button
                type="button"
                onClick={closeDeleteUserModal}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={deletingUserId === deleteTargetUser.id}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2 text-sm font-semibold text-white dark:text-white shadow-lg shadow-rose-900/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {deletingUserId === deleteTargetUser.id ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
          <div className="px-8 py-6 bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#00A859]/10 rounded-lg">
                <Building2 className="w-6 h-6 text-[#00A859]" />
              </div>
              <div>
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 text-xl">Venue Management</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Configured venue facilities from live data</p>
              </div>
            </div>

            <button
              type="button"
              onClick={startCreatingVenue}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00A859] px-4 py-2 text-sm font-semibold text-white hover:bg-[#009950] hover:text-white dark:hover:bg-[#00bf65] dark:hover:text-white"
            >
              <Plus className="w-4 h-4" />
              Add Venue
            </button>
          </div>

          {venuesLoading ? (
            <div className="p-8 text-sm text-zinc-500 dark:text-zinc-400">Loading venue data...</div>
          ) : venuesError ? (
            <div className="p-8 text-sm text-rose-600 dark:text-rose-400">{venuesError}</div>
          ) : venues.length === 0 ? (
            <div className="space-y-4 p-8 text-sm text-zinc-500 dark:text-zinc-400">
              <p>No venues were returned from the live data source.</p>
              <button
                type="button"
                onClick={startCreatingVenue}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <Plus className="w-4 h-4" />
                Add First Venue
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Venue Name</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Capacity</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 bg-white dark:bg-zinc-950/30">
                  {venues.map((venue) => (
                    <tr key={venue.id} className="hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100 transition-colors duration-150">
                      <td className="px-6 py-5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{venue.id}</td>
                      <td className="px-6 py-5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{venue.name}</td>
                      <td className="px-6 py-5 text-sm text-zinc-600 dark:text-zinc-300">{venue.capacity} people</td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex items-center px-4 py-1.5 text-xs font-bold rounded-full border ${statusStyles[venue.status]}`}>
                          {venue.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-zinc-600 dark:text-zinc-300">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingVenue(venue)}
                            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => startDeleteVenue(venue)}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/25 hover:text-red-600 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/30 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {venueCreateMessage && (
            <div
              className={`mx-8 mb-8 rounded-lg border px-4 py-3 text-sm ${
                venueCreateMessageType === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
              role="status"
            >
              {venueCreateMessage}
            </div>
          )}

          {venueDeleteMessage && (
            <div
              className={`mx-8 mb-8 rounded-lg border px-4 py-3 text-sm ${
                venueDeleteMessageType === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
              role="status"
            >
              {venueDeleteMessage}
            </div>
          )}
        </div>
      </div>

      {selectedVenue && isVenueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl shadow-slate-900/20">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Edit Venue</h2>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Update venue details and status.</p>
              </div>
              <button
                type="button"
                onClick={closeVenueModal}
                className="rounded-lg p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Current Status</span>
                <span className={`inline-flex items-center px-4 py-1.5 text-xs font-bold rounded-full border ${statusStyles[venueDraft.status]}`}>
                  {venueDraft.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Venue Name</label>
                  <input
                    value={venueDraft.name}
                    onChange={(e) => setVenueDraft((current) => ({ ...current, name: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-[#0F3B8C] focus:outline-none focus:ring-2 focus:ring-[#0F3B8C]/30"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={venueDraft.capacity}
                    onChange={(e) => setVenueDraft((current) => ({ ...current, capacity: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-[#0F3B8C] focus:outline-none focus:ring-2 focus:ring-[#0F3B8C]/30"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Description</label>
                  <textarea
                    rows={4}
                    value={venueDraft.description}
                    onChange={(e) => setVenueDraft((current) => ({ ...current, description: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-[#0F3B8C] focus:outline-none focus:ring-2 focus:ring-[#0F3B8C]/30"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Status</label>
                  <select
                    value={venueDraft.status}
                    onChange={(e) => setVenueDraft((current) => ({ ...current, status: e.target.value as LiveVenue["status"] }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-[#0F3B8C] focus:outline-none focus:ring-2 focus:ring-[#0F3B8C]/30"
                  >
                    <option value="ACTIVE">ACTIVE (Green)</option>
                    <option value="INACTIVE">INACTIVE (Red)</option>
                    <option value="MAINTENANCE">MAINTENANCE (Blue)</option>
                  </select>
                </div>
              </div>

              {venueSaveMessage && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    venueSaveMessageType === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                  role="status"
                >
                  {venueSaveMessage}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
              <button
                type="button"
                onClick={closeVenueModal}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveVenueChanges}
                disabled={savingVenueId === selectedVenue.id}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F3B8C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0d3380] dark:hover:bg-[#1a4fab] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                {savingVenueId === selectedVenue.id ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCreateVenueModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl shadow-slate-900/20">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Add Venue</h2>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Create a new venue record.</p>
              </div>
              <button
                type="button"
                onClick={closeCreateVenueModal}
                className="rounded-lg p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Venue Name</label>
                  <input
                    value={newVenueDraft.name}
                    onChange={(e) => setNewVenueDraft((current) => ({ ...current, name: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-[#00A859] focus:outline-none focus:ring-2 focus:ring-[#00A859]/30"
                    placeholder="Main Hall"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Description</label>
                  <textarea
                    rows={4}
                    value={newVenueDraft.description}
                    onChange={(e) => setNewVenueDraft((current) => ({ ...current, description: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-[#00A859] focus:outline-none focus:ring-2 focus:ring-[#00A859]/30"
                    placeholder="Optional venue notes"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={newVenueDraft.capacity}
                    onChange={(e) => setNewVenueDraft((current) => ({ ...current, capacity: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-[#00A859] focus:outline-none focus:ring-2 focus:ring-[#00A859]/30"
                    placeholder="100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Status</label>
                  <select
                    value={newVenueDraft.status}
                    onChange={(e) => setNewVenueDraft((current) => ({ ...current, status: e.target.value as LiveVenue["status"] }))}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-[#00A859] focus:outline-none focus:ring-2 focus:ring-[#00A859]/30"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </div>
              </div>

              {venueCreateMessage && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    venueCreateMessageType === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                  role="status"
                >
                  {venueCreateMessage}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
              <button
                type="button"
                onClick={closeCreateVenueModal}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createVenue}
                disabled={creatingVenue}
                className="inline-flex items-center gap-2 rounded-lg bg-[#00A859] px-5 py-2 text-sm font-semibold text-white hover:bg-[#009950] dark:hover:bg-[#00bf65] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="w-4 h-4" />
                {creatingVenue ? "Creating..." : "Create Venue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteVenueTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl shadow-slate-900/20">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Delete Venue</h2>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">This action cannot be undone.</p>
              </div>
              <button
                type="button"
                onClick={closeDeleteVenueModal}
                className="rounded-lg p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Delete <span className="font-semibold">{deleteVenueTarget.name}</span>? Venues with booking history will be blocked.
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">Your Password</label>
                <input
                  type="password"
                  value={deleteVenuePassword}
                  onChange={(e) => setDeleteVenuePassword(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                  placeholder="Re-enter your password"
                />
              </div>

              {venueDeleteMessage && (
                <div
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    venueDeleteMessageType === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                  role="status"
                >
                  {venueDeleteMessage}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800 px-6 py-4">
              <button
                type="button"
                onClick={closeDeleteVenueModal}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteVenue}
                disabled={deletingVenueId === deleteVenueTarget.id}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2 text-sm font-semibold text-white dark:text-white shadow-lg shadow-rose-900/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {deletingVenueId === deleteVenueTarget.id ? "Deleting..." : "Delete Venue"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
