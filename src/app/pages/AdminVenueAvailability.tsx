import { useState } from "react";
import { MapPin, Plus, Edit2, Trash2, Check, X, Calendar as CalendarIcon } from "lucide-react";

interface BookedSlot {
  id: string;
  date: string;
  time: string;
  purpose: string;
  status: "Approved" | "Pending" | "Cancelled";
  requester: string;
}

const venues = [
  "Main Chapel",
  "Parish Hall",
  "Multipurpose Room",
  "Chapel Garden",
  "Conference Room",
  "Youth Center",
];

const initialMockBookedSlots: Record<string, BookedSlot[]> = {
  "Main Chapel": [
    {
      id: "SLOT-001",
      date: "2026-02-15",
      time: "10:00 AM - 12:00 PM",
      purpose: "Sunday Mass",
      status: "Approved",
      requester: "Fr. Michael Santos"
    },
    {
      id: "SLOT-002",
      date: "2026-02-22",
      time: "2:00 PM - 5:00 PM",
      purpose: "Wedding Ceremony",
      status: "Approved",
      requester: "Maria Cruz"
    },
  ],
  "Parish Hall": [
    {
      id: "SLOT-003",
      date: "2026-02-20",
      time: "2:00 PM - 5:00 PM",
      purpose: "Youth Ministry Meeting",
      status: "Pending",
      requester: "Fr. Michael Santos"
    },
  ],
  "Chapel Garden": [
    {
      id: "SLOT-004",
      date: "2026-03-05",
      time: "3:00 PM - 6:00 PM",
      purpose: "Baptism Reception",
      status: "Approved",
      requester: "Maria Cruz"
    },
  ],
};

export function AdminVenueAvailability() {
  const [selectedVenue, setSelectedVenue] = useState("Main Chapel");
  const [bookedSlots, setBookedSlots] = useState(initialMockBookedSlots);
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

    const newSlot: BookedSlot = {
      id: `SLOT-${Date.now()}`,
      date: formData.date,
      time: `${formData.startTime} - ${formData.endTime}`,
      purpose: formData.purpose,
      status: formData.status,
      requester: formData.requester
    };

    setBookedSlots({
      ...bookedSlots,
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

    setBookedSlots({
      ...bookedSlots,
      [selectedVenue]: updatedSlots
    });

    resetForm();
  };

  const handleDelete = (slotId: string) => {
    if (confirm("Are you sure you want to delete this booking?")) {
      const updatedSlots = currentSlots.filter(slot => slot.id !== slotId);
      setBookedSlots({
        ...bookedSlots,
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
        <h1 className="text-3xl font-semibold text-slate-900 mb-2 tracking-tight">
          Venue Availability Management
        </h1>
        <p className="text-slate-600">
          Manage bookings and update venue availability
        </p>
      </div>

      {/* Venue Selector and Add Button */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label htmlFor="venue-select" className="text-sm font-semibold text-slate-700">
            Select Venue
          </label>
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-slate-400" />
            <select
              id="venue-select"
              value={selectedVenue}
              onChange={(e) => {
                setSelectedVenue(e.target.value);
                resetForm();
              }}
              className="px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
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
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-900/20"
        >
          <Plus className="w-4 h-4" />
          Add Booking
        </button>
      </div>

      {/* Add/Edit Form */}
      {(isAddingSlot || editingSlot) && (
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-6 mb-6">
          <h3 className="font-semibold text-slate-900 text-lg mb-4">
            {editingSlot ? "Edit Booking" : "Add New Booking"}
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as "Approved" | "Pending" | "Cancelled" })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Start Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., 10:00 AM"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                End Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., 12:00 PM"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Purpose <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Wedding Ceremony"
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Requester <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Maria Cruz"
              value={formData.requester}
              onChange={(e) => setFormData({ ...formData, requester: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="flex gap-3">
            {editingSlot ? (
              <button
                onClick={() => handleUpdate(editingSlot)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all"
              >
                <Check className="w-4 h-4" />
                Update Booking
              </button>
            ) : (
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Booking
              </button>
            )}
            <button
              onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Schedule View */}
      <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200/60">
          <h2 className="font-semibold text-slate-900 text-lg">
            Schedule for {selectedVenue}
          </h2>
        </div>

        {currentSlots.length > 0 ? (
          <div className="p-6">
            <div className="space-y-4">
              {currentSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="border border-slate-200 rounded-xl p-5 bg-gradient-to-br from-slate-50 to-white hover:shadow-md transition-shadow"
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
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(slot.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
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
