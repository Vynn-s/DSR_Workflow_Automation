import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Bell, CheckCircle2, XCircle, Clock, Trash2, Check } from "lucide-react";

interface Notification {
  id: number;
  type: "approved" | "rejected" | "review" | "remarks";
  requestId: string;
  message: string;
  details?: string;
  date: string;
  time: string;
  read: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: 1,
    type: "approved",
    requestId: "REQ-001",
    message: "Your booking request has been approved",
    details: "Your request for Mezzanine Hall A on February 15, 2026 has been approved. All requirements were met.",
    date: "2026-01-29",
    time: "02:20 PM",
    read: false
  },
  {
    id: 2,
    type: "rejected",
    requestId: "REQ-003",
    message: "Your booking request has been rejected",
    details: "Your request for Meeting Room 1 has been rejected. Reason: Venue already booked for another event during this time slot.",
    date: "2026-01-26",
    time: "09:15 AM",
    read: false
  },
  {
    id: 3,
    type: "review",
    requestId: "REQ-002",
    message: "Your request is now under review",
    details: "Your booking request for Socio Hall is being reviewed by the approval team.",
    date: "2026-02-01",
    time: "02:45 PM",
    read: true
  },
  {
    id: 4,
    type: "remarks",
    requestId: "REQ-001",
    message: "Approver added remarks to your request",
    details: "Bishop Antonio commented: 'Please ensure all decorations are removed by 6:00 PM.'",
    date: "2026-01-29",
    time: "03:15 PM",
    read: true
  },
  {
    id: 5,
    type: "review",
    requestId: "REQ-004",
    message: "Your request has been submitted",
    details: "Your booking request for Blessed Sacrament Chapel has been successfully submitted and is awaiting review.",
    date: "2026-02-02",
    time: "10:15 AM",
    read: true
  }
];

export function NotificationCenter() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(mockNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = filter === "unread" 
    ? notifications.filter(n => !n.read)
    : notifications;

  const markAsRead = (id: number) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "approved":
        return <CheckCircle2 className="w-6 h-6 text-emerald-600" />;
      case "rejected":
        return <XCircle className="w-6 h-6 text-rose-600" />;
      case "review":
      case "remarks":
        return <Clock className="w-6 h-6 text-blue-600" />;
      default:
        return <Bell className="w-6 h-6 text-slate-600" />;
    }
  };

  const getNotificationBg = (type: string, read: boolean) => {
    if (read) return "bg-white";
    
    switch (type) {
      case "approved":
        return "bg-emerald-50/50";
      case "rejected":
        return "bg-rose-50/50";
      case "review":
      case "remarks":
        return "bg-blue-50/50";
      default:
        return "bg-white";
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/requester")}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900 mb-2 tracking-tight">
              Notification Center
            </h1>
            <p className="text-slate-600">
              Stay updated on your booking requests and approvals
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {/* Stats and Filter */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-4">
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg">
            <p className="text-xs text-slate-600">Total</p>
            <p className="text-2xl font-semibold text-slate-900">{notifications.length}</p>
          </div>
          <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-600">Unread</p>
            <p className="text-2xl font-semibold text-blue-900">{unreadCount}</p>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              filter === "all"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              filter === "unread"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 overflow-hidden">
        {filteredNotifications.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-6 transition-colors hover:bg-slate-50 ${getNotificationBg(notification.type, notification.read)}`}
              >
                <div className="flex gap-4">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">
                            {notification.message}
                          </h3>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">
                          Request: <span className="font-medium">{notification.requestId}</span>
                        </p>
                      </div>
                      <div className="text-right text-sm text-slate-500 flex-shrink-0 ml-4">
                        <p>{notification.date}</p>
                        <p>{notification.time}</p>
                      </div>
                    </div>

                    {notification.details && (
                      <p className="text-sm text-slate-700 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        {notification.details}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Mark as read
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      >
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
              <Bell className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">
              No {filter === "unread" ? "unread " : ""}notifications
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {filter === "unread" 
                ? "You're all caught up!" 
                : "You don't have any notifications yet"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
