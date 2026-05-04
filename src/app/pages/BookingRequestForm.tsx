import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Send, Paperclip, Save, AlertCircle, Info, MapPin, Users, FileText, Shield, CheckCircle2, XCircle, Calendar as CalendarIcon, Clock, X, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollPicker } from "../components/ScrollPicker";

interface Signature {
  role: string;
  signatory: string;
  required: boolean;
  status: "pending" | "signed";
  signedDate?: string;
}

interface VenueInfo {
  name: string;
  capacity: number;
  description: string;
  guidelines: string[];
  requiredSignatures: Signature[];
}

const venueInformation: Record<string, VenueInfo> = {
  "Main Chapel": {
    name: "Main Chapel",
    capacity: 500,
    description: "Primary worship space suitable for masses, weddings, and large religious ceremonies.",
    guidelines: [
      "Requires approval from parish priest for weddings",
      "No food or beverages inside the chapel",
      "Decorations must be removed immediately after event",
      "Sound system available upon request"
    ],
    requiredSignatures: [
      { role: "Parish Priest", signatory: "Father John Doe", required: true, status: "pending" }
    ]
  },
  "Parish Hall": {
    name: "Parish Hall",
    capacity: 200,
    description: "Multi-purpose hall perfect for receptions, meetings, and community gatherings.",
    guidelines: [
      "Kitchen facilities available",
      "Tables and chairs provided (20 round tables, 200 chairs)",
      "Event must end by 10:00 PM",
      "Cleaning fee applies for food events"
    ],
    requiredSignatures: [
      { role: "Parish Secretary", signatory: "Sister Jane Smith", required: true, status: "pending" }
    ]
  },
  "Multipurpose Room": {
    name: "Multipurpose Room",
    capacity: 80,
    description: "Flexible space ideal for small meetings, classes, and group activities.",
    guidelines: [
      "Projector and screen available",
      "Air-conditioned space",
      "Maximum 3-hour booking slots",
      "Must maintain cleanliness"
    ],
    requiredSignatures: [
      { role: "Facilities Manager", signatory: "Mr. Robert Brown", required: true, status: "pending" }
    ]
  },
  "Chapel Garden": {
    name: "Chapel Garden",
    capacity: 150,
    description: "Outdoor garden area perfect for receptions, photo sessions, and small gatherings.",
    guidelines: [
      "Weather-dependent venue",
      "No loud music after 8:00 PM",
      "Tent rental available (separate fee)",
      "Must respect landscaping and plants"
    ],
    requiredSignatures: [
      { role: "Garden Manager", signatory: "Ms. Emily White", required: true, status: "pending" }
    ]
  },
  "Conference Room": {
    name: "Conference Room",
    capacity: 30,
    description: "Professional meeting space equipped with modern amenities.",
    guidelines: [
      "Wi-Fi and video conferencing available",
      "Whiteboard and markers provided",
      "Coffee/tea service can be arranged",
      "Advance booking required"
    ],
    requiredSignatures: [
      { role: "Conference Room Coordinator", signatory: "Mr. David Green", required: true, status: "pending" }
    ]
  },
  "Youth Center": {
    name: "Youth Center",
    capacity: 100,
    description: "Dedicated space for youth activities, workshops, and recreational programs.",
    guidelines: [
      "Supervision required for minors",
      "Sports equipment available",
      "Must sign waiver for physical activities",
      "Reserved for youth-related events"
    ],
    requiredSignatures: [
      { role: "Youth Program Coordinator", signatory: "Ms. Sarah Johnson", required: true, status: "pending" }
    ]
  }
};

// Mock function to check availability warnings
const getAvailabilityWarnings = (venue: string, date: string, startTime: string): string[] => {
  const warnings: string[] = [];
  
  if (venue === "Main Chapel" && date) {
    const dayOfWeek = new Date(date).getDay();
    if (dayOfWeek === 0) { // Sunday
      warnings.push("This time slot is often in high demand for Sunday masses");
    }
  }
  
  if (venue === "Parish Hall" && startTime >= "18:00") {
    warnings.push("Evening slots for Parish Hall are frequently requested");
  }
  
  if (date) {
    const requestDate = new Date(date);
    const today = new Date();
    const daysUntil = Math.floor((requestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 7) {
      warnings.push("Short notice booking - approval may take longer");
    }
  }
  
  // Simulated conflicting booking
  if (venue === "Conference Room" && date === "2026-02-18" && startTime === "10:00") {
    warnings.push("Another request exists near this time (9:00 AM - 11:00 AM)");
  }
  
  return warnings;
};

export function BookingRequestForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    venue: "",
    date: "",
    startTime: "",
    endTime: "",
    purpose: "",
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [selectedVenueInfo, setSelectedVenueInfo] = useState<VenueInfo | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);

  // Calendar modal state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date(2026, 1, 1)); // February 2026
  const calendarButtonRef = useRef<HTMLButtonElement>(null);

  // Time picker states
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [startTimeValues, setStartTimeValues] = useState({ hour: 9, minute: 0, period: 'AM' });
  const [endTimeValues, setEndTimeValues] = useState({ hour: 5, minute: 0, period: 'PM' });
  const startTimeButtonRef = useRef<HTMLButtonElement>(null);
  const endTimeButtonRef = useRef<HTMLButtonElement>(null);

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const handleDateSelect = (day: number) => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth() + 1;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setFormData(prev => ({ ...prev, date: dateStr }));
    setShowCalendar(false);

    // Update warnings
    if (formData.venue) {
      const newWarnings = getAvailabilityWarnings(formData.venue, dateStr, formData.startTime);
      setWarnings(newWarnings);
    }
  };

  const previousMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  // Time picker helper functions
  const convertTo24Hour = (hour: number, period: string) => {
    if (period === 'AM') {
      return hour === 12 ? 0 : hour;
    } else {
      return hour === 12 ? 12 : hour + 12;
    }
  };

  const applyStartTime = () => {
    const hour24 = convertTo24Hour(startTimeValues.hour, startTimeValues.period);
    const timeStr = `${String(hour24).padStart(2, '0')}:${String(startTimeValues.minute).padStart(2, '0')}`;
    setFormData(prev => ({ ...prev, startTime: timeStr }));
    setShowStartTimePicker(false);

    // Update warnings
    if (formData.venue) {
      const newWarnings = getAvailabilityWarnings(formData.venue, formData.date, timeStr);
      setWarnings(newWarnings);
    }
  };

  const applyEndTime = () => {
    const hour24 = convertTo24Hour(endTimeValues.hour, endTimeValues.period);
    const timeStr = `${String(hour24).padStart(2, '0')}:${String(endTimeValues.minute).padStart(2, '0')}`;
    setFormData(prev => ({ ...prev, endTime: timeStr }));
    setShowEndTimePicker(false);
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return 'Select time';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return 'Select date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleSubmit = (e: React.FormEvent, isDraft: boolean = false) => {
    e.preventDefault();
    
    if (isDraft) {
      alert("Request saved as draft!");
      navigate("/requester");
    } else {
      if (!formData.venue || !formData.date || !formData.startTime || !formData.endTime || !formData.purpose) {
        alert("Please fill in all required fields");
        return;
      }
      
      // Check if all required signatures are collected
      const missingSignatures = signatures.filter(sig => sig.required && sig.status === "pending");
      if (missingSignatures.length > 0) {
        const confirm = window.confirm(
          `You have ${missingSignatures.length} required signature(s) pending. You can still submit, but approval may be delayed. Continue?`
        );
        if (!confirm) return;
      }
      
      alert("Booking request submitted successfully!");
      navigate("/requester");
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Update venue info when venue is selected
    if (name === "venue" && value) {
      const venueInfo = venueInformation[value] || null;
      setSelectedVenueInfo(venueInfo);
      // Initialize signatures for the selected venue
      if (venueInfo) {
        setSignatures(venueInfo.requiredSignatures.map(sig => ({ ...sig })));
      } else {
        setSignatures([]);
      }
    }
    
    // Update warnings when relevant fields change
    if ((name === "venue" || name === "date" || name === "startTime") && formData.venue) {
      const newWarnings = getAvailabilityWarnings(
        name === "venue" ? value : formData.venue,
        name === "date" ? value : formData.date,
        name === "startTime" ? value : formData.startTime
      );
      setWarnings(newWarnings);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const markSignatureAsCollected = (index: number) => {
    const updated = [...signatures];
    updated[index] = {
      ...updated[index],
      status: "signed",
      signedDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
    };
    setSignatures(updated);
  };

  const markSignatureAsPending = (index: number) => {
    const updated = [...signatures];
    updated[index] = {
      ...updated[index],
      status: "pending",
      signedDate: undefined
    };
    setSignatures(updated);
  };

  const canSaveDraft = formData.venue || formData.date || formData.purpose;

  return (
    <div>
      {/* Page Header with back button */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/requester")}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-semibold text-slate-900 mb-2 tracking-tight">
          New Booking Request
        </h1>
        <p className="text-slate-600">
          Submit a request to reserve a venue or facility
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Form */}
        <div className="col-span-2">
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-8">
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
              {/* Venue Selection */}
              <div>
                <label
                  htmlFor="venue"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Venue / Facility <span className="text-rose-500">*</span>
                </label>
                <select
                  id="venue"
                  name="venue"
                  value={formData.venue}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  required
                >
                  <option value="">Select a venue</option>
                  <option value="Main Chapel">Main Chapel</option>
                  <option value="Parish Hall">Parish Hall</option>
                  <option value="Multipurpose Room">Multipurpose Room</option>
                  <option value="Chapel Garden">Chapel Garden</option>
                  <option value="Conference Room">Conference Room</option>
                  <option value="Youth Center">Youth Center</option>
                </select>
              </div>

              {/* Date Picker */}
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Event Date <span className="text-rose-500">*</span>
                </label>
                <button
                  ref={calendarButtonRef}
                  type="button"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-left flex items-center justify-between group"
                >
                  <span className={formData.date ? "text-slate-900 font-medium" : "text-slate-400"}>
                    {formatDisplayDate(formData.date)}
                  </span>
                  <CalendarIcon className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </button>
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-6">
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Start Time <span className="text-rose-500">*</span>
                  </label>
                  <button
                    ref={startTimeButtonRef}
                    type="button"
                    onClick={() => setShowStartTimePicker(!showStartTimePicker)}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-left flex items-center justify-between group"
                  >
                    <span className={formData.startTime ? "text-slate-900 font-medium" : "text-slate-400"}>
                      {formatDisplayTime(formData.startTime)}
                    </span>
                    <Clock className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                  </button>
                </div>
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    End Time <span className="text-rose-500">*</span>
                  </label>
                  <button
                    ref={endTimeButtonRef}
                    type="button"
                    onClick={() => setShowEndTimePicker(!showEndTimePicker)}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl hover:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all text-left flex items-center justify-between group"
                  >
                    <span className={formData.endTime ? "text-slate-900 font-medium" : "text-slate-400"}>
                      {formatDisplayTime(formData.endTime)}
                    </span>
                    <Clock className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition-colors" />
                  </button>
                </div>
              </div>

              {/* Availability Warnings */}
              {warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-amber-900 mb-2">
                        Availability Notices
                      </h4>
                      <ul className="space-y-1">
                        {warnings.map((warning, index) => (
                          <li key={index} className="text-sm text-amber-800 flex items-start gap-2">
                            <span className="mt-1.5 w-1 h-1 bg-amber-600 rounded-full flex-shrink-0"></span>
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-amber-700 mt-3">
                        These are informational notices only and will not prevent submission.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Purpose/Description */}
              <div>
                <label
                  htmlFor="purpose"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Purpose / Event Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="purpose"
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none"
                  placeholder="Describe the purpose of your booking request"
                  required
                />
              </div>

              {/* Optional Attachment */}
              <div>
                <label
                  htmlFor="attachment"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Attachment (Optional)
                </label>
                <div className="relative">
                  <input
                    id="attachment"
                    name="attachment"
                    type="file"
                    onChange={handleFileChange}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Upload any supporting documents (e.g., event plan, schedule)
                </p>
                {attachment && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-slate-700 bg-slate-50 px-4 py-2 rounded-lg">
                    <Paperclip className="w-4 h-4" />
                    {attachment.name}
                  </div>
                )}
              </div>

              {/* Required Signatures */}
              {signatures.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-slate-600" />
                    <label className="text-sm font-semibold text-slate-700">
                      Required Signatures
                    </label>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-600 mb-4">
                      Collect the following signatures before submission. You can still submit without all signatures, but approval may be delayed.
                    </p>
                    
                    <div className="space-y-3">
                      {signatures.map((signature, index) => (
                        <div
                          key={index}
                          className={`p-4 border rounded-lg ${
                            signature.status === "signed"
                              ? "bg-emerald-50 border-emerald-200"
                              : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-semibold text-slate-900">
                                  {signature.signatory}
                                </p>
                                {signature.required && (
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 text-xs font-medium rounded-full">
                                    Required
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600">{signature.role}</p>
                              {signature.status === "signed" && signature.signedDate && (
                                <p className="text-xs text-emerald-700 mt-2">
                                  Signed on {signature.signedDate}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {signature.status === "signed" ? (
                                <button
                                  type="button"
                                  onClick={() => markSignatureAsPending(index)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Undo
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => markSignatureAsCollected(index)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Mark as Collected
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Signature Summary */}
                    <div className="mt-4 pt-4 border-t border-slate-300 flex items-center justify-between text-sm">
                      <span className="text-slate-700">
                        Signatures Collected:
                      </span>
                      <span className="font-semibold text-slate-900">
                        {signatures.filter(s => s.status === "signed").length} / {signatures.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-3 pt-6 border-t border-slate-200">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-900/20"
                >
                  <Send className="w-4 h-4" />
                  Submit Request
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={!canSaveDraft}
                  className={`flex items-center gap-2 px-6 py-3 border border-slate-300 rounded-lg transition-all ${
                    canSaveDraft
                      ? "text-slate-700 hover:bg-slate-50"
                      : "text-slate-400 bg-slate-50 cursor-not-allowed"
                  }`}
                >
                  <Save className="w-4 h-4" />
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/requester")}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Venue Information Panel */}
        <div className="col-span-1">
          {selectedVenueInfo ? (
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-6 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900 text-lg">
                  Venue Information
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-1">
                    {selectedVenueInfo.name}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                    <Users className="w-4 h-4" />
                    <span>Capacity: {selectedVenueInfo.capacity} people</span>
                  </div>
                  <p className="text-sm text-slate-700">
                    {selectedVenueInfo.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-slate-600" />
                    <h4 className="text-sm font-semibold text-slate-900">
                      Usage Guidelines
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {selectedVenueInfo.guidelines.map((guideline, index) => (
                      <li key={index} className="text-sm text-slate-700 flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0"></span>
                        <span>{guideline}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-slate-200 bg-blue-50 -mx-6 -mb-6 px-6 py-4 rounded-b-xl">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-900">
                      Please review these guidelines before submitting your request. Compliance with venue rules is required for approval.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-lg shadow-slate-900/5 p-12 text-center sticky top-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                <MapPin className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">Select a venue</p>
              <p className="text-slate-500 text-sm mt-1">
                Venue information will appear here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Calendar Popup */}
      {showCalendar && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />
          <div className="absolute z-50 mt-2 bg-white rounded-2xl shadow-2xl max-w-lg w-full border-2 border-slate-200"
               style={{
                 top: calendarButtonRef.current ? calendarButtonRef.current.getBoundingClientRect().bottom + window.scrollY : 0,
                 left: calendarButtonRef.current ? calendarButtonRef.current.getBoundingClientRect().left + window.scrollX : 0,
                 width: calendarButtonRef.current ? calendarButtonRef.current.offsetWidth : 'auto'
               }}>
            {/* Calendar Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="font-semibold text-white">Select Date</h3>
              <button
                onClick={() => setShowCalendar(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Calendar Navigation */}
            <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between">
              <button
                onClick={previousMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <h4 className="font-semibold text-slate-900">
                {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h4>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="p-6">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-2 mb-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center py-2 text-xs font-bold text-slate-600 uppercase">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2">
                {(() => {
                  const daysInMonth = getDaysInMonth(calendarDate);
                  const firstDay = getFirstDayOfMonth(calendarDate);
                  const days = [];

                  // Empty cells before first day
                  for (let i = 0; i < firstDay; i++) {
                    days.push(<div key={`empty-${i}`} className="aspect-square" />);
                  }

                  // Days of month
                  for (let day = 1; day <= daysInMonth; day++) {
                    const isSelected = formData.date === `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    days.push(
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDateSelect(day)}
                        className={`aspect-square rounded-xl font-medium transition-all ${
                          isSelected
                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg'
                            : 'hover:bg-blue-50 text-slate-700'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  }

                  return days;
                })()}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Start Time Picker Popup */}
      {showStartTimePicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowStartTimePicker(false)} />
          <div className="absolute z-50 mt-2 bg-white rounded-2xl shadow-2xl border-2 border-slate-200"
               style={{
                 top: startTimeButtonRef.current ? startTimeButtonRef.current.getBoundingClientRect().bottom + window.scrollY : 0,
                 left: startTimeButtonRef.current ? startTimeButtonRef.current.getBoundingClientRect().left + window.scrollX : 0,
                 width: startTimeButtonRef.current ? startTimeButtonRef.current.offsetWidth : 'auto'
               }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="font-semibold text-white">Start Time</h3>
              <button
                onClick={() => setShowStartTimePicker(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Time Picker */}
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                {/* Hour Picker */}
                <div>
                  <p className="text-xs font-bold text-slate-600 text-center mb-2">Hour</p>
                  <ScrollPicker
                    items={Array.from({ length: 12 }, (_, i) => i + 1)}
                    selectedIndex={startTimeValues.hour - 1}
                    onChange={(index) => setStartTimeValues(prev => ({ ...prev, hour: index + 1 }))}
                  />
                </div>

                {/* Minute Picker */}
                <div>
                  <p className="text-xs font-bold text-slate-600 text-center mb-2">Minute</p>
                  <ScrollPicker
                    items={Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))}
                    selectedIndex={startTimeValues.minute / 5}
                    onChange={(index) => setStartTimeValues(prev => ({ ...prev, minute: index * 5 }))}
                  />
                </div>

                {/* Period Picker */}
                <div>
                  <p className="text-xs font-bold text-slate-600 text-center mb-2">Period</p>
                  <ScrollPicker
                    items={['AM', 'PM']}
                    selectedIndex={startTimeValues.period === 'AM' ? 0 : 1}
                    onChange={(index) => setStartTimeValues(prev => ({ ...prev, period: index === 0 ? 'AM' : 'PM' }))}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={applyStartTime}
                className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-lg font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </>
      )}

      {/* End Time Picker Popup */}
      {showEndTimePicker && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowEndTimePicker(false)} />
          <div className="absolute z-50 mt-2 bg-white rounded-2xl shadow-2xl border-2 border-slate-200"
               style={{
                 top: endTimeButtonRef.current ? endTimeButtonRef.current.getBoundingClientRect().bottom + window.scrollY : 0,
                 left: endTimeButtonRef.current ? endTimeButtonRef.current.getBoundingClientRect().left + window.scrollX : 0,
                 width: endTimeButtonRef.current ? endTimeButtonRef.current.offsetWidth : 'auto'
               }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-600 to-rose-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="font-semibold text-white">End Time</h3>
              <button
                onClick={() => setShowEndTimePicker(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Time Picker */}
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                {/* Hour Picker */}
                <div>
                  <p className="text-xs font-bold text-slate-600 text-center mb-2">Hour</p>
                  <ScrollPicker
                    items={Array.from({ length: 12 }, (_, i) => i + 1)}
                    selectedIndex={endTimeValues.hour - 1}
                    onChange={(index) => setEndTimeValues(prev => ({ ...prev, hour: index + 1 }))}
                  />
                </div>

                {/* Minute Picker */}
                <div>
                  <p className="text-xs font-bold text-slate-600 text-center mb-2">Minute</p>
                  <ScrollPicker
                    items={Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))}
                    selectedIndex={endTimeValues.minute / 5}
                    onChange={(index) => setEndTimeValues(prev => ({ ...prev, minute: index * 5 }))}
                  />
                </div>

                {/* Period Picker */}
                <div>
                  <p className="text-xs font-bold text-slate-600 text-center mb-2">Period</p>
                  <ScrollPicker
                    items={['AM', 'PM']}
                    selectedIndex={endTimeValues.period === 'AM' ? 0 : 1}
                    onChange={(index) => setEndTimeValues(prev => ({ ...prev, period: index === 0 ? 'AM' : 'PM' }))}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={applyEndTime}
                className="w-full px-6 py-3 bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-xl hover:from-rose-700 hover:to-rose-800 transition-all shadow-lg font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}