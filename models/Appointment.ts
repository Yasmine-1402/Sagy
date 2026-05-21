// ============================================
// Appointment Data Model
// ============================================

export type AppointmentStatus =
  | 'Scheduled'
  | 'Confirmed'
  | 'Cancelled'
  | 'Completed'
  | 'NoShow'
  | 'Rescheduled';

export type TreatmentType =
  | 'Checkup'
  | 'Cleaning'
  | 'Filling'
  | 'RootCanal'
  | 'Extraction'
  | 'Whitening'
  | 'Braces'
  | 'Crown'
  | 'Bridge'
  | 'Implant'
  | 'Consultation'
  | 'Emergency'
  | 'Other';

export interface Appointment {
  appointmentId: string;
  patientId: string;
  patientName: string;
  date: string;           // YYYY-MM-DD
  time: string;           // HH:mm (24h)
  duration: number;       // minutes
  dentistName: string;
  treatmentType: TreatmentType;
  status: AppointmentStatus;
  reminderSent: boolean;
  notes: string;
  cancellationReason?: string;
  rescheduledFrom?: string;  // original appointmentId
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentInput {
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  duration?: number;
  dentistName: string;
  treatmentType: TreatmentType;
  notes?: string;
}

export interface UpdateAppointmentInput {
  date?: string;
  time?: string;
  duration?: number;
  dentistName?: string;
  treatmentType?: TreatmentType;
  status?: AppointmentStatus;
  notes?: string;
  cancellationReason?: string;
}

/**
 * Generates a unique appointment ID: APT-YYYYMMDD-XXX
 */
export function generateAppointmentId(date: string): string {
  const dateStr = date.replace(/-/g, '');
  const randomPart = Math.floor(Math.random() * 900 + 100).toString();
  return `APT-${dateStr}-${randomPart}`;
}

/**
 * Validates that date is not in the past
 */
export function validateAppointmentDate(date: string): boolean {
  const appointmentDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return appointmentDate >= today;
}

/**
 * Validates clinic working hours (9 AM - 6 PM)
 */
export function validateWorkingHours(time: string): boolean {
  const [hours] = time.split(':').map(Number);
  return hours >= 9 && hours < 18;
}

/**
 * Checks if the day is a working day (Sat-Thu, closed Friday)
 */
export function isWorkingDay(date: string): boolean {
  const day = new Date(date).getDay();
  return day !== 5; // 5 = Friday
}

/**
 * Calculates end time from start time and duration
 */
export function getEndTime(time: string, durationMinutes: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

/**
 * Checks if two time ranges overlap
 */
export function timesOverlap(
  start1: string, duration1: number,
  start2: string, duration2: number
): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const s1 = toMinutes(start1);
  const e1 = s1 + duration1;
  const s2 = toMinutes(start2);
  const e2 = s2 + duration2;
  return s1 < e2 && s2 < e1;
}
