import { useEffect, useMemo, useState } from "react";
import { Users, Building2, Brain, BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Clock, Edit2, Plus, X, KeyRound, Save, Trash2 } from "lucide-react";
import api from "../../lib/api";
import { fetchVenues, type LiveVenue } from "../../lib/venues";
import { useAuth } from "../../context/AuthContext";

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
  const counts = new Map<string, number>();

  for (const log of logs) {
    const venueName = log.venueRequest?.venue?.name;
    if (!venueName) {
      continue;
    }

    counts.set(venueName, (counts.get(venueName) ?? 0) + 1);
  }

  const topVenue = Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0];
  return topVenue?.[0] ?? "Mezzanine Hall A";
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
  const [deleteTargetUser, setDeleteTargetUser] = useState<AdminUserRow | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userDeleteMessage, setUserDeleteMessage] = useState<string | null>(null);
  const [userDeleteMessageType, setUserDeleteMessageType] = useState<"success" | "error" | null>(null);

  useEffect(() => {
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
        console.error("Failed to load venue data:", liveVenuesResult.reason);
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
      } else {
        console.error("Failed to load admin users:", adminUsersResult.reason);
        setAdminUsers([]);
        setAdminUsersError("Unable to load admin users right now.");
      }

      if (ministriesResult.status === "fulfilled") {
        setMinistries(ministriesResult.value.ministries ?? []);
      } else {
        console.error("Failed to load ministries:", ministriesResult.reason);
        setMinistries([]);
      }

      if (auditStatsResult.status === "fulfilled") {
        setAuditStats(auditStatsResult.value);
      } else {
        console.error("Failed to load audit stats:", auditStatsResult.reason);
        setAuditStats(null);
      }

      if (auditLogsResult.status === "fulfilled") {
        setAuditLogs(auditLogsResult.value);
      } else {
        console.error("Failed to load audit logs:", auditLogsResult.reason);
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
      const updatedVenue = await api.put<{ venue: LiveVenue }>(`/venues/${selectedVenueId}`, {
        name: venueDraft.name.trim(),
        description: venueDraft.description.trim() || null,
        capacity: Number(venueDraft.capacity),
        status: venueDraft.status,
      });

      setVenues((current) => current.map((venue) => (venue.id === selectedVenueId ? updatedVenue.venue : venue)));
      setVenueSaveMessage(`Venue updated successfully at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`);
      setVenueSaveMessageType("success");
      closeVenueModal();
    } catch (error) {
      console.error("Failed to save venue:", error);
      setVenueSaveMessage("Unable to save venue changes right now.");
      setVenueSaveMessageType("error");
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
      setNewVenueDraft({
        name: "",
        description: "",
        capacity: "",
        status: "ACTIVE",
      });
      setIsCreateVenueModalOpen(false);
    } catch (error) {
      console.error("Failed to create venue:", error);
      setVenueCreateMessage("Unable to create venue right now.");
      setVenueCreateMessageType("error");
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
      console.error("Failed to delete venue:", error);
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
    } catch (error) {
      console.error("Failed to create admin user:", error);
      const apiMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message === "string"
          ? (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
          : null;

      setUserCreateMessage(apiMessage ?? "Unable to create user right now.");
      setUserCreateMessageType("error");
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
      console.error("Failed to update user role:", error);
      setUserCreateMessage("Unable to update role right now.");
      setUserCreateMessageType("error");
    } finally {
      setSavingUserRoleId(null);
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
      setUserDeleteMessage(`Deleted ${deleteTargetUser.email} successfully.`);
      setUserDeleteMessageType("success");
      closeDeleteUserModal();
    } catch (error) {
      console.error("Failed to delete user:", error);
      const apiMessage =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message === "string"
          ? (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
          : null;

      setUserDeleteMessage(apiMessage ?? "Unable to delete user right now.");
      setUserDeleteMessageType("error");
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
    REQUESTER: "bg-slate-100 text-slate-700 border-slate-200",
    PARISH_SECRETARY: "bg-emerald-50 text-emerald-700 border-emerald-200",
    PARISH_PRIEST: "bg-blue-50 text-blue-700 border-blue-200",
    ADMIN: "bg-purple-50 text-purple-700 border-purple-200",
  };

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
                <h2 className="font-semibold text-slate-900 text-xl">Live Operations Snapshot</h2>
                <p className="text-sm text-slate-600 mt-0.5">Directly from the venue and user APIs</p>
              </div>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">No mock data</span>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Venues</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{venues.length}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Active</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{venueStatusCounts.ACTIVE}</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Users</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{adminUsers.length}</p>
              </div>
              <div className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-purple-700">Admins</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{userRoleCounts.ADMIN}</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-base font-semibold text-slate-900">Venue status mix</h3>
                <p className="mt-1 text-sm text-slate-600">Quick read of current venue availability.</p>

                <div className="mt-4 space-y-3">
                  {(["ACTIVE", "INACTIVE", "MAINTENANCE"] as LiveVenue["status"][]).map((status) => {
                    const count = venueStatusCounts[status];
                    const percent = venues.length > 0 ? (count / venues.length) * 100 : 0;
                    const label = status === "ACTIVE" ? "Active" : status === "INACTIVE" ? "Inactive" : "Maintenance";

                    return (
                      <div key={status}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">{label}</span>
                          <span className="font-semibold text-slate-900">{count}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${
                              status === "ACTIVE"
                                ? "bg-emerald-500"
                                : status === "INACTIVE"
                                ? "bg-rose-500"
                                : "bg-blue-500"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-base font-semibold text-slate-900">User role mix</h3>
                <p className="mt-1 text-sm text-slate-600">Live Cognito/database users currently loaded.</p>

                <div className="mt-4 space-y-3">
                  {(["REQUESTER", "PARISH_SECRETARY", "ADMIN"] as UserRoleOption[]).map((role) => {
                    const count = userRoleCounts[role];
                    const percent = adminUsers.length > 0 ? (count / adminUsers.length) * 100 : 0;

                    return (
                      <div key={role}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">{formatRole(role)}</span>
                          <span className="font-semibold text-slate-900">{count}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${
                              role === "REQUESTER"
                                ? "bg-slate-500"
                                : role === "PARISH_SECRETARY"
                                ? "bg-emerald-500"
                                : "bg-purple-500"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Requests by {reportView === "weekly" ? "Week" : reportView === "monthly" ? "Month" : "Year"}</h3>
                  <p className="mt-1 text-xs text-slate-600">Live approved and rejected request activity from the audit log.</p>
                </div>

                <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setReportView("weekly")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      reportView === "weekly"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Week
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportView("monthly")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      reportView === "monthly"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportView("yearly")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      reportView === "yearly"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Year
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Requested</p>
                  <p className="mt-1.5 text-2xl font-semibold text-slate-900">
                    {reportData.reduce((sum, row) => sum + row.requests, 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Approved</p>
                  <p className="mt-1.5 text-2xl font-semibold text-slate-900">
                    {approvedRequestsThisPeriod}
                  </p>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Rejected</p>
                  <p className="mt-1.5 text-2xl font-semibold text-slate-900">
                    {rejectedRequestsThisPeriod}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {reportData.map((row) => {
                  const total = row.requests + row.approved + row.rejected;

                  return (
                    <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                          <p className="text-[11px] text-slate-500">{total} total request events</p>
                        </div>
                        <span className="text-xs font-semibold text-slate-700">
                          {row.approved} approved • {row.rejected} rejected
                        </span>
                      </div>
                      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-slate-200">
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
                  <p className="text-sm text-slate-500">No request activity found for this period.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-10">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-purple-50/30 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-xl">Users</h2>
                <p className="text-sm text-slate-600 mt-0.5">View live audit activity and manage Cognito users in one place</p>
              </div>
            </div>

            <div className="flex gap-2 rounded-xl bg-slate-100 p-1.5">
              <button
                type="button"
                onClick={() => setUsersTab("activity")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  usersTab === "activity"
                    ? "bg-white text-purple-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Activity
              </button>
              <button
                type="button"
                onClick={() => setUsersTab("manage")}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                  usersTab === "manage"
                    ? "bg-white text-purple-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Manage Users
              </button>
            </div>
          </div>

          {usersTab === "activity" ? (
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
                  {activityUsers.length > 0 ? (
                    activityUsers.map((user) => (
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
                        {adminUsersLoading ? "Loading users..." : "No users available."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-4 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
                  <input
                    value={newUserDraft.email}
                    onChange={(e) => setNewUserDraft((current) => ({ ...current, email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    placeholder="user@example.com"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Full Name</label>
                  <input
                    value={newUserDraft.name}
                    onChange={(e) => setNewUserDraft((current) => ({ ...current, name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    placeholder="Jane Doe"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Role</label>
                  <select
                    value={newUserDraft.role}
                    onChange={(e) => setNewUserDraft((current) => ({ ...current, role: e.target.value as UserRoleOption }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  >
                    <option value="REQUESTER">Requester</option>
                    <option value="PARISH_SECRETARY">Parish Secretary</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Ministry</label>
                  <select
                    value={newUserDraft.ministryId}
                    onChange={(e) => setNewUserDraft((current) => ({ ...current, ministryId: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
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
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Temporary Password</label>
                  <input
                    value={newUserDraft.temporaryPassword}
                    onChange={(e) => setNewUserDraft((current) => ({ ...current, temporaryPassword: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    placeholder="Leave blank to auto-generate"
                  />
                </div>

                <div className="col-span-4 flex justify-end">
                  <button
                    type="button"
                    onClick={createAdminUser}
                    disabled={creatingUser}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-900/20 disabled:cursor-not-allowed disabled:opacity-60"
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
                  <h3 className="text-lg font-semibold text-slate-900">Current Users</h3>
                  <span className="text-sm text-slate-500">
                    {adminUsersLoading ? "Loading..." : `${adminUsers.length} users`}
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Name</th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Email</th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Role</th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Updated Role</th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {adminUsers.length > 0 ? adminUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4 text-sm font-semibold text-slate-900">{user.name}</td>
                          <td className="px-5 py-4 text-sm text-slate-700">{user.email}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${roleStyles[user.role]}`}>
                              {formatRole(user.role)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <select
                              value={userRoleDrafts[user.id] ?? user.role}
                              onChange={(e) => setUserRoleDrafts((current) => ({ ...current, [user.id]: e.target.value as UserRoleOption }))}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                            >
                              <option value="REQUESTER">Requester</option>
                              <option value="PARISH_SECRETARY">Parish Secretary</option>
                              <option value="ADMIN">Administrator</option>
                            </select>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => saveUserRole(user.id)}
                                disabled={savingUserRoleId === user.id}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Save className="w-3.5 h-3.5" />
                                {savingUserRoleId === user.id ? "Saving..." : "Save Role"}
                              </button>

                              <button
                                type="button"
                                onClick={() => startDeleteUser(user)}
                                disabled={deletingUserId === user.id}
                                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td className="px-5 py-6 text-sm text-slate-500" colSpan={5}>
                            {adminUsersLoading ? "Loading admin users..." : "No users found."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="mt-4 text-xs text-slate-500">
                  New users are created in Cognito and synced to the database. Role updates also update Cognito groups.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Delete User</h2>
                <p className="mt-0.5 text-sm text-slate-600">This action is protected by admin login and role checks.</p>
              </div>
              <button
                type="button"
                onClick={closeDeleteUserModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeDeleteUserModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                disabled={deletingUserId === deleteTargetUser.id}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-900/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {deletingUserId === deleteTargetUser.id ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-emerald-50/30 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Building2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-xl">Venue Management</h2>
                <p className="text-sm text-slate-600 mt-0.5">Configured venue facilities from live data</p>
              </div>
            </div>

            <button
              type="button"
              onClick={startCreatingVenue}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 hover:opacity-95"
            >
              <Plus className="w-4 h-4" />
              Add Venue
            </button>
          </div>

          {venuesLoading ? (
            <div className="p-8 text-sm text-slate-600">Loading venue data...</div>
          ) : venuesError ? (
            <div className="p-8 text-sm text-rose-700">{venuesError}</div>
          ) : venues.length === 0 ? (
            <div className="space-y-4 p-8 text-sm text-slate-600">
              <p>No venues were returned from the live data source.</p>
              <button
                type="button"
                onClick={startCreatingVenue}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="w-4 h-4" />
                Add First Venue
              </button>
            </div>
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
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingVenue(venue)}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => startDeleteVenue(venue)}
                            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
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
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Edit Venue</h2>
                <p className="mt-0.5 text-sm text-slate-600">Update venue details and status.</p>
              </div>
              <button
                type="button"
                onClick={closeVenueModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Current Status</span>
                <span className={`inline-flex items-center px-4 py-1.5 text-xs font-bold rounded-full border ${statusStyles[venueDraft.status]}`}>
                  {venueDraft.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Venue Name</label>
                  <input
                    value={venueDraft.name}
                    onChange={(e) => setVenueDraft((current) => ({ ...current, name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={venueDraft.capacity}
                    onChange={(e) => setVenueDraft((current) => ({ ...current, capacity: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
                  <textarea
                    rows={4}
                    value={venueDraft.description}
                    onChange={(e) => setVenueDraft((current) => ({ ...current, description: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
                  <select
                    value={venueDraft.status}
                    onChange={(e) => setVenueDraft((current) => ({ ...current, status: e.target.value as LiveVenue["status"] }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeVenueModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveVenueChanges}
                disabled={savingVenueId === selectedVenue.id}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Add Venue</h2>
                <p className="mt-0.5 text-sm text-slate-600">Create a new venue record.</p>
              </div>
              <button
                type="button"
                onClick={closeCreateVenueModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Venue Name</label>
                  <input
                    value={newVenueDraft.name}
                    onChange={(e) => setNewVenueDraft((current) => ({ ...current, name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="Main Hall"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
                  <textarea
                    rows={4}
                    value={newVenueDraft.description}
                    onChange={(e) => setNewVenueDraft((current) => ({ ...current, description: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="Optional venue notes"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={newVenueDraft.capacity}
                    onChange={(e) => setNewVenueDraft((current) => ({ ...current, capacity: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
                  <select
                    value={newVenueDraft.status}
                    onChange={(e) => setNewVenueDraft((current) => ({ ...current, status: e.target.value as LiveVenue["status"] }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeCreateVenueModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createVenue}
                disabled={creatingVenue}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Delete Venue</h2>
                <p className="mt-0.5 text-sm text-slate-600">This action cannot be undone.</p>
              </div>
              <button
                type="button"
                onClick={closeDeleteVenueModal}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Delete <span className="font-semibold">{deleteVenueTarget.name}</span>? Venues with booking history will be blocked.
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Your Password</label>
                <input
                  type="password"
                  value={deleteVenuePassword}
                  onChange={(e) => setDeleteVenuePassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
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

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeDeleteVenueModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteVenue}
                disabled={deletingVenueId === deleteVenueTarget.id}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-900/20 disabled:cursor-not-allowed disabled:opacity-60"
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
