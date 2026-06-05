import { useState } from "react";
import { MapPin, Plus, Edit2, Trash2, Check, X, Calendar as CalendarIcon } from "lucide-react";
import { useEffect } from "react";
import api from "../../lib/api";

interface BookedSlot {
  id: string;
  date: string;
  time: string;
  purpose: string;
  status: "Approved" | "Pending" | "Cancelled";
  requester: string;
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

interface ApiResponse {
  requests: Array<{
    id: string;
    eventName: string;
    purpose: string;
    startDateTime: string;
    endDateTime: string;
    status: "APPROVED" | "PENDING";
    requester: { name: string };
    venue: { name: string };
  }>;
}

function convertToBookedSlot(request: ApiResponse['requests'][0]): BookedSlot {
  return {
    id: request.id,
    date: formatDate(request.startDateTime),
    time: formatTimeFromDateTime(request.startDateTime, request.endDateTime),
    purpose: request.purpose,
    status: request.status === "APPROVED" ? "Approved" : "Pending",
    requester: request.requester.name,
  };
}
export function AdminVenueAvailability() {
  const [selectedVenue, setSelectedVenue] = useState("Mezzanine Hall A");
  const [venues, setVenues] = useState<string[]>([]);
  const [bookingsByVenue, setBookingsByVenue] = useState<Record<string, BookedSlot[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingSlot, setIsAddingSlot] = useState(false);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    date: "",
    startTime: "",
    endTime: "",
    purpose: "",
    requester: "",
    status: "Pending" as "Approved" | "Pending" | "Cancelled"
  });

  // Fetch availability on mount
  useEffect(() => {
    async function loadAvailability() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await api.get<ApiResponse>("/requests/availability");
        
        // Group requests by venue
        const grouped: Record<string, BookedSlot[]> = {};
        const venueSet = new Set<string>();
        
        for (const request of response.requests || []) {
          const slot = convertToBookedSlot(request);
          const venueName = request.venue.name;
          
          if (!grouped[venueName]) {
            grouped[venueName] = [];
          }
          grouped[venueName].push(slot);
          venueSet.add(venueName);
        }
        
        // Sort requests by date within each venue
        Object.keys(grouped).forEach(venue => {
          grouped[venue].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        });
        
        const sortedVenues = Array.from(venueSet).sort();
        setVenues(sortedVenues.length > 0 ? sortedVenues : ["Mezzanine Hall A", "Mezzanine Hall B", "Mezzanine Hall (Whole A & B)", "Socio Hall", "Auditorium", "Meeting Room 1", "Meeting Room 2", "Parish Rectory", "Blessed Sacrament Chapel", "Chapel of the Saints"]);
        setBookingsByVenue(grouped);
        
        // Ensure selected venue exists
        if (sortedVenues.length > 0) {
          setSelectedVenue(sortedVenues[0]);
        }
      } catch (err) {
        console.warn("Failed to load availability");
        setError("Unable to load venue availability. Please try again later.");
        setVenues(["Mezzanine Hall A", "Mezzanine Hall B", "Mezzanine Hall (Whole A & B)", "Socio Hall", "Auditorium", "Meeting Room 1", "Meeting Room 2", "Parish Rectory", "Blessed Sacrament Chapel", "Chapel of the Saints"]);
        setBookingsByVenue({});
      } finally {
        setIsLoading(false);
      }
    }

    void loadAvailability();
  }, []);
  const currentSlots = bookedSlots[selectedVenue] || [];

  const resetForm = () => {
    setFormData({
      date: "",
      startTime: "",
      endTime: "",
      purpose: "",
      requester: "",
      status: "Pending"
    });
    setIsAddingSlot(false);
    setEditingSlot(null);
  };

  const handleAdd = () => {
    if (!formData.date || !formData.startTime || !formData.endTime || !formData.purpose || !formData.requester) {
      alert("Please fill in all fields");
      return;
    }
      const currentSlots = bookingsByVenue[selectedVenue] || [];
    const newSlot: BookedSlot = {
      if (isLoading) {
        return (
          <div className="flex items-center justify-center p-16">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium">Loading venue availability...</p>
            </div>
          </div>
        );
      }
      id: `SLOT-${Date.now()}`,
      if (error) {
        return (
          <div className="p-10 text-center">
            <p className="text-red-400 font-medium">{error}</p>
          </div>
        );
      }
      date: formData.date,
      time: `${formData.startTime} - ${formData.endTime}`,
      purpose: formData.purpose,
      status: formData.status,
      requester: formData.requester
    };

    setBookingsByVenue({
      ...bookingsByVenue,
      [selectedVenue]: [...currentSlots, newSlot]
    });

    resetForm();
  };

  const handleUpdate = (slotId: string) => {
    if (!formData.date || !formData.startTime || !formData.endTime || !formData.purpose || !formData.requester) {
      alert("Please fill in all fields");
      return;
    }

    const updatedSlots = currentSlots.map(slot => 
      slot.id === slotId
        ? {
            ...slot,
            date: formData.date,
            time: `${formData.startTime} - ${formData.endTime}`,
            purpose: formData.purpose,
            status: formData.status,
            requester: formData.requester
          }
        : slot
    );

    setBookingsByVenue({
      ...bookingsByVenue,
      [selectedVenue]: updatedSlots
    });

    resetForm();
  };

  const handleDelete = (slotId: string) => {
    if (confirm("Are you sure you want to delete this booking?")) {
      const updatedSlots = currentSlots.filter(slot => slot.id !== slotId);
      setBookingsByVenue({
        ...bookingsByVenue,
        [selectedVenue]: updatedSlots
      });
    }
  };

  const handleStatusChange = (slotId: string, newStatus: "Approved" | "Pending" | "Cancelled") => {
    const updatedSlots = currentSlots.map(slot =>
      slot.id === slotId ? { ...slot, status: newStatus } : slot
    );

    setBookedSlots({
      ...bookedSlots,
      [selectedVenue]: updatedSlots
    });
  };

  const startEdit = (slot: BookedSlot) => {
    const [startTime, endTime] = slot.time.split(" - ");
    setFormData({
      date: slot.date,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      purpose: slot.purpose,
      requester: slot.requester,
      status: slot.status
    });
    setEditingSlot(slot.id);
    setIsAddingSlot(false);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mb-2 tracking-tight">
          Venue Availability Management
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Manage bookings and update venue availability
        </p>
      </div>

      {/* Venue Selector and Add Button */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label htmlFor="venue-select" className="text-xs text-zinc-500 dark:text-zinc-400">
            Select Venue
          </label>
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
            <select
              id="venue-select"
              value={selectedVenue}
              onChange={(e) => {
                setSelectedVenue(e.target.value);
                resetForm();
              }}
              className="bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0F3B8C] transition-colors duration-150"
            >
              {venues.map((venue) => (
                <option key={venue} value={venue}>
                  {venue}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => {
            setIsAddingSlot(true);
            setEditingSlot(null);
            resetForm();
          }}
          className="flex items-center gap-2 bg-white text-zinc-900 dark:bg-white dark:text-zinc-950 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:text-zinc-950 transition-colors duration-150"
        >
          <Plus className="w-4 h-4" />
          Add Booking
        </button>
      </div>

      {/* Add/Edit Form */}
      {(isAddingSlot || editingSlot) && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 p-6 mb-6">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            {editingSlot ? "Edit Booking" : "Add New Booking"}
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0F3B8C] transition-colors duration-150"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as "Approved" | "Pending" | "Cancelled" })}
                className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0F3B8C] transition-colors duration-150"
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Start Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., 10:00 AM"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0F3B8C] transition-colors duration-150"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                End Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., 12:00 PM"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0F3B8C] transition-colors duration-150"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              Purpose <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Wedding Ceremony"
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0F3B8C] transition-colors duration-150"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              Requester <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Maria Cruz"
              value={formData.requester}
              onChange={(e) => setFormData({ ...formData, requester: e.target.value })}
              className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0F3B8C] transition-colors duration-150"
            />
          </div>

          <div className="flex gap-3">
            {editingSlot ? (
              <button
                onClick={() => handleUpdate(editingSlot)}
                className="flex items-center gap-2 bg-white text-zinc-900 dark:bg-white dark:text-zinc-950 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:text-zinc-950 transition-colors duration-150"
              >
                <Check className="w-4 h-4" />
                Update Booking
              </button>
            ) : (
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 bg-white text-zinc-900 dark:bg-white dark:text-zinc-950 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-200 dark:hover:text-zinc-950 transition-colors duration-150"
              >
                <Plus className="w-4 h-4" />
                Add Booking
              </button>
            )}
            <button
              onClick={resetForm}
              className="flex items-center gap-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-transparent rounded-xl px-4 py-2.5 text-sm hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors duration-150"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Schedule View */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Schedule for {selectedVenue}
          </h2>
        </div>

        {currentSlots.length > 0 ? (
          <div className="p-6">
            <div className="space-y-4">
              {currentSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 p-5 transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="grid grid-cols-4 gap-4 mb-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Date</p>
                          <p className="text-sm font-semibold text-slate-900">{slot.date}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Time</p>
                          <p className="text-sm font-semibold text-slate-900">{slot.time}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Requester</p>
                          <p className="text-sm text-slate-900">{slot.requester}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Status</p>
                          <select
                            value={slot.status}
                            onChange={(e) => handleStatusChange(slot.id, e.target.value as "Approved" | "Pending" | "Cancelled")}
                            className={`px-3 py-1 text-xs font-medium rounded-full border ${
                              slot.status === "Approved"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : slot.status === "Cancelled"
                                ? "bg-slate-100 text-slate-700 border-slate-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Purpose</p>
                        <p className="text-sm text-slate-900">{slot.purpose}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3 border-t border-slate-200">
                    <button
                      onClick={() => startEdit(slot)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-300 dark:hover:bg-blue-500/20 dark:hover:text-blue-200 rounded-md transition-colors duration-150"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(slot.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/25 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/30 dark:hover:text-red-300 rounded-md transition-colors duration-150"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
              <CalendarIcon className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">
              No bookings found for {selectedVenue}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              All time slots are currently available
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
