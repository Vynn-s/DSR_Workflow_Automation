import { useEffect, useState } from "react";
import { Users, Building2, Brain, BarChart3, TrendingUp, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fetchVenues, type LiveVenue } from "../../lib/venues";

// Mock data
const users = [
  { id: 1, name: "Fr. Michael Santos", email: "fr.michael@spcathedral.org", role: "Requester" },
  { id: 2, name: "Maria Cruz", email: "maria.cruz@spcathedral.org", role: "Requester" },
  { id: 3, name: "John Reyes", email: "john.reyes@spcathedral.org", role: "Requester" },
  { id: 4, name: "Bishop Antonio", email: "bishop@spcathedral.org", role: "Approver" },
  { id: 5, name: "Sr. Teresa", email: "sr.teresa@spcathedral.org", role: "Approver" },
  { id: 6, name: "Admin User", email: "admin@spcathedral.org", role: "Administrator" },
];

// Weekly data
const weeklyData = [
  { day: "Mon", requests: 4, approved: 3, rejected: 1 },
  { day: "Tue", requests: 6, approved: 5, rejected: 1 },
  { day: "Wed", requests: 3, approved: 2, rejected: 1 },
  { day: "Thu", requests: 8, approved: 6, rejected: 2 },
  { day: "Fri", requests: 5, approved: 4, rejected: 1 },
  { day: "Sat", requests: 7, approved: 6, rejected: 1 },
  { day: "Sun", requests: 9, approved: 8, rejected: 1 },
];

// Monthly data
const monthlyData = [
  { week: "Week 1", requests: 24, approved: 18, rejected: 6 },
  { week: "Week 2", requests: 28, approved: 22, rejected: 6 },
  { week: "Week 3", requests: 32, approved: 28, rejected: 4 },
  { week: "Week 4", requests: 26, approved: 20, rejected: 6 },
];

// Yearly data
const yearlyData = [
  { month: "Jan", requests: 85, approved: 72, rejected: 13 },
  { month: "Feb", requests: 92, approved: 80, rejected: 12 },
  { month: "Mar", requests: 78, approved: 65, rejected: 13 },
  { month: "Apr", requests: 88, approved: 75, rejected: 13 },
  { month: "May", requests: 95, approved: 85, rejected: 10 },
  { month: "Jun", requests: 102, approved: 90, rejected: 12 },
  { month: "Jul", requests: 88, approved: 78, rejected: 10 },
  { month: "Aug", requests: 90, approved: 80, rejected: 10 },
  { month: "Sep", requests: 98, approved: 88, rejected: 10 },
  { month: "Oct", requests: 105, approved: 95, rejected: 10 },
  { month: "Nov", requests: 110, approved: 98, rejected: 12 },
  { month: "Dec", requests: 120, approved: 108, rejected: 12 },
];

// DSS Insights
const dssInsights = {
  peakDemand: {
    day: "Sunday",
    time: "10:00 AM - 12:00 PM",
    venue: "Main Chapel"
  },
  efficiency: {
    avgApprovalTime: "4.5 hours",
    approvalRate: "89%",
    trend: "improving"
  },
  recommendations: [
    "Consider adding more time slots on Sundays for Main Chapel",
    "Approval time has improved by 15% this month",
    "Youth Center has lowest utilization (35%) - promote availability"
  ],
  risks: [
    "Main Chapel overbooked - 95% capacity utilization",
    "2 approvers on leave next week may cause delays"
  ]
};

export function AdminDashboard() {
  const [reportView, setReportView] = useState<"weekly" | "monthly" | "yearly">("weekly");
  const [venues, setVenues] = useState<Array<LiveVenue & { status: string }>>([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venuesError, setVenuesError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadVenues() {
      try {
        setVenuesLoading(true);
        setVenuesError(null);

        const liveVenues = await fetchVenues();

        if (isMounted) {
          setVenues(liveVenues.map((venue) => ({ ...venue, status: "Active" })));
        }
      } catch (error) {
        console.error("Failed to load venues:", error);
        if (isMounted) {
          setVenues([]);
          setVenuesError("Unable to load venue data right now.");
        }
      } finally {
        if (isMounted) {
          setVenuesLoading(false);
        }
      }
    }

    void loadVenues();

    return () => {
      isMounted = false;
    };
  }, []);

  const getCurrentData = () => {
    switch (reportView) {
      case "weekly":
        return weeklyData;
      case "monthly":
        return monthlyData;
      case "yearly":
        return yearlyData;
      default:
        return weeklyData;
    }
  };

  const getXAxisKey = () => {
    switch (reportView) {
      case "weekly":
        return "day";
      case "monthly":
        return "week";
      case "yearly":
        return "month";
      default:
        return "day";
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-semibold text-slate-900 mb-3 tracking-tight">
          Administrator Dashboard
        </h1>
        <p className="text-lg text-slate-600">
          Manage users, venues, and view system reports
        </p>
      </div>

      {/* DSS Insights Panel */}
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
                {/* Peak Demand */}
                <div className="bg-white rounded-xl p-5 border-2 border-indigo-200 shadow-lg shadow-indigo-900/10">
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    Peak Demand
                  </p>
                  <p className="text-sm text-slate-900 mb-1.5 font-medium">
                    <span className="font-bold">{dssInsights.peakDemand.day}</span> • {dssInsights.peakDemand.time}
                  </p>
                  <p className="text-xs text-slate-600 font-medium">{dssInsights.peakDemand.venue}</p>
                </div>

                {/* Efficiency Metrics */}
                <div className="bg-white rounded-xl p-5 border-2 border-indigo-200 shadow-lg shadow-indigo-900/10">
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    System Efficiency
                  </p>
                  <p className="text-sm text-slate-900 mb-1.5 font-medium">
                    Approval: <span className="font-bold">{dssInsights.efficiency.avgApprovalTime}</span>
                  </p>
                  <p className="text-xs text-slate-600 font-medium">Rate: {dssInsights.efficiency.approvalRate}</p>
                </div>

                {/* Status */}
                <div className="bg-white rounded-xl p-5 border-2 border-indigo-200 shadow-lg shadow-indigo-900/10">
                  <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3">System Status</p>
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-bold text-slate-900">All Systems Operational</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium">Trend: {dssInsights.efficiency.trend}</p>
                </div>
              </div>

              {/* Recommendations & Risks */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Recommendations
                  </h4>
                  <ul className="space-y-1.5">
                    {dssInsights.recommendations.map((rec, index) => (
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
                    {dssInsights.risks.map((risk, index) => (
                      <li key={index} className="text-xs text-slate-700 flex items-start gap-2">
                        <span className="text-amber-600 mt-0.5">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reports with Chart */}
      <div className="mb-10">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 text-xl">
                  Booking Request Analytics
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">Track booking trends over time</p>
              </div>
            </div>

            {/* View Toggle */}
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
              <BarChart data={getCurrentData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey={getXAxisKey()} 
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#64748b"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '12px' }}
                />
                <Bar dataKey="requests" fill="#3b82f6" name="Total Requests" radius={[4, 4, 0, 0]} />
                <Bar dataKey="approved" fill="#10b981" name="Approved" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rejected" fill="#ef4444" name="Rejected" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* User Management */}
      <div className="mb-10">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-purple-50/30 border-b border-slate-200 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 text-xl">User Management</h2>
              <p className="text-sm text-slate-600 mt-0.5">Manage system users and roles</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-5 text-sm font-semibold text-slate-900">
                      {user.id}
                    </td>
                    <td className="px-6 py-5 text-sm font-semibold text-slate-900">
                      {user.name}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-700">
                      {user.email}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center px-4 py-1.5 text-xs font-bold rounded-full border ${
                          user.role === "Administrator"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : user.role === "Approver"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Venue List Management */}
      <div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-emerald-50/30 border-b border-slate-200 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Building2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 text-xl">Venue Management</h2>
              <p className="text-sm text-slate-600 mt-0.5">Configure and manage venue facilities</p>
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
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Venue Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Capacity
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {venues.map((venue) => (
                    <tr key={venue.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5 text-sm font-semibold text-slate-900">
                        {venue.id}
                      </td>
                      <td className="px-6 py-5 text-sm font-semibold text-slate-900">
                        {venue.name}
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-700">
                        {venue.capacity} people
                      </td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center px-4 py-1.5 text-xs font-bold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                          {venue.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
