import { useEffect, useMemo, useState } from "react";
import { Users, Building2, Brain, BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Clock, Edit2, Plus, X, KeyRound, Save, Trash2 } from "lucide-react";
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

async function fetchAllAuditLogs(): Promise<AuditLogItem[]> {
  const limit = 100;
  const firstPage = await api.get<AuditLogsResponse>("/audit", {
    params: { limit: String(limit), page: "1" },
  });

  const items = [...(firstPage.data.items ?? [])];
  const totalPages = Math.max(1, firstPage.data.totalPages ?? 1);
  const cappedPages = Math.min(totalPages, 10);

  for (let page = 2; page <= cappedPages; page += 1) {
    const response = await api.get<AuditLogsResponse>("/audit", {
      params: { limit: String(limit), page: String(page) },
    });
    items.push(...(response.data.items ?? []));
  }

  return items;
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
  const [usersTab, setUsersTab] = useState<"activity" | "manage">("activity");
  const [venues, setVenues] = useState<LiveVenue[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
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
    role: "REQUESTER" as LiveUserRow["role"],
    temporaryPassword: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [userCreateMessage, setUserCreateMessage] = useState<string | null>(null);
  const [userCreateMessageType, setUserCreateMessageType] = useState<"success" | "error" | null>(null);
  const [savingUserRoleId, setSavingUserRoleId] = useState<string | null>(null);
  const [userRoleDrafts, setUserRoleDrafts] = useState<Record<string, LiveUserRow["role"]>>({});
  const [deleteTargetUser, setDeleteTargetUser] = useState<AdminUserRow | null>(null);
  const [deleteUserPassword, setDeleteUserPassword] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userDeleteMessage, setUserDeleteMessage] = useState<string | null>(null);
  const [userDeleteMessageType, setUserDeleteMessageType] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setVenuesLoading(true);
      setAdminUsersLoading(true);
      setAnalyticsLoading(true);
      setVenuesError(null);
      setAdminUsersError(null);
      setAnalyticsError(null);

      const [liveVenuesResult, adminUsersResult, auditStatsResult, auditLogsResult] = await Promise.allSettled([
        fetchVenues(),
        api.get<AdminUsersResponse>("/admin/users"),
        api.get<AuditStats>("/audit/stats"),
        fetchAllAuditLogs(),
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
          Object.fromEntries((adminUsersResult.value.users ?? []).map((user) => [user.id, user.role]))
        );
      } else {
        console.error("Failed to load admin users:", adminUsersResult.reason);
        setAdminUsers([]);
        setAdminUsersError("Unable to load admin users right now.");
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

    return () => {
      isMounted = false;
    };
  }, []);

  const liveUsers = useMemo(() => buildLiveUsers(auditLogs), [auditLogs]);
  const reportData = useMemo(() => buildReportRows(auditLogs, reportView), [auditLogs, reportView]);
  const insights = useMemo(() => buildInsights(auditStats, auditLogs), [auditStats, auditLogs]);
  const requestsThisMonth = auditStats?.totalRequestsThisMonth ?? reportData.reduce((sum, row) => sum + row.requests, 0);
  const chartMax = Math.max(
    1,
    ...reportData.map((row) => Math.max(row.requests, row.approved, row.rejected)),
  );
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
      setVenueDeleteMessage("Unable to delete venue right now.");
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
        temporaryPassword: newUserDraft.temporaryPassword.trim() || undefined,
      });

      setAdminUsers((current) => [response.user, ...current]);
      setUserRoleDrafts((current) => ({ ...current, [response.user.id]: response.user.role }));
      setNewUserDraft({
        email: "",
        name: "",
        role: "REQUESTER",
        temporaryPassword: "",
      });
      setUserCreateMessage(
        `User created successfully. Temporary password: ${response.temporaryPassword}`,
      );
      setUserCreateMessageType("success");
    } catch (error) {
      console.error("Failed to create admin user:", error);
      setUserCreateMessage("Unable to create user right now.");
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

    if (currentUser.role === nextRole) {
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
      setUserRoleDrafts((current) => ({ ...current, [userId]: response.user.role }));
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
    setDeleteUserPassword("");
    setUserDeleteMessage(null);
    setUserDeleteMessageType(null);
  };

  const closeDeleteUserModal = () => {
    setDeleteTargetUser(null);
    setDeleteUserPassword("");
  };

  const confirmDeleteUser = async () => {
    if (!deleteTargetUser) {
      return;
    }

    if (!deleteUserPassword.trim()) {
      setUserDeleteMessage("Password is required before deleting a user.");
      setUserDeleteMessageType("error");
      return;
    }

    setDeletingUserId(deleteTargetUser.id);
    setUserDeleteMessage(null);
    setUserDeleteMessageType(null);

    try {
      await api.delete<DeleteAdminUserResponse>(`/admin/users/${encodeURIComponent(deleteTargetUser.id)}`, {
        data: { password: deleteUserPassword },
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
      setUserDeleteMessage("Unable to delete user right now.");
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
                <h2 className="font-semibold text-slate-900 text-xl">Booking Request Analytics</h2>
                <p className="text-sm text-slate-600 mt-0.5">Quick breakdown of request volume and outcomes</p>
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

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Requests</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{requestsThisMonth}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Avg Approval</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {auditStats ? `${auditStats.averageApprovalTimeHours.toFixed(1)}h` : "N/A"}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Conflicts</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{auditStats?.totalConflictsDetected ?? 0}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{reportView === "weekly" ? "Weekly" : reportView === "monthly" ? "Monthly" : "Yearly"} breakdown</h3>
                  <p className="text-sm text-slate-600">Blue = requests, green = approved, red = rejected</p>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live data</span>
              </div>

              <div className="space-y-4">
                {reportData.map((row) => (
                  <div key={row.label} className="grid grid-cols-[88px_1fr_108px] items-center gap-4">
                    <div className="text-sm font-semibold text-slate-700">{row.label}</div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-14 font-semibold text-blue-700">Req</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${(row.requests / chartMax) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-semibold text-slate-700">{row.requests}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-14 font-semibold text-emerald-700">Apr</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${(row.approved / chartMax) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-semibold text-slate-700">{row.approved}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="w-14 font-semibold text-rose-700">Rej</span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-rose-500"
                            style={{ width: `${(row.rejected / chartMax) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right font-semibold text-slate-700">{row.rejected}</span>
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-500">
                      Max: {Math.max(row.requests, row.approved, row.rejected)}
                    </div>
                  </div>
                ))}
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
                    onChange={(e) => setNewUserDraft((current) => ({ ...current, role: e.target.value as LiveUserRow["role"] }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  >
                    <option value="REQUESTER">Requester</option>
                    <option value="PARISH_SECRETARY">Parish Secretary</option>
                    <option value="PARISH_PRIEST">Parish Priest</option>
                    <option value="ADMIN">Administrator</option>
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
                              onChange={(e) => setUserRoleDrafts((current) => ({ ...current, [user.id]: e.target.value as LiveUserRow["role"] }))}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                            >
                              <option value="REQUESTER">Requester</option>
                              <option value="PARISH_SECRETARY">Parish Secretary</option>
                              <option value="PARISH_PRIEST">Parish Priest</option>
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
                <p className="mt-0.5 text-sm text-slate-600">Enter your password to confirm this deletion.</p>
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

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Your Password</label>
                <input
                  type="password"
                  value={deleteUserPassword}
                  onChange={(e) => setDeleteUserPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                  placeholder="Re-enter your password"
                />
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
