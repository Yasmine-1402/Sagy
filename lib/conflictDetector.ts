// ============================================
// Conflict Detection Service
// ============================================

import {
  getAppointmentsByDentist,
  getAppointmentsByDate,
  getAppointmentsByPatient,
} from './dataStore';
import { timesOverlap, isWorkingDay, validateWorkingHours, getEndTime } from '../models/Appointment';

export interface ConflictDetail {
  type: 'dentist_overlap' | 'patient_same_day' | 'outside_hours' | 'closed_day' | 'past_date';
  message: string;
  conflictingAppointmentId?: string;
}

export interface ConflictReport {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
  suggestedSlots: string[];
}

/**
 * Check for all types of scheduling conflicts
 */
export function detectConflicts(
  date: string,
  time: string,
  duration: number,
  dentistName: string,
  patientId: string,
  excludeAppointmentId?: string
): ConflictReport {
  const conflicts: ConflictDetail[] = [];

  // 1. Check if date is in the past
  const appointmentDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (appointmentDate < today) {
    conflicts.push({
      type: 'past_date',
      message: 'Cannot schedule appointments in the past.',
    });
  }

  // 2. Check if it's a working day
  if (!isWorkingDay(date)) {
    conflicts.push({
      type: 'closed_day',
      message: 'The clinic is closed on Fridays.',
    });
  }

  // 3. Check working hours
  if (!validateWorkingHours(time)) {
    conflicts.push({
      type: 'outside_hours',
      message: 'Appointment must be between 9:00 AM and 6:00 PM.',
    });
  }

  // Check end time doesn't exceed working hours
  const endTime = getEndTime(time, duration);
  const [endHour] = endTime.split(':').map(Number);
  if (endHour > 18 || (endHour === 18 && parseInt(endTime.split(':')[1]) > 0)) {
    conflicts.push({
      type: 'outside_hours',
      message: `Appointment would end at ${endTime}, which is after clinic closing time (6:00 PM).`,
    });
  }

  // 4. Check dentist schedule overlap
  const dentistAppts = getAppointmentsByDentist(dentistName, date);
  for (const appt of dentistAppts) {
    if (excludeAppointmentId && appt.appointmentId === excludeAppointmentId) continue;
    if (timesOverlap(time, duration, appt.time, appt.duration)) {
      conflicts.push({
        type: 'dentist_overlap',
        message: `Dr. ${dentistName} already has an appointment at ${appt.time} (${appt.patientName}, ${appt.duration} min).`,
        conflictingAppointmentId: appt.appointmentId,
      });
    }
  }

  // 5. Check if patient already has appointment on same day
  const patientAppts = getAppointmentsByPatient(patientId).filter(
    a => a.date === date && a.status !== 'Cancelled' && a.appointmentId !== excludeAppointmentId
  );
  if (patientAppts.length > 0) {
    conflicts.push({
      type: 'patient_same_day',
      message: `Patient already has an appointment on ${date} at ${patientAppts[0].time}.`,
      conflictingAppointmentId: patientAppts[0].appointmentId,
    });
  }

  // Generate suggested alternative slots if conflicts exist
  const suggestedSlots = conflicts.length > 0
    ? findAvailableSlots(date, duration, dentistName, 3)
    : [];

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    suggestedSlots,
  };
}

/**
 * Find available time slots for a given date and dentist
 */
export function findAvailableSlots(
  date: string,
  duration: number,
  dentistName: string,
  maxSlots: number = 3
): string[] {
  if (!isWorkingDay(date)) return [];

  const dentistAppts = getAppointmentsByDentist(dentistName, date)
    .sort((a, b) => a.time.localeCompare(b.time));

  const availableSlots: string[] = [];
  const startHour = 9;
  const endHour = 18;

  // Check every 30-minute slot
  for (let h = startHour; h < endHour; h++) {
    for (const m of [0, 30]) {
      if (availableSlots.length >= maxSlots) break;

      const slotTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const slotEndTime = getEndTime(slotTime, duration);
      const [slotEndH] = slotEndTime.split(':').map(Number);

      // Check if slot ends within working hours
      if (slotEndH > endHour) continue;

      // Check if slot conflicts with any existing appointment
      const hasOverlap = dentistAppts.some(appt =>
        timesOverlap(slotTime, duration, appt.time, appt.duration)
      );

      if (!hasOverlap) {
        availableSlots.push(slotTime);
      }
    }
  }

  return availableSlots;
}
