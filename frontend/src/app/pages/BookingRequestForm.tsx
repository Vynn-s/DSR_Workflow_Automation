import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Send, Paperclip, Save, AlertCircle, Info, MapPin, Users, FileText, Shield, CheckCircle2, XCircle, Calendar as CalendarIcon, Clock, X, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { ScrollPicker } from "../components/ScrollPicker";

interface Signature {
  role: string;
  signatory: string;
  required: boolean;
  status: "pending" | "signed";
  signedDate?: string;
}

interface RequestAttachment {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedDate: string;
  dataUrl: string;
}

interface VenueApiMinistry {
  ministryId: string;
  ministry?: {
    id: string;
    name: string;
  } | null;
}

interface VenueApi {
  id: string;
  name: string;
  capacity: number;
  description: string | null;
  authorizedMinistries: VenueApiMinistry[];
}

interface DssRuleResult {
  ruleName: string;
  passed: boolean;
  message: string;
}

interface VenueInfo {
  name: string;
  capacity: number;
  description: string;
  guidelines: string[];
  requiredSignatures: Signature[];
}

const attendeeRangeOptions = [
  { label: "1-50", value: 50 },
  { label: "51-150", value: 150 },
  { label: "151-300", value: 300 },
  { label: "301-500", value: 500 },
];

const defaultAttendeeRange = attendeeRangeOptions[0].value.toString();

const buildVenueInfo = (venue: VenueApi): VenueInfo => {
  const authorizedMinistryNames = venue.authorizedMinistries
    .map((entry) => entry.ministry?.name)
    .filter((value): value is string => Boolean(value));

  return {
    name: venue.name,
    capacity: venue.capacity,
    description: venue.description ?? "Venue details loaded from the backend.",
    guidelines: [
      venue.description ?? "Venue details loaded from the backend.",
      `Capacity: ${venue.capacity} people`,
      authorizedMinistryNames.length > 0
        ? `Authorized ministries: ${authorizedMinistryNames.join(", ")}`
        : "No ministry restrictions configured",
    ],
    requiredSignatures: authorizedMinistryNames.length > 0
      ? authorizedMinistryNames.map((ministryName) => ({
          role: ministryName,
          signatory: `${ministryName} Approval`,
          required: true,
          status: "pending" as const,
        }))
      : [
          {
            role: "Parish Secretary",
            signatory: "Parish Secretary Approval",
            required: true,
            status: "pending" as const,
          },
        ],
  };
};

const combineDateAndTimeToIso = (dateStr: string, timeStr: string) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return date.toISOString();
};

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const BUSINESS_HOURS_OPEN_MINUTES = 6 * 60;
const BUSINESS_HOURS_CLOSE_MINUTES = 22 * 60;
const TIME_SLOT_STEP_MINUTES = 5;

const timeSlots = Array.from(
  { length: ((BUSINESS_HOURS_CLOSE_MINUTES - BUSINESS_HOURS_OPEN_MINUTES) / TIME_SLOT_STEP_MINUTES) + 1 },
  (_, index) => BUSINESS_HOURS_OPEN_MINUTES + (index * TIME_SLOT_STEP_MINUTES),
);

function minutesToTimeString(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function minutesToDisplayTime(totalMinutes: number) {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const displayHour = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

const timeSlotLabels = timeSlots.map((minutes) => minutesToDisplayTime(minutes));

function timeStringToMinutes(timeStr: string) {
  const [hours, minutes] = timeStr.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return (hours * 60) + minutes;
}

function getTimeSlotIndex(timeStr: string | undefined, fallbackIndex: number) {
  if (!timeStr) {
    return fallbackIndex;
  }

  const minutes = timeStringToMinutes(timeStr);
  if (minutes === null) {
    return fallbackIndex;
  }

  const slotIndex = timeSlots.findIndex((slotMinutes) => slotMinutes === minutes);
  return slotIndex >= 0 ? slotIndex : fallbackIndex;
}

function isWithinBusinessHours(timeStr: string) {
  const minutes = timeStringToMinutes(timeStr);
  return minutes !== null && minutes >= BUSINESS_HOURS_OPEN_MINUTES && minutes <= BUSINESS_HOURS_CLOSE_MINUTES;
}

function isEndAfterStart(startTime: string, endTime: string) {
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  return endMinutes > startMinutes;
}

type TimePickerValues = {
  hour: number;
  minute: number;
  period: "AM" | "PM";
};

const defaultStartTimeValues: TimePickerValues = { hour: 9, minute: 0, period: "AM" };
const defaultEndTimeValues: TimePickerValues = { hour: 5, minute: 0, period: "PM" };

function convertTo24Hour(hour: number, period: "AM" | "PM") {
  if (period === "AM") {
    return hour === 12 ? 0 : hour;
  }

  return hour === 12 ? 12 : hour + 12;
}

function parseTimeForPicker(timeStr: string | undefined, fallback: TimePickerValues): TimePickerValues {
  if (!timeStr) {
    return fallback;
  }

  const [hoursRaw, minutesRaw] = timeStr.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return fallback;
  }

  const period: "AM" | "PM" = hours >= 12 ? "PM" : "AM";
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  return {
    hour: hour12,
    minute: Math.max(0, Math.min(55, Math.round(minutes / 5) * 5)),
    period,
  };
}

function getAllowedHours(period: "AM" | "PM") {
  return period === "AM"
    ? [6, 7, 8, 9, 10, 11]
    : [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
}

function normalizePickerValues(values: TimePickerValues): TimePickerValues {
  const allowedHours = getAllowedHours(values.period);
  const hour = allowedHours.includes(values.hour) ? values.hour : allowedHours[0];

  return {
    ...values,
    hour,
    minute: Math.max(0, Math.min(55, Math.round(values.minute / 5) * 5)),
  };
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
};

export function BookingRequestForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMountedRef = useRef(true);
  const today = new Date();
  const todayDateString = today.toISOString().slice(0, 10);
  const [formData, setFormData] = useState({
    venue: "",
    date: todayDateString,
    startTime: "",
    endTime: "",
    purpose: "",
    attendees: defaultAttendeeRange,
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [venues, setVenues] = useState<VenueApi[]>([]);
  const [isLoadingVenues, setIsLoadingVenues] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedVenueInfo, setSelectedVenueInfo] = useState<VenueInfo | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [dssResults, setDssResults] = useState<DssRuleResult[]>([]);
  const [dssChecking, setDssChecking] = useState(false);
  const [canProceed, setCanProceed] = useState(false);

  // Calendar modal state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(today);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);

  // Time picker states
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [startTimeValues, setStartTimeValues] = useState<TimePickerValues>(defaultStartTimeValues);
  const [endTimeValues, setEndTimeValues] = useState<TimePickerValues>(defaultEndTimeValues);
  const startTimeButtonRef = useRef<HTMLButtonElement>(null);
  const endTimeButtonRef = useRef<HTMLButtonElement>(null);

  const loadVenues = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") {
      setIsLoadingVenues(true);
    }

    try {
      const data = await api.get<{ venues: VenueApi[] }>("/venues");

      if (!isMountedRef.current) {
        return;
      }

      const liveVenues = data.venues ?? [];
      setVenues(liveVenues);
      setFormData((current) => {
        if (!current.venue || liveVenues.some((venue) => venue.id === current.venue)) {
          return current;
        }

        return {
          ...current,
          venue: liveVenues[0]?.id ?? "",
        };
      });
    } catch {
      if (isMountedRef.current) {
        setVenues([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingVenues(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    void loadVenues();

    const handleRefresh = () => {
      void loadVenues("refresh");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadVenues("refresh");
      }
    };

    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadVenues]);

  useEffect(() => {
    const selectedVenue = venues.find((venue) => venue.id === formData.venue);

    if (!selectedVenue) {
      setSelectedVenueInfo(null);
      setSignatures([]);
      return;
    }

    const venueInfo = buildVenueInfo(selectedVenue);
    setSelectedVenueInfo(venueInfo);
    setSignatures(venueInfo.requiredSignatures.map((signature) => ({ ...signature })));
  }, [formData.venue, venues]);

  useEffect(() => {
    const { venue, date, startTime, endTime, attendees } = formData;

    if (!(venue && date && startTime && endTime)) {
      setDssResults([]);
      setCanProceed(false);
      return;
    }

    const selectedVenue = venues.find((item) => item.id === venue);
    if (!selectedVenue) {
      setDssResults([]);
      setCanProceed(false);
      return;
    }

    let isMounted = true;

    const evaluateAvailability = async () => {
      setDssChecking(true);

      try {
        const decision = await api.post<{
          allPassed: boolean;
          results: DssRuleResult[];
          recommendation: string;
          canProceed: boolean;
        }>("/dss/evaluate", {
          venueId: venue,
          requestDate: date,
          startTime,
          endTime,
          attendees: Number(attendees),
          attachmentCount: attachment ? 1 : 0,
          signatures,
        });

        if (isMounted) {
          setDssResults(decision.results ?? []);
          setCanProceed(Boolean(decision.canProceed));
        }
      } catch {
        if (isMounted) {
          setDssResults([]);
          setCanProceed(false);
        }
      } finally {
        if (isMounted) {
          setDssChecking(false);
        }
      }
    };

    void evaluateAvailability();

    return () => {
      isMounted = false;
    };
  }, [formData.venue, formData.date, formData.startTime, formData.endTime, formData.attendees, attachment, signatures, user?.ministryId, venues]);

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
    setFormData((prev) => ({ ...prev, date: dateStr }));
    setShowCalendar(false);
  };

  const previousMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return 'Select time';
    const minutes = timeStringToMinutes(timeStr);

    if (minutes === null) {
      return timeStr;
    }

    return minutesToDisplayTime(minutes);
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

  const isPastDate = (year: number, monthIndex: number, day: number) => {
    const date = new Date(year, monthIndex, day);
    date.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isPreviousMonthDisabled =
    new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1) <=
    new Date(today.getFullYear(), today.getMonth(), 1);

  const openStartTimePicker = () => {
    setStartTimeValues(normalizePickerValues(parseTimeForPicker(formData.startTime, defaultStartTimeValues)));
    setShowStartTimePicker(true);
  };

  const openEndTimePicker = () => {
    setEndTimeValues(normalizePickerValues(parseTimeForPicker(formData.endTime, defaultEndTimeValues)));
    setShowEndTimePicker(true);
  };

  const applyStartTime = () => {
    const hour24 = convertTo24Hour(startTimeValues.hour, startTimeValues.period);
    const timeStr = `${String(hour24).padStart(2, "0")}:${String(startTimeValues.minute).padStart(2, "0")}`;
    setFormData((prev) => ({ ...prev, startTime: timeStr }));
    setShowStartTimePicker(false);
  };

  const applyEndTime = () => {
    const hour24 = convertTo24Hour(endTimeValues.hour, endTimeValues.period);
    const timeStr = `${String(hour24).padStart(2, "0")}:${String(endTimeValues.minute).padStart(2, "0")}`;
    setFormData((prev) => ({ ...prev, endTime: timeStr }));
    setShowEndTimePicker(false);
  };

  const handleSubmit = async (e: React.FormEvent, isDraft: boolean = false) => {
    e.preventDefault();
    
    if (isDraft) {
      alert("Request saved as draft!");
      navigate("/requester");
      return;
    }

    if (!formData.venue || !formData.date || !formData.startTime || !formData.endTime || !formData.purpose || !formData.attendees) {
      setSubmitError("Please fill in all required fields");
      return;
    }

    const selectedVenue = venues.find((venue) => venue.id === formData.venue);
    if (!selectedVenue) {
      setSubmitError("Please select a valid venue");
      return;
    }

    if (!isWithinBusinessHours(formData.startTime) || !isWithinBusinessHours(formData.endTime)) {
      setSubmitError("Please choose a time between 6:00 AM and 10:00 PM.");
      return;
    }

    if (!isEndAfterStart(formData.startTime, formData.endTime)) {
      setSubmitError("End time must be later than start time.");
      return;
    }

    if (dssChecking) {
      setSubmitError("Please wait for the DSS check to finish before submitting.");
      return;
    }

    if (!canProceed) {
      setSubmitError("This request cannot be submitted yet because one or more DSS checks are failing.");
      return;
    }

    if (attachment && attachment.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setSubmitError(
        `Attachment is too large. The maximum allowed size is ${formatBytes(MAX_ATTACHMENT_SIZE_BYTES)}.`
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const attachments: RequestAttachment[] = attachment
        ? [{
            id: crypto.randomUUID(),
            name: attachment.name,
            type: attachment.type || "application/octet-stream",
            size: `${Math.max(1, Math.round(attachment.size / 1024))} KB`,
            uploadedDate: new Date().toISOString(),
            dataUrl: await fileToDataUrl(attachment),
          }]
        : [];

      await api.post("/requests", {
        venueId: selectedVenue.id,
        eventName: formData.purpose,
        purpose: formData.purpose,
        startDateTime: combineDateAndTimeToIso(formData.date, formData.startTime),
        endDateTime: combineDateAndTimeToIso(formData.date, formData.endTime),
        startTime: formData.startTime,
        endTime: formData.endTime,
        attendees: Number(formData.attendees),
        specialRequirements: "",
        attachments,
        signatures,
      });

      navigate("/requester", {
        state: {
          message: "Booking request submitted successfully!",
        },
      });
    } catch (error) {
      const message =
        error && typeof error === "object" && "response" in error
          ? ((error as { response?: { data?: { error?: { message?: string }; message?: string } } }).response?.data?.error?.message ??
            (error as { response?: { data?: { error?: { message?: string }; message?: string } } }).response?.data?.message)
          : error instanceof Error
            ? error.message
            : "Unable to submit booking request";
      setSubmitError(message || "Unable to submit booking request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      if (selectedFile.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setAttachment(null);
        setSubmitError(
          `Attachment is too large. Please choose a file smaller than ${formatBytes(MAX_ATTACHMENT_SIZE_BYTES)}.`
        );
        e.target.value = "";
        return;
      }

      setSubmitError(null);
      setAttachment(selectedFile);
    }
  };

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Unable to read attachment file"));
      reader.readAsDataURL(file);
    });

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
  const calendarYear = calendarDate.getFullYear();
  const calendarMonthIndex = calendarDate.getMonth();

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
                  {isLoadingVenues ? (
                    <option value="" disabled>
                      Loading venues...
                    </option>
                  ) : (
                    venues.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Attendee Range */}
              <div>
                <label
                  htmlFor="attendees"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Expected Attendees <span className="text-rose-500">*</span>
                </label>
                <select
                  id="attendees"
                  name="attendees"
                  value={formData.attendees}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  required
                >
                  {attendeeRangeOptions.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label} people
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500">
                  Choose the range that best matches your expected headcount.
                </p>
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
                    onClick={openStartTimePicker}
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
                    onClick={openEndTimePicker}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl hover:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all text-left flex items-center justify-between group"
                  >
                    <span className={formData.endTime ? "text-slate-900 font-medium" : "text-slate-400"}>
                      {formatDisplayTime(formData.endTime)}
                    </span>
                    <Clock className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition-colors" />
                  </button>
                </div>
              </div>

              {/* DSS Results */}
              {(dssChecking || dssResults.length > 0) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-amber-900 mb-2">
                        Availability Notices
                      </h4>
                      {dssChecking ? (
                        <p className="text-sm text-amber-800">Checking availability and workflow rules...</p>
                      ) : (
                        <ul className="space-y-2">
                          {dssResults.map((result, index) => (
                            <li key={`${result.ruleName}-${index}`} className="text-sm flex items-start gap-2">
                              {result.passed ? (
                                <CheckCircle2 className="mt-0.5 w-4 h-4 text-emerald-600 flex-shrink-0" />
                              ) : (
                                <XCircle className="mt-0.5 w-4 h-4 text-rose-600 flex-shrink-0" />
                              )}
                              <span className={result.passed ? "text-emerald-800" : "text-rose-800"}>
                                {result.message}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="text-xs text-amber-700 mt-3">
                        These DSS results determine whether the request can be submitted.
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
                  Upload any supporting documents (e.g., event plan, schedule). Maximum size: {formatBytes(MAX_ATTACHMENT_SIZE_BYTES)}.
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
                        {submitError ? (
                          <p className="text-sm text-red-600" role="alert">
                            {submitError}
                          </p>
                        ) : null}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-3 pt-6 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={isSubmitting || dssChecking || !canProceed}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Submitting..." : dssChecking ? "Checking DSS..." : "Submit Request"}
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
                disabled={isPreviousMonthDisabled}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                    const dateString = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isSelected = formData.date === dateString;
                    const isDisabled = isPastDate(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                    days.push(
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          if (!isDisabled) {
                            handleDateSelect(day);
                          }
                        }}
                        disabled={isDisabled}
                        className={`aspect-square rounded-xl font-medium transition-all ${
                          isSelected
                            ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg'
                            : isDisabled
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
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
                type="button"
                onClick={() => setShowStartTimePicker(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Time Picker */}
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-600 text-center mb-2">Hour</p>
                  <ScrollPicker
                    items={getAllowedHours(startTimeValues.period)}
                    selectedIndex={Math.max(0, getAllowedHours(startTimeValues.period).indexOf(startTimeValues.hour))}
                    onChange={(index) => setStartTimeValues((prev) => normalizePickerValues({
                      ...prev,
                      hour: getAllowedHours(prev.period)[index],
                    }))}
                  />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-600 text-center mb-2">Minute</p>
                  <ScrollPicker
                    items={Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"))}
                    selectedIndex={startTimeValues.minute / 5}
                    onChange={(index) => setStartTimeValues((prev) => ({ ...prev, minute: index * 5 }))}
                  />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-600 text-center mb-2">Period</p>
                  <ScrollPicker
                    items={["AM", "PM"]}
                    selectedIndex={startTimeValues.period === "AM" ? 0 : 1}
                    onChange={(index) => setStartTimeValues((prev) => normalizePickerValues({ ...prev, period: index === 0 ? "AM" : "PM" }))}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                type="button"
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
                type="button"
                onClick={() => setShowEndTimePicker(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Time Picker */}
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-600 text-center mb-2">Hour</p>
                  <ScrollPicker
                    items={getAllowedHours(endTimeValues.period)}
                    selectedIndex={Math.max(0, getAllowedHours(endTimeValues.period).indexOf(endTimeValues.hour))}
                    onChange={(index) => setEndTimeValues((prev) => normalizePickerValues({
                      ...prev,
                      hour: getAllowedHours(prev.period)[index],
                    }))}
                  />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-600 text-center mb-2">Minute</p>
                  <ScrollPicker
                    items={Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"))}
                    selectedIndex={endTimeValues.minute / 5}
                    onChange={(index) => setEndTimeValues((prev) => ({ ...prev, minute: index * 5 }))}
                  />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-600 text-center mb-2">Period</p>
                  <ScrollPicker
                    items={["AM", "PM"]}
                    selectedIndex={endTimeValues.period === "AM" ? 0 : 1}
                    onChange={(index) => setEndTimeValues((prev) => normalizePickerValues({ ...prev, period: index === 0 ? "AM" : "PM" }))}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                type="button"
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