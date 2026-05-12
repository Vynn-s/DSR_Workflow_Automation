"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAdvanceNotice = checkAdvanceNotice;
exports.checkCapacity = checkCapacity;
exports.checkMinistryAuthorization = checkMinistryAuthorization;
exports.checkNoConflict = checkNoConflict;
exports.checkBusinessHours = checkBusinessHours;
function buildResult(ruleName, passed, message) {
    return {
        ruleName,
        passed,
        message,
    };
}
function getDayDifference(fromDate, toDate) {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const from = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
    const to = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
    return Math.floor((to - from) / millisecondsPerDay);
}
function parseTimeToMinutes(time) {
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match) {
        return null;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
        return null;
    }
    return hours * 60 + minutes;
}
function checkAdvanceNotice(requestDate, minimumDays) {
    const today = new Date();
    const daysUntilEvent = getDayDifference(today, requestDate);
    const passed = daysUntilEvent >= minimumDays;
    return buildResult("checkAdvanceNotice", passed, passed
        ? `Advance notice requirement met: ${daysUntilEvent} day(s) until event.`
        : `Advance notice requirement not met: only ${daysUntilEvent} day(s) until event, minimum is ${minimumDays}.`);
}
function checkCapacity(attendees, venueCapacity) {
    const passed = attendees <= venueCapacity;
    return buildResult("checkCapacity", passed, passed
        ? `Capacity check passed: ${attendees} attendee(s) for venue capacity ${venueCapacity}.`
        : `Capacity check failed: ${attendees} attendee(s) exceeds venue capacity ${venueCapacity}.`);
}
function checkMinistryAuthorization(ministryId, authorizedMinistryIds) {
    const passed = authorizedMinistryIds.includes(ministryId);
    return buildResult("checkMinistryAuthorization", passed, passed
        ? `Ministry ${ministryId} is authorized for this venue.`
        : `Ministry ${ministryId} is not authorized for this venue.`);
}
function checkNoConflict(hasConflict) {
    const passed = !hasConflict;
    return buildResult("checkNoConflict", passed, passed ? "No scheduling conflict detected." : "Scheduling conflict detected for this venue and time.");
}
function checkBusinessHours(startTime, endTime) {
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);
    const openingMinutes = 6 * 60;
    const closingMinutes = 22 * 60;
    const passed = startMinutes !== null &&
        endMinutes !== null &&
        startMinutes >= openingMinutes &&
        endMinutes <= closingMinutes &&
        endMinutes > startMinutes;
    return buildResult("checkBusinessHours", passed, passed
        ? `Business hours check passed for ${startTime} to ${endTime}.`
        : "Business hours check failed: events must run between 06:00 and 22:00 with a valid start and end time.");
}
//# sourceMappingURL=rules.js.map