import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Bell, CheckCircle2, XCircle, Clock, Trash2, Check, FileEdit } from "lucide-react";
import api from "../../lib/api";
import { formatRequestId } from "../../lib/requestId";

interface Notification {
  id: string;
  type: "approved" | "rejected" | "revision" | "submitted" | "cancelled" | string;
  title: string;
  requestId?: string | null;
  message: string;
  details?: string | null;
  createdAt: string;
  read: boolean;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const response = await api.get<{ notifications: Notification[]; unreadCount: number }>("/notifications", {
          params: { limit: 100 },
        });

        if (isMounted) {
          setNotifications(response.notifications ?? []);
          setUnreadCount(response.unreadCount ?? 0);
        }
      } catch {
        if (isMounted) {
          setLoadError("Unable to load notifications right now.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadNotifications();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredNotifications = filter === "unread"
    ? notifications.filter((notification) => !notification.read)
    : notifications;

  const markAsRead = async (id: string) => {
    const notification = notifications.find((item) => item.id === id);
    if (!notification || notification.read) return;

    setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    setUnreadCount((current) => Math.max(0, current - 1));

    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: false } : item));
      setUnreadCount((current) => current + 1);
    }
  };

  const markAllAsRead = async () => {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);

    try {
      await api.patch("/notifications/read-all");
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
    }
  };

  const deleteNotification = async (id: string) => {
    const target = notifications.find((item) => item.id === id);
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    setNotifications((current) => current.filter((item) => item.id !== id));
    if (target && !target.read) setUnreadCount((current) => Math.max(0, current - 1));

    try {
      await api.delete(`/notifications/${id}`);
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "approved":
        return <CheckCircle2 className="w-6 h-6 text-[#00A859]" />;
      case "rejected":
      case "cancelled":
        return <XCircle className="w-6 h-6 text-red-400" />;
      case "revision":
        return <FileEdit className="w-6 h-6 text-amber-300" />;
      case "submitted":
        return <Clock className="w-6 h-6 text-blue-300" />;
      default:
        return <Bell className="w-6 h-6 text-zinc-500 dark:text-zinc-400" />;
    }
  };

  const getNotificationBg = (type: string, read: boolean) => {
    if (read) return "bg-white dark:bg-zinc-950/60";
    switch (type) {
      case "approved":
        return "bg-[#00A859]/10";
      case "rejected":
      case "cancelled":
        return "bg-red-500/10";
      case "revision":
        return "bg-amber-500/10";
      default:
        return "bg-[#0F3B8C]/10";
    }
  };

  return (
    <div>
      <div className="mb-8">
        <button
          onClick={() => navigate("/requester")}
          className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-4 transition-colors duration-150"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mb-2 tracking-tight">Notification Center</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Stay updated on your DSR requests and approvals</p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-transparent rounded-xl px-4 py-2.5 text-sm hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors duration-150"
            >
              <Check className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 px-4 py-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Total</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{notifications.length}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 px-4 py-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Unread</p>
            <p className="text-2xl font-semibold text-blue-300">{unreadCount}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setFilter("all")} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${filter === "all" ? "bg-[#0F3B8C] text-white" : "border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"}`}>All</button>
          <button onClick={() => setFilter("unread")} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${filter === "unread" ? "bg-[#0F3B8C] text-white" : "border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"}`}>Unread ({unreadCount})</button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-sm font-semibold text-zinc-400 dark:text-zinc-500">Loading notifications...</div>
        ) : loadError ? (
          <div className="p-12 text-center text-sm font-semibold text-red-400">{loadError}</div>
        ) : filteredNotifications.length > 0 ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredNotifications.map((notification) => (
              <div key={notification.id} className={`p-6 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${getNotificationBg(notification.type, notification.read)}`}>
                <div className="flex gap-4">
                  <div className="flex-shrink-0">{getNotificationIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{notification.title}</h3>
                          {!notification.read && <span className="w-2 h-2 bg-blue-300 rounded-full" />}
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-300">{notification.message}</p>
                        {notification.requestId && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Request: <span className="font-medium">{formatRequestId(notification.requestId)}</span></p>}
                      </div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400 flex-shrink-0 sm:text-right">
                        <p>{formatDate(notification.createdAt)}</p>
                        <p>{formatTime(notification.createdAt)}</p>
                      </div>
                    </div>

                    {notification.details && <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4 bg-zinc-50 dark:bg-[#18181b] p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">{notification.details}</p>}

                    <div className="flex gap-2">
                      {!notification.read && (
                        <button onClick={() => markAsRead(notification.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-500 dark:text-blue-300 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 rounded-md transition-colors duration-150">
                          <Check className="w-3.5 h-3.5" />
                          Mark as read
                        </button>
                      )}
                      <button onClick={() => deleteNotification(notification.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 rounded-md transition-colors duration-150">
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full mb-4">
              <Bell className="w-8 h-8 text-zinc-500 dark:text-zinc-400" />
            </div>
            <p className="text-zinc-900 dark:text-zinc-100 font-medium">No {filter === "unread" ? "unread " : ""}notifications</p>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">{filter === "unread" ? "You're all caught up!" : "You don't have any notifications yet"}</p>
          </div>
        )}
      </div>
    </div>
  );
}
