import { useCallback, useEffect, useState } from "react";
import { MapPin, Clock, CheckCircle2, Calendar, List, ChevronLeft, ChevronRight, X, User, UserCheck, RefreshCw } from "lucide-react";
import api from "../../lib/api";
import { fetchVenues } from "../../lib/venues";

interface BookedSlot {
  date: string;
  time: string;
  purpose: string;
  status: "Approved" | "Pending";
  requester: string;
  requesterEmail: string;
  approver?: string;
  approvedDate?: string;
  requestId: string;
  attendees?: number;
}

function formatTimeFromDateTime(startDateTime: string, endDateTime: string): string {
  try {
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    const startHour = start.getHours().toString().padStart(2, '0');
    const startMin = start.getMinutes().toString().padStart(2, '0');
    const endHour = end.getHours().toString().padStart(2, '0');
    const endMin = end.getMinutes().toString().padStart(2, '0');
    return `${startHour}:${startMin} - ${endHour}:${endMin}`;
  } catch {
    return "N/A";
  }
}

function formatDate(dateTime: string): string {
  try {
    const date = new Date(dateTime);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return "N/A";
  }
}

function getLastApprovalAction(approvalActions: any[]): { approver?: string; approvedDate?: string } {
  if (!approvalActions || approvalActions.length === 0) return {};
  const lastAction = approvalActions[approvalActions.length - 1];
  return {
    approver: lastAction.approver?.name,
    approvedDate: formatDate(lastAction.createdAt),
  };
}

interface ApiResponse {
  requests: Array<{
    id: string;
    eventName: string;
    purpose: string;
    startDateTime: string;
    endDateTime: string;
    status: "APPROVED" | "PENDING";
    attendees: number;
    requester: { name: string; email: string };
    venue: { name: string };
    approvalActions: any[];
  }>;
}

function convertToBookedSlot(request: ApiResponse['requests'][0]): BookedSlot {
  const approvalInfo = getLastApprovalAction(request.approvalActions);
  return {
    requestId: request.id,
    date: formatDate(request.startDateTime),
    time: formatTimeFromDateTime(request.startDateTime, request.endDateTime),
    purpose: request.purpose,
    status: request.status === "APPROVED" ? "Approved" : "Pending",
    requester: request.requester.name,
    requesterEmail: request.requester.email,
    approver: approvalInfo.approver,
    approvedDate: approvalInfo.approvedDate,
    attendees: request.attendees,
  };
}

export function VenueAvailability() {
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [venues, setVenues] = useState<string[]>([]);
  const [bookingsByVenue, setBookingsByVenue] = useState<Record<string, BookedSlot[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayBookings, setSelectedDayBookings] = useState<BookedSlot[] | null>(null);

  const loadAvailability = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError(null);

      const [availabilityResponse, liveVenues] = await Promise.all([
        api.get<ApiResponse>("/requests/availability"),
        fetchVenues(),
      ]);

      const grouped: Record<string, BookedSlot[]> = {};
      const venueSet = new Set<string>();

      for (const venue of liveVenues) {
        if (venue.name) {
          venueSet.add(venue.name);
        }
      }

      for (const request of availabilityResponse.requests || []) {
        const slot = convertToBookedSlot(request);
        const venueName = request.venue.name;

        if (!grouped[venueName]) {
          grouped[venueName] = [];
        }

        grouped[venueName].push(slot);
        venueSet.add(venueName);
      }

      Object.keys(grouped).forEach((venue) => {
        grouped[venue].sort((a, b) => {
          const left = new Date(`${a.date}T${a.time.slice(0, 5)}:00`).getTime();
          const right = new Date(`${b.date}T${b.time.slice(0, 5)}:00`).getTime();
          return left - right;
        });
      });

      const sortedVenues = Array.from(venueSet).sort((a, b) => a.localeCompare(b));

      setBookingsByVenue(grouped);
      setVenues(sortedVenues);
      setSelectedVenue((previous) => {
        if (previous && sortedVenues.includes(previous)) {
          return previous;
        }
        return sortedVenues[0] ?? null;
      });
      setSelectedDayBookings(null);
    } catch (err) {
      console.error("Failed to load availability:", err);
      setError("Unable to load venue availability. Please try again later.");
      setVenues([]);
      setBookingsByVenue({});
      setSelectedVenue(null);
      setSelectedDayBookings(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAvailability("initial");

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void loadAvailability("refresh");
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [loadAvailability]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading venue availability...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 text-center">
        <p className="text-rose-700 font-medium">{error}</p>
      </div>
    );
  }

  const bookedSlots = selectedVenue ? (bookingsByVenue[selectedVenue] || []) : [];

  // Helper function to get days in month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  // Helper function to get first day of month (0 = Sunday, 1 = Monday, etc.)
  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  // Helper function to check if a date has bookings
  const getBookingsForDate = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bookedSlots.filter(slot => slot.date === dateStr);
  };

  // Navigate to previous month
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Get month name
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const currentMonthName = monthNames[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();

  // Build calendar grid
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const calendarDays = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-semibold text-slate-900 mb-3 tracking-tight">
          Venue Availability
        </h1>
        <p className="text-lg text-slate-600">
          View current bookings and available time slots (Read-only)
        </p>
      </div>

      {/* Controls: Venue Selector and View Toggle */}
      <div className="mb-8 flex items-end justify-between gap-6">
        {/* Venue Selector */}
        <div className="flex-1">
          <label
            htmlFor="venue-select"
            className="block text-sm font-semibold text-slate-700 mb-2"
          >
            Select Venue
          </label>
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-slate-400" />
            <select
              id="venue-select"
              value={selectedVenue || ""}
              onChange={(e) => setSelectedVenue(e.target.value)}
              className="px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              {venues.map((venue) => (
                <option key={venue} value={venue}>
                  {venue}
                </option>
              ))}
            </select>
            <button
              onClick={() => void loadAvailability("refresh")}
              disabled={isRefreshing}
              className="px-4 py-3 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 hover:border-blue-300 transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="text-sm font-semibold text-slate-700">
                {isRefreshing ? "Refreshing" : "Refresh"}
              </span>
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl">
          <button
            onClick={() => setViewMode("list")}
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
              viewMode === "list"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30"
                : "text-slate-700 hover:bg-slate-200"
            }`}
          >
            <List className="w-4 h-4" />
            List View
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
              viewMode === "calendar"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30"
                : "text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Calendar View
          </button>
        </div>
      </div>

      {/* List View */}
      {viewMode === "list" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900 text-xl">
              Schedule for {selectedVenue}
            </h2>
            <p className="text-sm text-slate-600 mt-1">All bookings for this venue</p>
          </div>

          {bookedSlots.length > 0 ? (
            <div className="p-8">
              <div className="space-y-4">
                {bookedSlots.map((slot, index) => (
                  <div
                    key={index}
                    className="border-2 border-slate-200 rounded-xl p-6 bg-gradient-to-br from-slate-50 to-white hover:shadow-lg hover:border-blue-300 transition-all"
                  >
                    {/* Header with Request ID and Status */}
                    <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-200">
                      <span className="text-sm font-bold text-slate-600">
                        {slot.requestId}
                      </span>
                      <span
                        className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-full ${
                          slot.status === "Approved"
                            ? "bg-emerald-600 text-white"
                            : "bg-amber-600 text-white"
                        }`}
                      >
                        {slot.status === "Approved" && <CheckCircle2 className="w-4 h-4" />}
                        {slot.status === "Pending" && <Clock className="w-4 h-4" />}
                        {slot.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-6 mb-5">
                      <div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Date</p>
                        <p className="text-sm font-bold text-slate-900">
                          {slot.date}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Time</p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-500" />
                          <p className="text-sm font-semibold text-slate-900">
                            {slot.time}
                          </p>
                        </div>
                      </div>
                      {slot.attendees && (
                        <div>
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Attendees</p>
                          <p className="text-sm font-semibold text-slate-900">
                            {slot.attendees} people
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mb-5 pb-5 border-b border-slate-200">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Purpose</p>
                      <p className="text-sm text-slate-900 font-medium">{slot.purpose}</p>
                    </div>

                    {/* Requester and Approver */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Requested By</p>
                        <div className="flex items-start gap-2 bg-white p-3 rounded-lg border border-slate-200">
                          <User className="w-4 h-4 text-blue-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {slot.requester}
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {slot.requesterEmail}
                            </p>
                          </div>
                        </div>
                      </div>

                      {slot.status === "Approved" && slot.approver && (
                        <div>
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Approved By</p>
                          <div className="flex items-start gap-2 bg-white p-3 rounded-lg border border-emerald-200">
                            <UserCheck className="w-4 h-4 text-emerald-600 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {slot.approver}
                              </p>
                              {slot.approvedDate && (
                                <p className="text-xs text-slate-600 mt-0.5">
                                  {slot.approvedDate}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {slot.status === "Pending" && (
                        <div>
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Status</p>
                          <div className="bg-amber-100 border border-amber-300 rounded-lg p-3">
                            <p className="text-xs text-amber-800 font-medium">
                              Awaiting approval
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-8 pt-6 border-t-2 border-slate-200">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4">Legend:</p>
                <div className="flex gap-8 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-emerald-100 border-2 border-emerald-400 rounded-full"></span>
                    <span className="text-slate-700 font-medium">Booked (Approved)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-amber-100 border-2 border-amber-400 rounded-full"></span>
                    <span className="text-slate-700 font-medium">Pending Approval</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-slate-100 to-blue-50 rounded-full mb-6 shadow-lg shadow-slate-900/10">
                <Calendar className="w-10 h-10 text-slate-500" />
              </div>
              <p className="text-slate-900 font-semibold text-lg">
                No bookings found for {selectedVenue}
              </p>
              <p className="text-slate-500 mt-2">
                All time slots are currently available
              </p>
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
          {/* Calendar Header */}
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 text-xl">
                {selectedVenue} - {currentMonthName} {currentYear}
              </h2>
              <p className="text-sm text-slate-600 mt-1">Click on a date to see booking details</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={previousMonth}
                className="p-2.5 bg-white border-2 border-slate-200 rounded-lg hover:bg-slate-50 hover:border-blue-300 transition-all"
              >
                <ChevronLeft className="w-5 h-5 text-slate-700" />
              </button>
              <button
                onClick={nextMonth}
                className="p-2.5 bg-white border-2 border-slate-200 rounded-lg hover:bg-slate-50 hover:border-blue-300 transition-all"
              >
                <ChevronRight className="w-5 h-5 text-slate-700" />
              </button>
            </div>
          </div>

          <div className="p-8">
            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-2 mb-3">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center py-3 font-bold text-sm text-slate-600 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const bookings = getBookingsForDate(day);
                const hasBookings = bookings.length > 0;
                const hasApproved = bookings.some(b => b.status === "Approved");
                const hasPending = bookings.some(b => b.status === "Pending");

                return (
                  <div
                    key={day}
                    onClick={() => hasBookings && setSelectedDayBookings(bookings)}
                    className={`aspect-square border-2 rounded-xl p-3 transition-all group relative ${
                      hasBookings
                        ? hasApproved && hasPending
                          ? "border-amber-300 bg-gradient-to-br from-emerald-50 to-amber-50 hover:shadow-lg hover:scale-105 cursor-pointer"
                          : hasApproved
                          ? "border-emerald-300 bg-emerald-50 hover:shadow-lg hover:scale-105 cursor-pointer"
                          : "border-amber-300 bg-amber-50 hover:shadow-lg hover:scale-105 cursor-pointer"
                        : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    <div className="flex flex-col h-full">
                      <span className={`text-sm font-bold mb-1 ${
                        hasBookings ? "text-slate-900" : "text-slate-600"
                      }`}>
                        {day}
                      </span>
                      {hasBookings && (
                        <div className="flex-1 flex flex-col justify-center items-center">
                          <div className="flex gap-1 mb-1">
                            {hasApproved && (
                              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            )}
                            {hasPending && (
                              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                            )}
                          </div>
                          <span className="text-xs font-bold text-slate-700">
                            {bookings.length} event{bookings.length > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Tooltip on hover */}
                    {hasBookings && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl min-w-[200px]">
                          <p className="font-bold mb-2 border-b border-slate-700 pb-2">
                            {currentMonthName} {day}, {currentYear}
                          </p>
                          {bookings.map((booking, idx) => (
                            <div key={idx} className={`${idx > 0 ? 'mt-2 pt-2 border-t border-slate-700' : ''}`}>
                              <p className="font-semibold">{booking.time}</p>
                              <p className="text-slate-300 mt-0.5">{booking.purpose}</p>
                              <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                                booking.status === "Approved"
                                  ? "bg-emerald-500"
                                  : "bg-amber-500"
                              }`}>
                                {booking.status}
                              </span>
                            </div>
                          ))}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900"></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Calendar Legend */}
            <div className="mt-8 pt-6 border-t-2 border-slate-200">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4">Legend:</p>
              <div className="flex gap-8 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-emerald-50 border-2 border-emerald-300 rounded"></span>
                  <span className="text-slate-700 font-medium">Approved Booking</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-amber-50 border-2 border-amber-300 rounded"></span>
                  <span className="text-slate-700 font-medium">Pending Approval</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-white border-2 border-slate-200 rounded"></span>
                  <span className="text-slate-700 font-medium">Available</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {selectedDayBookings && selectedDayBookings.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 flex items-center justify-between sticky top-0 z-10">
              <div>
                <h3 className="font-semibold text-white text-xl">Event Details</h3>
                <p className="text-sm text-blue-100 mt-1">
                  {selectedDayBookings[0].date} • {selectedVenue}
                </p>
              </div>
              <button
                onClick={() => setSelectedDayBookings(null)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8">
              <div className="space-y-6">
                {selectedDayBookings.map((booking, index) => (
                  <div
                    key={index}
                    className={`border-2 rounded-xl p-6 ${
                      booking.status === "Approved"
                        ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white"
                        : "border-amber-300 bg-gradient-to-br from-amber-50 to-white"
                    } ${index > 0 ? 'mt-6' : ''}`}
                  >
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-6">
                      <span
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-full ${
                          booking.status === "Approved"
                            ? "bg-emerald-600 text-white"
                            : "bg-amber-600 text-white"
                        }`}
                      >
                        {booking.status === "Approved" && <CheckCircle2 className="w-4 h-4" />}
                        {booking.status === "Pending" && <Clock className="w-4 h-4" />}
                        {booking.status}
                      </span>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Time</p>
                        <p className="text-sm font-semibold text-slate-900">{booking.time}</p>
                      </div>
                      {booking.attendees && (
                        <div>
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Attendees</p>
                          <p className="text-sm font-semibold text-slate-900">{booking.attendees} people</p>
                        </div>
                      )}
                    </div>

                    <div className="mb-6 pb-6 border-b border-slate-300">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Purpose</p>
                      <p className="text-sm text-slate-900">{booking.purpose}</p>
                    </div>

                    {/* Requester Info */}
                    <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-slate-200">
                      <User className="w-4 h-4 text-blue-600 mt-1" />
                      <div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Requested By</p>
                        <p className="text-sm font-semibold text-slate-900">{booking.requester}</p>
                        <p className="text-xs text-slate-600 mt-0.5">{booking.requesterEmail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
