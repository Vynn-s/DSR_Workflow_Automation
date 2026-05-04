import { useState } from "react";
import { Filter, Activity, TrendingUp, Eye, X, User, Clock, FileText, MapPin, Monitor, RefreshCw } from "lucide-react";

interface AuditEntry {
  id: number;
  timestamp: string;
  user: string;
  role: string;
  action: string;
  details: string;
  fullDetails?: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    venue?: string;
    previousValue?: string;
    newValue?: string;
    affectedUsers?: string[];
    systemNotes?: string;
  };
}

// Mock audit log data
const mockAuditLog: AuditEntry[] = [
  {
    id: 1,
    timestamp: "2026-02-02 14:23:15",
    user: "Bishop Antonio",
    role: "Approver",
    action: "Approved Request",
    details: "Approved REQ-001 - Wedding Ceremony at Main Chapel",
    fullDetails: {
      ipAddress: "192.168.1.45",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      requestId: "REQ-001",
      venue: "Main Chapel",
      previousValue: "Pending",
      newValue: "Approved",
      systemNotes: "Automated email notification sent to requester"
    }
  },
  {
    id: 2,
    timestamp: "2026-02-02 10:15:42",
    user: "Maria Cruz",
    role: "Requester",
    action: "Submitted Request",
    details: "Submitted REQ-004 - Baptism Reception at Chapel Garden",
    fullDetails: {
      ipAddress: "192.168.1.67",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      requestId: "REQ-004",
      venue: "Chapel Garden",
      affectedUsers: ["Bishop Antonio", "Sr. Teresa"],
      systemNotes: "Request assigned to approval queue. Notification sent to approvers."
    }
  },
  {
    id: 3,
    timestamp: "2026-02-01 16:45:30",
    user: "Sr. Teresa",
    role: "Approver",
    action: "Rejected Request",
    details: "Rejected REQ-003 - Bible Study Group at Multipurpose Room (Conflict with another booking)",
    fullDetails: {
      ipAddress: "192.168.1.89",
      userAgent: "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)",
      requestId: "REQ-003",
      venue: "Multipurpose Room",
      previousValue: "Pending",
      newValue: "Rejected",
      systemNotes: "Rejection reason: Scheduling conflict with existing booking. Requester notified via email."
    }
  },
  {
    id: 4,
    timestamp: "2026-02-01 11:20:18",
    user: "Fr. Michael Santos",
    role: "Requester",
    action: "Submitted Request",
    details: "Submitted REQ-002 - Youth Ministry Meeting at Parish Hall",
    fullDetails: {
      ipAddress: "192.168.1.23",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      requestId: "REQ-002",
      venue: "Parish Hall",
      affectedUsers: ["Bishop Antonio", "Sr. Teresa"],
      systemNotes: "Request submitted with 2 attachments. Approval workflow initiated."
    }
  },
  {
    id: 5,
    timestamp: "2026-01-31 09:33:55",
    user: "Admin User",
    role: "Administrator",
    action: "Updated Venue",
    details: "Updated Conference Room capacity to 30",
    fullDetails: {
      ipAddress: "192.168.1.10",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      venue: "Conference Room",
      previousValue: "25",
      newValue: "30",
      systemNotes: "Venue capacity updated in database. All future bookings will reflect new capacity."
    }
  },
  {
    id: 6,
    timestamp: "2026-01-30 13:12:40",
    user: "Bishop Antonio",
    role: "Approver",
    action: "Approved Request",
    details: "Approved REQ-005 - Ministry Coordinators Meeting at Conference Room",
    fullDetails: {
      ipAddress: "192.168.1.45",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      requestId: "REQ-005",
      venue: "Conference Room",
      previousValue: "Pending",
      newValue: "Approved",
      systemNotes: "Fast-tracked approval. Calendar updated automatically."
    }
  },
  {
    id: 7,
    timestamp: "2026-01-28 15:50:22",
    user: "Maria Cruz",
    role: "Requester",
    action: "Submitted Request",
    details: "Submitted REQ-001 - Wedding Ceremony at Main Chapel",
    fullDetails: {
      ipAddress: "192.168.1.67",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      requestId: "REQ-001",
      venue: "Main Chapel",
      affectedUsers: ["Bishop Antonio"],
      systemNotes: "High-priority request. Assigned to senior approver."
    }
  },
  {
    id: 8,
    timestamp: "2026-01-27 10:05:10",
    user: "Admin User",
    role: "Administrator",
    action: "Added User",
    details: "Added new requester: John Reyes",
    fullDetails: {
      ipAddress: "192.168.1.10",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      previousValue: "N/A",
      newValue: "john.reyes@spcathedral.org",
      affectedUsers: ["John Reyes"],
      systemNotes: "New user account created. Welcome email sent with login credentials."
    }
  },
];

export function AuditLogPage() {
  const [filterRole, setFilterRole] = useState<string>("All");
  const [filterDate, setFilterDate] = useState<string>("");
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const filteredLogs = mockAuditLog.filter((entry) => {
    const roleMatch = filterRole === "All" || entry.role === filterRole;
    const dateMatch = !filterDate || entry.timestamp.startsWith(filterDate);
    return roleMatch && dateMatch;
  });

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
              <option value="Requester">Requester</option>
              <option value="Approver">Approver</option>
              <option value="Administrator">Administrator</option>
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
              setFilterDate("");
            }}
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-slate-200/60 flex items-center gap-2">
          <Activity className="w-5 h-5 text-slate-600" />
          <h2 className="font-semibold text-slate-900 text-lg">
            Activity Log
          </h2>
          <span className="ml-auto px-3 py-1 bg-slate-100 text-slate-700 text-sm font-medium rounded-full">
            {filteredLogs.length} entries
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
              {filteredLogs.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-900 whitespace-nowrap font-mono">
                    {entry.timestamp}
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

        {filteredLogs.length === 0 && (
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
              {mockAuditLog.length}
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-6 hover:shadow-xl transition-shadow">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Requests Submitted</p>
            <p className="text-3xl font-semibold text-slate-900">4</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-6 hover:shadow-xl transition-shadow">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Approvals Made</p>
            <p className="text-3xl font-semibold text-slate-900">2</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-6 hover:shadow-xl transition-shadow">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Average Turnaround</p>
            <p className="text-3xl font-semibold text-slate-900">2.3 days</p>
          </div>
        </div>
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

                    {selectedEntry.fullDetails.requestId && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Request ID</p>
                        <p className="text-sm font-mono text-slate-900">{selectedEntry.fullDetails.requestId}</p>
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
