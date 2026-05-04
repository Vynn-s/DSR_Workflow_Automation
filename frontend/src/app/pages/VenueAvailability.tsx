import { useState } from "react";
import { MapPin, Clock, CheckCircle2, Calendar, List, ChevronLeft, ChevronRight, X, User, UserCheck } from "lucide-react";

// Mock data for venue schedules
const venues = [
  "Main Chapel",
  "Parish Hall",
  "Multipurpose Room",
  "Chapel Garden",
  "Conference Room",
  "Youth Center",
];

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

// Mock booked slots with more dates for calendar view
const mockBookedSlots: Record<string, BookedSlot[]> = {
  "Main Chapel": [
    {
      requestId: "REQ-101",
      date: "2026-02-15",
      time: "10:00 AM - 12:00 PM",
      purpose: "Wedding Ceremony",
      status: "Approved",
      requester: "Maria Santos",
      requesterEmail: "maria.santos@email.com",
      approver: "Bishop Antonio",
      approvedDate: "2026-02-01",
      attendees: 200,
    },
    {
      requestId: "REQ-102",
      date: "2026-02-22",
      time: "9:00 AM - 11:00 AM",
      purpose: "Sunday Mass",
      status: "Approved",
      requester: "Fr. Michael Santos",
      requesterEmail: "fr.michael@spcathedral.org",
      approver: "Bishop Antonio",
      approvedDate: "2026-02-10",
      attendees: 500,
    },
    {
      requestId: "REQ-103",
      date: "2026-02-08",
      time: "2:00 PM - 4:00 PM",
      purpose: "Baptism Ceremony",
      status: "Approved",
      requester: "John Reyes",
      requesterEmail: "john.reyes@email.com",
      approver: "Fr. Michael Santos",
      approvedDate: "2026-01-25",
      attendees: 50,
    },
    {
      requestId: "REQ-104",
      date: "2026-02-28",
      time: "3:00 PM - 5:00 PM",
      purpose: "First Communion",
      status: "Pending",
      requester: "Teresa Martinez",
      requesterEmail: "teresa.m@email.com",
      attendees: 80,
    },
    {
      requestId: "REQ-105",
      date: "2026-03-07",
      time: "10:00 AM - 12:00 PM",
      purpose: "Wedding Ceremony",
      status: "Approved",
      requester: "Carlos Dela Cruz",
      requesterEmail: "carlos.dc@email.com",
      approver: "Bishop Antonio",
      approvedDate: "2026-02-20",
      attendees: 250,
    },
    {
      requestId: "REQ-106",
      date: "2026-03-14",
      time: "4:00 PM - 6:00 PM",
      purpose: "Confirmation Mass",
      status: "Approved",
      requester: "Fr. Michael Santos",
      requesterEmail: "fr.michael@spcathedral.org",
      approver: "Bishop Antonio",
      approvedDate: "2026-03-01",
      attendees: 150,
    },
  ],
  "Parish Hall": [
    {
      requestId: "REQ-201",
      date: "2026-02-20",
      time: "2:00 PM - 5:00 PM",
      purpose: "Youth Ministry Meeting",
      status: "Pending",
      requester: "Fr. Michael Santos",
      requesterEmail: "fr.michael@spcathedral.org",
      attendees: 60,
    },
    {
      requestId: "REQ-202",
      date: "2026-02-18",
      time: "6:00 PM - 9:00 PM",
      purpose: "Community Dinner",
      status: "Approved",
      requester: "Maria Cruz",
      requesterEmail: "maria.cruz@spcathedral.org",
      approver: "Sr. Teresa",
      approvedDate: "2026-02-05",
      attendees: 120,
    },
    {
      requestId: "REQ-203",
      date: "2026-02-05",
      time: "5:00 PM - 8:00 PM",
      purpose: "Parish Council Meeting",
      status: "Approved",
      requester: "Admin User",
      requesterEmail: "admin@spcathedral.org",
      approver: "Bishop Antonio",
      approvedDate: "2026-01-28",
      attendees: 30,
    },
    {
      requestId: "REQ-204",
      date: "2026-02-12",
      time: "7:00 PM - 9:00 PM",
      purpose: "Bible Study Group",
      status: "Approved",
      requester: "John Reyes",
      requesterEmail: "john.reyes@spcathedral.org",
      approver: "Fr. Michael Santos",
      approvedDate: "2026-02-01",
      attendees: 25,
    },
    {
      requestId: "REQ-205",
      date: "2026-02-25",
      time: "3:00 PM - 6:00 PM",
      purpose: "Children's Ministry Event",
      status: "Approved",
      requester: "Sr. Maria Lopez",
      requesterEmail: "sr.maria@spcathedral.org",
      approver: "Sr. Teresa",
      approvedDate: "2026-02-15",
      attendees: 75,
    },
    {
      requestId: "REQ-206",
      date: "2026-03-03",
      time: "6:00 PM - 9:00 PM",
      purpose: "Fundraising Dinner",
      status: "Pending",
      requester: "Roberto Cruz",
      requesterEmail: "roberto.c@spcathedral.org",
      attendees: 100,
    },
  ],
  "Multipurpose Room": [
    {
      requestId: "REQ-301",
      date: "2026-02-10",
      time: "3:00 PM - 5:00 PM",
      purpose: "Choir Practice",
      status: "Approved",
      requester: "Music Director",
      requesterEmail: "music@spcathedral.org",
      approver: "Fr. Michael Santos",
      approvedDate: "2026-02-01",
      attendees: 40,
    },
    {
      requestId: "REQ-302",
      date: "2026-02-17",
      time: "3:00 PM - 5:00 PM",
      purpose: "Choir Practice",
      status: "Approved",
      requester: "Music Director",
      requesterEmail: "music@spcathedral.org",
      approver: "Fr. Michael Santos",
      approvedDate: "2026-02-01",
      attendees: 40,
    },
    {
      requestId: "REQ-303",
      date: "2026-02-24",
      time: "3:00 PM - 5:00 PM",
      purpose: "Choir Practice",
      status: "Approved",
      requester: "Music Director",
      requesterEmail: "music@spcathedral.org",
      approver: "Fr. Michael Santos",
      approvedDate: "2026-02-01",
      attendees: 40,
    },
    {
      requestId: "REQ-304",
      date: "2026-03-10",
      time: "2:00 PM - 4:00 PM",
      purpose: "Music Rehearsal",
      status: "Approved",
      requester: "Music Director",
      requesterEmail: "music@spcathedral.org",
      approver: "Fr. Michael Santos",
      approvedDate: "2026-03-01",
      attendees: 35,
    },
  ],
  "Chapel Garden": [
    {
      requestId: "REQ-401",
      date: "2026-03-05",
      time: "3:00 PM - 6:00 PM",
      purpose: "Baptism Reception",
      status: "Pending",
      requester: "Maria Cruz",
      requesterEmail: "maria.cruz@email.com",
      attendees: 60,
    },
    {
      requestId: "REQ-402",
      date: "2026-02-14",
      time: "11:00 AM - 2:00 PM",
      purpose: "Wedding Reception",
      status: "Approved",
      requester: "Anna Rodriguez",
      requesterEmail: "anna.r@email.com",
      approver: "Sr. Teresa",
      approvedDate: "2026-01-30",
      attendees: 150,
    },
    {
      requestId: "REQ-403",
      date: "2026-03-21",
      time: "1:00 PM - 4:00 PM",
      purpose: "Garden Party",
      status: "Approved",
      requester: "Parish Events Committee",
      requesterEmail: "events@spcathedral.org",
      approver: "Bishop Antonio",
      approvedDate: "2026-03-10",
      attendees: 80,
    },
  ],
  "Conference Room": [
    {
      requestId: "REQ-501",
      date: "2026-02-06",
      time: "10:00 AM - 12:00 PM",
      purpose: "Staff Meeting",
      status: "Approved",
      requester: "Admin User",
      requesterEmail: "admin@spcathedral.org",
      approver: "Bishop Antonio",
      approvedDate: "2026-01-28",
      attendees: 15,
    },
    {
      requestId: "REQ-502",
      date: "2026-02-13",
      time: "2:00 PM - 4:00 PM",
      purpose: "Finance Committee",
      status: "Approved",
      requester: "Roberto Cruz",
      requesterEmail: "roberto.c@spcathedral.org",
      approver: "Bishop Antonio",
      approvedDate: "2026-02-01",
      attendees: 10,
    },
    {
      requestId: "REQ-503",
      date: "2026-02-27",
      time: "9:00 AM - 11:00 AM",
      purpose: "Planning Session",
      status: "Pending",
      requester: "Sr. Maria Lopez",
      requesterEmail: "sr.maria@spcathedral.org",
      attendees: 12,
    },
  ],
  "Youth Center": [
    {
      requestId: "REQ-601",
      date: "2026-02-07",
      time: "4:00 PM - 7:00 PM",
      purpose: "Youth Group Meeting",
      status: "Approved",
      requester: "Youth Ministry Coordinator",
      requesterEmail: "youth@spcathedral.org",
      approver: "Fr. Michael Santos",
      approvedDate: "2026-01-25",
      attendees: 50,
    },
    {
      requestId: "REQ-602",
      date: "2026-02-14",
      time: "5:00 PM - 8:00 PM",
      purpose: "Game Night",
      status: "Approved",
      requester: "Youth Ministry Coordinator",
      requesterEmail: "youth@spcathedral.org",
      approver: "Fr. Michael Santos",
      approvedDate: "2026-02-01",
      attendees: 65,
    },
    {
      requestId: "REQ-603",
      date: "2026-02-21",
      time: "4:00 PM - 7:00 PM",
      purpose: "Youth Group Meeting",
      status: "Approved",
      requester: "Youth Ministry Coordinator",
      requesterEmail: "youth@spcathedral.org",
      approver: "Fr. Michael Santos",
      approvedDate: "2026-02-10",
      attendees: 50,
    },
    {
      requestId: "REQ-604",
      date: "2026-03-15",
      time: "3:00 PM - 6:00 PM",
      purpose: "Teen Workshop",
      status: "Pending",
      requester: "Youth Ministry Coordinator",
      requesterEmail: "youth@spcathedral.org",
      attendees: 40,
    },
  ],
};

export function VenueAvailability() {
  const [selectedVenue, setSelectedVenue] = useState("Main Chapel");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 1)); // February 2026
  const [selectedDayBookings, setSelectedDayBookings] = useState<BookedSlot[] | null>(null);

  const bookedSlots = mockBookedSlots[selectedVenue] || [];

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
              value={selectedVenue}
              onChange={(e) => setSelectedVenue(e.target.value)}
              className="px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              {venues.map((venue) => (
                <option key={venue} value={venue}>
                  {venue}
                </option>
              ))}
            </select>
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
                      <span className="text-sm font-semibold text-slate-600">
                        {booking.requestId}
                      </span>
                    </div>

                    {/* Event Information Grid */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                          Time
                        </p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-5 h-5 text-slate-500" />
                          <p className="text-base font-semibold text-slate-900">
                            {booking.time}
                          </p>
                        </div>
                      </div>

                      {booking.attendees && (
                        <div>
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                            Expected Attendees
                          </p>
                          <p className="text-base font-semibold text-slate-900">
                            {booking.attendees} people
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Purpose */}
                    <div className="mb-6 pb-6 border-b border-slate-200">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                        Purpose
                      </p>
                      <p className="text-base text-slate-900 font-medium">
                        {booking.purpose}
                      </p>
                    </div>

                    {/* Requester Information */}
                    <div className="mb-6">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                        Requested By
                      </p>
                      <div className="flex items-start gap-3 bg-white p-4 rounded-lg border border-slate-200">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">
                            {booking.requester}
                          </p>
                          <p className="text-sm text-slate-600 mt-0.5">
                            {booking.requesterEmail}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Approver Information */}
                    {booking.status === "Approved" && booking.approver && (
                      <div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                          Approved By
                        </p>
                        <div className="flex items-start gap-3 bg-white p-4 rounded-lg border border-emerald-200">
                          <div className="p-2 bg-emerald-100 rounded-lg">
                            <UserCheck className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">
                              {booking.approver}
                            </p>
                            {booking.approvedDate && (
                              <p className="text-sm text-slate-600 mt-0.5">
                                Approved on {booking.approvedDate}
                              </p>
                            )}
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                      </div>
                    )}

                    {/* Pending Notice */}
                    {booking.status === "Pending" && (
                      <div className="bg-amber-100 border border-amber-300 rounded-lg p-4">
                        <p className="text-sm text-amber-800 font-medium">
                          ⏳ This booking is awaiting approval from an authorized approver.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 px-8 py-5 bg-slate-50">
              <button
                onClick={() => setSelectedDayBookings(null)}
                className="w-full px-6 py-3.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl hover:from-slate-900 hover:to-black transition-all shadow-lg shadow-slate-900/30 font-medium"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}