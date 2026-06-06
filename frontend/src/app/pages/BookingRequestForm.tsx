import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, Send, Paperclip, Save, AlertCircle, Info, MapPin, Users, FileText, Shield, CheckCircle2, XCircle, Calendar as CalendarIcon, Clock, X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { ScrollPicker } from "../components/ScrollPicker";

interface Signature {
  role: string;
  signatory: string;
  required: boolean;
  status: "pending" | "signed";
  priestId?: string;
  priestName?: string;
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

interface DssConflictDetail {
  id: string;
  eventName: string;
  purpose: string;
  requesterName: string;
  venueName: string;
  status: string;
  startDateTime: string;
  endDateTime: string;
  startTimeLabel: string;
  endTimeLabel: string;
  dateLabel: string;
}

interface DssNextAvailableSlot {
  date: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  startTimeLabel: string;
  endTimeLabel: string;
}

interface DssEvaluationResponse {
  allPassed: boolean;
  results: DssRuleResult[];
  recommendation: string;
  canProceed: boolean;
  conflicts?: DssConflictDetail[];
  nextAvailableSlot?: DssNextAvailableSlot | null;
}

interface BookingRecommendationResponse {
  monthLabel: string;
  monthName: string;
  totalRequests: number;
  seasonalContext?: string[];
  topVenues: Array<{ name: string; total: number }>;
  topMinistries: Array<{ name: string; total: number }>;
  topPurposes: Array<{ name: string; total: number }>;
  recommendations: string[];
}

interface DraftRequestResponse {
  id: string;
  venueId: string;
  eventName: string;
  purpose: string;
  startDateTime: string;
  endDateTime: string;
  attendees: number;
  status: string;
  attachments?: RequestAttachment[];
  signatures?: Signature[];
}

interface VenueInfo {
  name: string;
  capacity: number;
  description: string;
  guidelines: string[];
  requiredSignatures: Signature[];
}

const priestSignatureOptions = [
  { id: "priest-sample-1", name: "Fr. Adrian Santos" },
  { id: "priest-sample-2", name: "Fr. Miguel Reyes" },
  { id: "priest-sample-3", name: "Fr. Joseph dela Cruz" },
  { id: "priest-sample-4", name: "Fr. Paul Garcia" },
];

const specificEventOptions = [
  "N/A",
  "Seminar/ Formation",
  "Symposiums",
  "Practicum/ Music Practice",
  "Meeting",
  "Holding Area",
  "Dining Area (Chapels Not Allowed)",
  "Preparation Room (Chapels Not Allowed)",
];

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
            priestId: priestSignatureOptions[0].id,
            priestName: priestSignatureOptions[0].name,
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

function dateInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function timeInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const draftId = searchParams.get("draftId");
  const isMountedRef = useRef(true);
  const today = new Date();
  const todayDateString = today.toISOString().slice(0, 10);
  const [formData, setFormData] = useState({
    venue: "",
    date: todayDateString,
    startTime: "",
    endTime: "",
    purpose: "",
    attendees: "",
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [venues, setVenues] = useState<VenueApi[]>([]);
  const [isLoadingVenues, setIsLoadingVenues] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedVenueInfo, setSelectedVenueInfo] = useState<VenueInfo | null>(null);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [dssResults, setDssResults] = useState<DssRuleResult[]>([]);
  const [dssConflicts, setDssConflicts] = useState<DssConflictDetail[]>([]);
  const [dssNextAvailableSlot, setDssNextAvailableSlot] = useState<DssNextAvailableSlot | null>(null);
  const [dssChecking, setDssChecking] = useState(false);
  const [canProceed, setCanProceed] = useState(false);
  const [bookingRecommendations, setBookingRecommendations] = useState<BookingRecommendationResponse | null>(null);
  const [bookingRecommendationsLoading, setBookingRecommendationsLoading] = useState(false);
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [isDraggingAttachment, setIsDraggingAttachment] = useState(false);

  // Calendar modal state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState(today);

  // Time picker states
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [startTimeValues, setStartTimeValues] = useState<TimePickerValues>(defaultStartTimeValues);
  const [endTimeValues, setEndTimeValues] = useState<TimePickerValues>(defaultEndTimeValues);

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
    document.title = "New Request — CathedralFlow";

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
    if (!draftId) return;

    let isMounted = true;

    async function loadDraft() {
      try {
        setIsLoadingDraft(true);
        const draft = await api.get<DraftRequestResponse>(`/requests/${draftId}`);
        if (!isMounted) return;

        if (draft.status !== "DRAFT") {
          toast.error("This request is no longer a draft.");
          navigate("/requester");
          return;
        }

        setFormData({
          venue: draft.venueId,
          date: dateInputValue(draft.startDateTime) || todayDateString,
          startTime: timeInputValue(draft.startDateTime),
          endTime: timeInputValue(draft.endDateTime),
          purpose: draft.purpose === "Untitled draft" ? "" : draft.purpose,
          attendees: draft.attendees > 1 ? String(draft.attendees) : "",
        });
        setSignatures(draft.signatures ?? []);
      } catch {
        if (isMounted) {
          toast.error("Unable to load draft");
          navigate("/requester");
        }
      } finally {
        if (isMounted) {
          setIsLoadingDraft(false);
        }
      }
    }

    void loadDraft();

    return () => {
      isMounted = false;
    };
  }, [draftId, navigate, todayDateString]);

  useEffect(() => {
    const { venue, date, startTime, endTime, attendees } = formData;

    const attendeeCount = Number(attendees);

    if (!(venue && date && startTime && endTime) || !Number.isFinite(attendeeCount) || attendeeCount <= 0) {
      setDssResults([]);
      setDssConflicts([]);
      setDssNextAvailableSlot(null);
      setCanProceed(false);
      return;
    }

    const selectedVenue = venues.find((item) => item.id === venue);
    if (!selectedVenue) {
      setDssResults([]);
      setDssConflicts([]);
      setDssNextAvailableSlot(null);
      setCanProceed(false);
      return;
    }

    let isMounted = true;

    const evaluateAvailability = async () => {
      setDssChecking(true);

      try {
        const decision = await api.post<DssEvaluationResponse>("/dss/evaluate", {
          venueId: venue,
          requestDate: date,
          startTime,
          endTime,
          attendees: attendeeCount,
          attachmentCount: attachment ? 1 : 0,
          signatures,
        });

        if (isMounted) {
          setDssResults(decision.results ?? []);
          setDssConflicts(decision.conflicts ?? []);
          setDssNextAvailableSlot(decision.nextAvailableSlot ?? null);
          setCanProceed(Boolean(decision.canProceed));
        }
      } catch {
        if (isMounted) {
          setDssResults([]);
          setDssConflicts([]);
          setDssNextAvailableSlot(null);
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

  useEffect(() => {
    if (!formData.date) {
      setBookingRecommendations(null);
      return;
    }

    let isMounted = true;

    const loadRecommendations = async () => {
      setBookingRecommendationsLoading(true);

      try {
        const params: Record<string, string> = { date: formData.date };

        if (formData.venue) {
          params.venueId = formData.venue;
        }

        if (user?.ministryId) {
          params.ministryId = user.ministryId;
        }

        const response = await api.get<BookingRecommendationResponse>("/dss/recommendations", { params });

        if (isMounted) {
          setBookingRecommendations(response);
        }
      } catch {
        if (isMounted) {
          setBookingRecommendations(null);
        }
      } finally {
        if (isMounted) {
          setBookingRecommendationsLoading(false);
        }
      }
    };

    void loadRecommendations();

    return () => {
      isMounted = false;
    };
  }, [formData.date, formData.venue, user?.ministryId]);

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

  const handleSubmit = async (e: React.FormEvent, isDraft: boolean = false) => {
    e.preventDefault();
    
    if (isDraft) {
      try {
        setIsSubmitting(true);
        setSubmitError(null);

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

        const draftPayload = {
          venueId: formData.venue || undefined,
          eventName: formData.purpose.trim() || undefined,
          purpose: formData.purpose.trim() || undefined,
          startDateTime: formData.date && formData.startTime ? combineDateAndTimeToIso(formData.date, formData.startTime) : undefined,
          endDateTime: formData.date && formData.endTime ? combineDateAndTimeToIso(formData.date, formData.endTime) : undefined,
          startTime: formData.startTime || undefined,
          endTime: formData.endTime || undefined,
          attendees: formData.attendees ? Number(formData.attendees) : undefined,
          attachments,
          signatures,
        };

        if (draftId) {
          await api.patch(`/requests/${draftId}/draft`, draftPayload);
        } else {
          await api.post("/requests/draft", draftPayload);
        }

        toast.success("Draft saved", {
          description: "You can continue editing it from My Request Center.",
        });
        navigate("/requester", { state: { message: "Draft saved successfully", filter: "Draft" } });
      } catch (error) {
        setSubmitError("Unable to save draft right now.");
        toast.error("Unable to save draft");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const purpose = formData.purpose.trim();

    if (!formData.venue || !formData.date || !formData.startTime || !formData.endTime || !purpose || !formData.attendees) {
      setSubmitError("Please fill in all required fields");
      return;
    }

    const selectedVenue = venues.find((venue) => venue.id === formData.venue);
    if (!selectedVenue) {
      setSubmitError("Please select a valid venue");
      return;
    }

    const attendeeCount = Number(formData.attendees);
    if (!Number.isFinite(attendeeCount) || attendeeCount <= 0) {
      setSubmitError("Please enter a valid expected attendee count.");
      return;
    }

    if (attendeeCount > selectedVenue.capacity) {
      setSubmitError(`${selectedVenue.name} can only hold up to ${selectedVenue.capacity} people.`);
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

      if (draftId) {
        await api.patch(`/requests/${draftId}/draft`, {
          venueId: selectedVenue.id,
          eventName: purpose,
          purpose,
          startDateTime: combineDateAndTimeToIso(formData.date, formData.startTime),
          endDateTime: combineDateAndTimeToIso(formData.date, formData.endTime),
          startTime: formData.startTime,
          endTime: formData.endTime,
          attendees: attendeeCount,
          specialRequirements: "",
          attachments,
          signatures,
        });
        await api.post(`/requests/${draftId}/submit`);
      } else {
        await api.post("/requests", {
        venueId: selectedVenue.id,
        eventName: purpose,
        purpose,
        startDateTime: combineDateAndTimeToIso(formData.date, formData.startTime),
        endDateTime: combineDateAndTimeToIso(formData.date, formData.endTime),
        startTime: formData.startTime,
        endTime: formData.endTime,
        attendees: attendeeCount,
        specialRequirements: "",
        attachments,
        signatures,
        });
      }

      toast.success("Request submitted successfully");

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
      toast.error("Something went wrong. Please try again.");
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

  const handleAttachmentSelect = (selectedFile: File | null) => {
    if (!selectedFile) {
      return;
    }

    if (selectedFile.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setAttachment(null);
      setSubmitError(
        `Attachment is too large. Please choose a file smaller than ${formatBytes(MAX_ATTACHMENT_SIZE_BYTES)}.`
      );
      return;
    }

    setSubmitError(null);
    setAttachment(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleAttachmentSelect(e.target.files?.[0] ?? null);

    if (e.target.files?.[0]?.size > MAX_ATTACHMENT_SIZE_BYTES) {
      e.target.value = "";
    }
  };

  const handleAttachmentDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingAttachment(false);
    handleAttachmentSelect(event.dataTransfer.files?.[0] ?? null);
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

  const handlePriestSelection = (index: number, priestId: string) => {
    const selectedPriest = priestSignatureOptions.find((option) => option.id === priestId);

    setSignatures((current) => {
      const updated = [...current];
      updated[index] = {
        ...updated[index],
        priestId,
        priestName: selectedPriest?.name ?? "",
      };
      return updated;
    });
  };

  const canSaveDraft = Boolean(formData.venue || formData.startTime || formData.endTime || formData.purpose.trim() || formData.attendees);

  const openStartTimePicker = () => {
    setStartTimeValues(normalizePickerValues(parseTimeForPicker(formData.startTime, defaultStartTimeValues)));
    setShowStartTimePicker((current) => !current);
    setShowCalendar(false);
    setShowEndTimePicker(false);
  };

  const openEndTimePicker = () => {
    setEndTimeValues(normalizePickerValues(parseTimeForPicker(formData.endTime, defaultEndTimeValues)));
    setShowEndTimePicker((current) => !current);
    setShowCalendar(false);
    setShowStartTimePicker(false);
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

  const selectedVenue = venues.find((venue) => venue.id === formData.venue) ?? null;
  const daysUntilEvent = formData.date
    ? Math.ceil((new Date(`${formData.date}T00:00:00`).getTime() - new Date(todayDateString).getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const failedRules = dssResults.filter((result) => !result.passed);
  const hasShortNotice = typeof daysUntilEvent === "number" && daysUntilEvent < 3;
  const selectedVenueDemand = bookingRecommendations?.recommendations.find((message) => message.toLowerCase().includes("selected venue"));
  const isHighDemand = Boolean(selectedVenueDemand && bookingRecommendations && bookingRecommendations.totalRequests >= 5);
  const selectedVenueMonthlyDemand = selectedVenue && bookingRecommendations
    ? bookingRecommendations.topVenues.find((venue) => venue.name === selectedVenue.name)?.total ?? 0
    : 0;
  const peakVenues = bookingRecommendations?.topVenues.slice(0, 3).map((venue) => `${venue.name} (${venue.total})`).join(", ");
  const peakEvents = bookingRecommendations?.topPurposes.slice(0, 3).map((purpose) => `${purpose.name} (${purpose.total})`).join(", ");
  const monthlyDemandDetail = bookingRecommendations
    ? `${bookingRecommendations.monthLabel} demand: ${bookingRecommendations.totalRequests} live booking${bookingRecommendations.totalRequests === 1 ? "" : "s"}. ${peakVenues ? `Peak venues: ${peakVenues}.` : "No peak venue pattern yet."} ${peakEvents ? `Common events: ${peakEvents}.` : "No peak event pattern yet."}`
    : "Not enough booking history is available yet.";
  const bookingAssistantStatus = dssChecking
    ? "Checking"
    : dssConflicts.length > 0
      ? "Conflict Detected"
      : isHighDemand
        ? "High Demand"
        : canProceed
          ? "Ready to Submit"
          : formData.venue && formData.date && formData.startTime && formData.endTime
            ? "Needs Action"
            : "Available";
  const bookingAssistantTone = bookingAssistantStatus === "Conflict Detected"
    ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20"
    : bookingAssistantStatus === "High Demand" || bookingAssistantStatus === "Needs Action"
      ? "bg-[#B45309]/10 text-[#92400E] border-[#B45309]/25 dark:text-amber-300 dark:border-amber-500/20"
      : "bg-[#00A859]/10 text-[#007a41] border-[#00A859]/20 dark:text-[#00A859]";
  const primaryConflict = dssConflicts[0];
  const bookingAssistantMessage = dssChecking
    ? "You should wait a moment while I check the selected venue, time, and requirements."
    : primaryConflict
      ? `${primaryConflict.venueName} is already booked for ${primaryConflict.eventName} from ${primaryConflict.startTimeLabel} to ${primaryConflict.endTimeLabel}. You should choose another time before submitting.`
      : canProceed
        ? "This slot looks available. Your request is ready to submit once your event details and letter are complete."
        : failedRules.length > 0
          ? `This request needs ${failedRules[0].message.toLowerCase()} You should fix this before submitting.`
          : selectedVenue
            ? `Based on the selected details, ${selectedVenue.name} can be checked as soon as you choose a complete date and time.`
            : "You should start by choosing a venue, date, and time so I can check availability and request readiness.";
  const bookingAssistantSubDetail = primaryConflict
    ? `${primaryConflict.eventName} was requested by ${primaryConflict.requesterName} on ${primaryConflict.dateLabel}.`
    : hasShortNotice
      ? `This event is ${daysUntilEvent} day(s) away. Short-notice requests have less time for review.`
      : selectedVenueDemand
        ? selectedVenueDemand
        : monthlyDemandDetail;
  const bookingAssistantDemandInsight = selectedVenue && bookingRecommendations
    ? selectedVenueMonthlyDemand > 0
      ? `${selectedVenue.name} has ${selectedVenueMonthlyDemand} booking${selectedVenueMonthlyDemand === 1 ? "" : "s"} in ${bookingRecommendations.monthName}. ${peakVenues ? `Busiest venues this month: ${peakVenues}.` : ""}`
      : `${selectedVenue.name} has no recorded bookings in ${bookingRecommendations.monthName} yet, so it may be a lighter-demand option.`
    : monthlyDemandDetail;
  const bookingAssistantSuggestion = primaryConflict
    ? dssNextAvailableSlot
      ? `Consider ${dssNextAvailableSlot.startTimeLabel} - ${dssNextAvailableSlot.endTimeLabel} on ${dssNextAvailableSlot.dateLabel}.`
      : "Consider a later time or another venue because no same-day slot fits before closing."
    : hasShortNotice
      ? "You should file earlier next time when possible; for now, add a clear signed letter to help approval move faster."
      : isHighDemand
        ? "Consider another available venue if your schedule is flexible."
        : canProceed
          ? `${bookingAssistantDemandInsight} Review the form once, attach your signed letter, then submit.`
          : `Complete the missing fields so I can give a confident recommendation. ${bookingAssistantDemandInsight}`;
  const bookingAssistantConfidence = dssChecking ? "Evaluating" : dssResults.length > 0 ? `${Math.round((dssResults.filter((result) => result.passed).length / dssResults.length) * 100)}% confidence` : "Needs details";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 shadow-2xl animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none">
        <div className="bg-white/95 px-5 py-4 text-zinc-900 shadow-sm dark:bg-zinc-950/95 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex justify-between items-center gap-4 rounded-2xl border border-[#0F3B8C]/10 bg-[#0F3B8C]/5 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div>
            <h1 className="text-xs font-black tracking-widest uppercase flex items-center gap-2 text-[#0F3B8C] dark:text-blue-300">
              <CalendarIcon className="w-4 h-4 text-[#0F3B8C] dark:text-blue-300" />
              {draftId ? "Edit Draft DSR Request" : "DSR Venue Request Form"}
            </h1>
            <p className="mt-1 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">Required fields, signed-letter upload, DSS validation, and duplicate detection are included.</p>
          </div>
          <button onClick={() => navigate("/requester")} className="text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 p-1.5 rounded-lg transition-colors duration-150">
            <X className="w-5 h-5" />
          </button>
          </div>
        </div>

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* Form */}
        <div>
          <div>
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6 text-left">
              <div className="rounded-2xl border border-[#0F3B8C]/30 bg-gradient-to-br from-[#0F3B8C]/10 to-[#00A859]/5 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#C99700]" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Smart Booking Assistant</h3>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black ${bookingAssistantTone}`}>
                    {bookingAssistantStatus}
                  </span>
                </div>
                <div className="my-3 border-t border-zinc-200 dark:border-zinc-800" />
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{bookingAssistantMessage}</p>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{bookingAssistantSubDetail}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{bookingAssistantSuggestion}</p>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-black text-[#0F3B8C] ring-1 ring-[#0F3B8C]/15 dark:bg-zinc-950/60 dark:text-blue-300">
                    {bookingAssistantConfidence}
                  </span>
                </div>
              </div>
              {/* Venue Selection */}
              <div>
                <label
                  htmlFor="venue"
                  className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5"
                >
                  Venue / Facility <span className="text-rose-500">*</span>
                </label>
                <select
                  id="venue"
                  name="venue"
                  value={formData.venue}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
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

              {/* Expected Attendees */}
              <div>
                <label
                  htmlFor="attendees"
                  className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5"
                >
                  Expected Attendees <span className="text-rose-500">*</span>
                </label>
                <input
                  id="attendees"
                  name="attendees"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={selectedVenue?.capacity}
                  placeholder={selectedVenue ? `Enter 1-${selectedVenue.capacity}` : "Enter expected headcount"}
                  value={formData.attendees}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                  required
                />
                <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                  Enter the exact expected headcount. {selectedVenue ? `${selectedVenue.name} can hold up to ${selectedVenue.capacity} people.` : "Choose a venue to see its capacity."}
                </p>
              </div>

              {/* Date Picker */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                  Event Date <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowCalendar((current) => !current);
                    setShowStartTimePicker(false);
                    setShowEndTimePicker(false);
                  }}
                  className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none text-left flex items-center justify-between group"
                >
                  <span className={formData.date ? "text-zinc-900 dark:text-zinc-100 font-medium" : "text-zinc-400 dark:text-zinc-500"}>
                    {formatDisplayDate(formData.date)}
                  </span>
                  <CalendarIcon className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-[#00A859] transition-colors duration-150" />
                </button>
                {showCalendar && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />
                    <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                        <button
                          type="button"
                          onClick={previousMonth}
                          disabled={isPreviousMonthDisabled}
                          className="rounded-lg p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100">
                          {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </h4>
                        <button
                          type="button"
                          onClick={nextMonth}
                          className="rounded-lg p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="p-2.5">
                        <div className="mb-1.5 grid grid-cols-7 gap-0.5">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                            <div key={day} className="py-1 text-center text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500">
                              {day}
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-0.5">
                          {(() => {
                            const daysInMonth = getDaysInMonth(calendarDate);
                            const firstDay = getFirstDayOfMonth(calendarDate);
                            const days = [];

                            for (let i = 0; i < firstDay; i++) {
                              days.push(<div key={`empty-${i}`} className="aspect-square" />);
                            }

                            for (let day = 1; day <= daysInMonth; day++) {
                              const dateString = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
                                  className={`aspect-square rounded-md text-[11px] font-bold transition-colors duration-150 ${
                                    isSelected
                                      ? "bg-[#0F3B8C] text-white shadow-sm"
                                      : isDisabled
                                        ? "cursor-not-allowed bg-zinc-50 text-zinc-300 dark:bg-zinc-900 dark:text-zinc-600"
                                        : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
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
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-6">
                <div className="relative">
                  <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                    Start Time <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={openStartTimePicker}
                    className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none text-left flex items-center justify-between group"
                  >
                    <span className={formData.startTime ? "text-zinc-900 dark:text-zinc-100 font-medium" : "text-zinc-400 dark:text-zinc-500"}>
                      {formatDisplayTime(formData.startTime)}
                    </span>
                    <Clock className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-[#00A859] transition-colors duration-150" />
                  </button>
                  {showStartTimePicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowStartTimePicker(false)} />
                      <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Start Time</p>
                        </div>
                        <div className="p-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <p className="mb-1.5 text-center text-[9px] font-bold uppercase text-zinc-400 dark:text-zinc-500">Hour</p>
                              <ScrollPicker
                                items={getAllowedHours(startTimeValues.period)}
                                selectedIndex={Math.max(0, getAllowedHours(startTimeValues.period).indexOf(startTimeValues.hour))}
                                onChange={(index) => setStartTimeValues((prev) => normalizePickerValues({
                                  ...prev,
                                  hour: getAllowedHours(prev.period)[index],
                                }))}
                                className="text-xs"
                                compact
                              />
                            </div>
                            <div>
                              <p className="mb-1.5 text-center text-[9px] font-bold uppercase text-zinc-400 dark:text-zinc-500">Minute</p>
                              <ScrollPicker
                                items={Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"))}
                                selectedIndex={startTimeValues.minute / 5}
                                onChange={(index) => setStartTimeValues((prev) => ({ ...prev, minute: index * 5 }))}
                                className="text-xs"
                                compact
                              />
                            </div>
                            <div>
                              <p className="mb-1.5 text-center text-[9px] font-bold uppercase text-zinc-400 dark:text-zinc-500">AM/PM</p>
                              <ScrollPicker
                                items={["AM", "PM"]}
                                selectedIndex={startTimeValues.period === "AM" ? 0 : 1}
                                onChange={(index) => setStartTimeValues((prev) => normalizePickerValues({ ...prev, period: index === 0 ? "AM" : "PM" }))}
                                className="text-xs"
                                compact
                              />
                            </div>
                          </div>
                        </div>
                        <div className="border-t border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950">
                          <button
                            type="button"
                            onClick={applyStartTime}
                            className="w-full rounded-xl bg-[#0F3B8C] px-3 py-2 text-xs font-bold text-white transition-colors duration-150 hover:bg-[#0d3380] hover:text-white dark:hover:bg-[#1a4fab] dark:hover:text-white"
                          >
                            Apply Start Time
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="relative">
                  <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                    End Time <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={openEndTimePicker}
                    className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none text-left flex items-center justify-between group"
                  >
                    <span className={formData.endTime ? "text-zinc-900 dark:text-zinc-100 font-medium" : "text-zinc-400 dark:text-zinc-500"}>
                      {formatDisplayTime(formData.endTime)}
                    </span>
                    <Clock className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-[#00A859] transition-colors duration-150" />
                  </button>
                  {showEndTimePicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowEndTimePicker(false)} />
                      <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
                        <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">End Time</p>
                        </div>
                        <div className="p-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <p className="mb-1.5 text-center text-[9px] font-bold uppercase text-zinc-400 dark:text-zinc-500">Hour</p>
                              <ScrollPicker
                                items={getAllowedHours(endTimeValues.period)}
                                selectedIndex={Math.max(0, getAllowedHours(endTimeValues.period).indexOf(endTimeValues.hour))}
                                onChange={(index) => setEndTimeValues((prev) => normalizePickerValues({
                                  ...prev,
                                  hour: getAllowedHours(prev.period)[index],
                                }))}
                                className="text-xs"
                                compact
                              />
                            </div>
                            <div>
                              <p className="mb-1.5 text-center text-[9px] font-bold uppercase text-zinc-400 dark:text-zinc-500">Minute</p>
                              <ScrollPicker
                                items={Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"))}
                                selectedIndex={endTimeValues.minute / 5}
                                onChange={(index) => setEndTimeValues((prev) => ({ ...prev, minute: index * 5 }))}
                                className="text-xs"
                                compact
                              />
                            </div>
                            <div>
                              <p className="mb-1.5 text-center text-[9px] font-bold uppercase text-zinc-400 dark:text-zinc-500">AM/PM</p>
                              <ScrollPicker
                                items={["AM", "PM"]}
                                selectedIndex={endTimeValues.period === "AM" ? 0 : 1}
                                onChange={(index) => setEndTimeValues((prev) => normalizePickerValues({ ...prev, period: index === 0 ? "AM" : "PM" }))}
                                className="text-xs"
                                compact
                              />
                            </div>
                          </div>
                        </div>
                        <div className="border-t border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950">
                          <button
                            type="button"
                            onClick={applyEndTime}
                            className="w-full rounded-xl bg-[#0F3B8C] px-3 py-2 text-xs font-bold text-white transition-colors duration-150 hover:bg-[#0d3380] hover:text-white dark:hover:bg-[#1a4fab] dark:hover:text-white"
                          >
                            Apply End Time
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              

              {/* Purpose/Description */}
              <div>
                <label
                  htmlFor="purpose"
                  className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5"
                >
                  Specific Event <span className="text-rose-500">*</span>
                </label>
                <select
                  id="purpose"
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleInputChange}
                  className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none resize-none"
                  required
                >
                  <option value="">Select a specific event</option>
                  {specificEventOptions.map((eventName) => (
                    <option key={eventName} value={eventName}>
                      {eventName}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                  Choose the closest event type for this request.
                </p>
              </div>

              {/* Optional Attachment */}
              <div>
                <label
                  htmlFor="attachment"
                  className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5"
                >
                  Signed Request Letter *
                </label>
                <div
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingAttachment(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDraggingAttachment(true);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setIsDraggingAttachment(false);
                    }
                  }}
                  onDrop={handleAttachmentDrop}
                  className={`group relative overflow-hidden rounded-2xl border border-dashed p-6 text-center transition-colors duration-150 ${
                    isDraggingAttachment
                      ? "border-[#0F3B8C] bg-[#0F3B8C]/10 shadow-[0_0_0_4px_rgba(15,59,140,0.12)]"
                      : attachment
                        ? "border-[#00A859]/40 bg-[#00A859]/10"
                        : "border-zinc-300 bg-zinc-50 hover:border-[#0F3B8C]/70 hover:bg-[#0F3B8C]/5 dark:border-zinc-800 dark:bg-[#18181b] dark:hover:border-[#1a4fab] dark:hover:bg-[#0F3B8C]/10"
                  }`}
                >
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10" />
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-[#0F3B8C] shadow-sm transition-colors duration-150 group-hover:border-[#0F3B8C]/30 dark:border-zinc-800 dark:bg-zinc-950 dark:text-blue-300">
                    <Paperclip className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Drop your signed request letter here
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      PDF, image, or document file up to {formatBytes(MAX_ATTACHMENT_SIZE_BYTES)}. You can also browse manually.
                    </p>
                  </div>

                  <label
                    htmlFor="attachment"
                    className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#0F3B8C] px-4 py-2.5 text-xs font-bold text-[#fff] transition-colors duration-150 hover:bg-[#0d3380] hover:text-[#fff] dark:hover:bg-[#1a4fab] dark:hover:text-[#fff]"
                  >
                    Choose file
                  </label>
                  <input
                    id="attachment"
                    name="attachment"
                    type="file"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </div>
                <p className="mt-2 text-[10px] text-zinc-400 dark:text-zinc-500">
                  Upload any supporting documents (e.g., event plan, schedule). Maximum size: {formatBytes(MAX_ATTACHMENT_SIZE_BYTES)}.
                </p>
                {attachment && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#00A859]/30 bg-[#00A859]/10 px-4 py-3 text-xs font-bold text-[#007a41] dark:text-[#00A859]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00A859]/15">
                      <Paperclip className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-900 dark:text-zinc-100">{attachment.name}</p>
                      <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">Selected file ready for submission</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Required Signatures */}
              {signatures.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-[#00A859]" />
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                      Required Signatures
                    </label>
                  </div>
                  
                   <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 p-4">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                      Collect the following signatures before submission. You can still submit without all signatures, but approval may be delayed.
                    </p>
                    
                    <div className="space-y-3">
                      {signatures.map((signature, index) => (
                        <div
                          key={index}
                          className={`p-4 border rounded-lg ${
                            signature.status === "signed"
                              ? "bg-[#00A859]/10 border-[#00A859]/20"
                              : "bg-zinc-50 dark:bg-[#18181b] border-zinc-200 dark:border-zinc-800"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                  {signature.signatory}
                                </p>
                                {signature.required && (
                                  <span className="px-2 py-0.5 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-xs font-medium rounded-full">
                                    Required
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">{signature.role}</p>
                              {signature.status === "signed" && signature.signedDate && (
                                <p className="text-xs text-[#00A859] mt-2">
                                  Signed on {signature.signedDate}
                                </p>
                              )}
                              <div className="mt-3">
                                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase mb-1">
                                  Priest Signatory
                                </label>
                                <select
                                  value={signature.priestId ?? ""}
                                  onChange={(event) => handlePriestSelection(index, event.target.value)}
                                  className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none"
                                >
                                  <option value="">Select priest</option>
                                  {priestSignatureOptions.map((priest) => (
                                    <option key={priest.id} value={priest.id}>
                                      {priest.name}
                                    </option>
                                  ))}
                                </select>
                                {signature.priestName && (
                                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                                    Assigned to {signature.priestName}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {signature.status === "signed" ? (
                                <button
                                  type="button"
                                  onClick={() => markSignatureAsPending(index)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 rounded-md transition-colors duration-150"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Undo
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => markSignatureAsCollected(index)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#00A859] hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 rounded-md transition-colors duration-150"
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
                    <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-sm">
                      <span className="text-zinc-500 dark:text-zinc-400">
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
              <div className="flex gap-2 justify-end pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="submit"
                  disabled={isSubmitting || isLoadingDraft || dssChecking || !canProceed}
                  className="order-3 flex items-center gap-2 px-5 py-2 rounded-xl bg-[#0F3B8C] text-white font-bold text-xs transition-all duration-150 hover:bg-[#0d3380] hover:text-white active:scale-95 dark:hover:bg-[#1a4fab] dark:hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Submitting..." : isLoadingDraft ? "Loading Draft..." : dssChecking ? "Checking DSS..." : draftId ? "Submit Draft" : "Submit Request"}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={isSubmitting || isLoadingDraft || !canSaveDraft}
                  className={`flex items-center gap-2 rounded-xl border border-zinc-300 bg-transparent px-5 py-2 text-xs font-bold text-zinc-700 transition-all duration-150 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
                    canSaveDraft
                      ? ""
                      : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {draftId ? "Update Draft" : "Save as Draft"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/requester")}
                  className="px-4 py-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-150"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Venue Information Panel */}
        <aside className="col-span-1 lg:sticky lg:top-6">
          {selectedVenueInfo ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-[#0F3B8C]/20 rounded-lg">
                  <MapPin className="w-5 h-5 text-[#0F3B8C] dark:text-blue-300" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Venue Information
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                    {selectedVenueInfo.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                    <Users className="w-4 h-4" />
                    <span>Capacity: {selectedVenueInfo.capacity} people</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    {selectedVenueInfo.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                    <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      Usage Guidelines
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {selectedVenueInfo.guidelines.map((guideline, index) => (
                      <li key={index} className="text-sm text-zinc-600 dark:text-zinc-300 flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 bg-[#00A859] rounded-full flex-shrink-0"></span>
                        <span>{guideline}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 bg-[#0F3B8C]/10 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl">
                  <div className="flex items-start gap-2">
                     <Info className="w-4 h-4 text-[#0F3B8C] dark:text-blue-300 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">
                      Please review these guidelines before submitting your request. Compliance with venue rules is required for approval.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 p-8 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full mb-4">
                <MapPin className="w-8 h-8 text-zinc-500 dark:text-zinc-400" />
              </div>
              <p className="text-zinc-900 dark:text-zinc-100 font-medium">Select a venue</p>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                Venue information will appear here
              </p>
            </div>
          )}
        </aside>
      </div>

      </div>
    </div>
  );
}
