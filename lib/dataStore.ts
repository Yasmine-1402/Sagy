// ============================================
// In-Memory Data Store (Swappable to Google Sheets)
// ============================================
// For demo/development, this uses a JSON file.
// In production, swap to the Google Sheets module.

import fs from 'fs';
import path from 'path';
import {
  Patient, Appointment, Reminder,
  generatePatientId, generateAppointmentId, generateReminderId
} from '../models';

const DATA_DIR = path.join(process.cwd(), 'data');
const PATIENTS_FILE = path.join(DATA_DIR, 'patients.json');
const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');
const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON<T>(filePath: string): T[] {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]');
    return [];
  }
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data);
}

function writeJSON<T>(filePath: string, data: T[]): void {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ===================== PATIENTS =====================

export function getAllPatients(): Patient[] {
  return readJSON<Patient>(PATIENTS_FILE);
}

export function getPatientById(id: string): Patient | undefined {
  return getAllPatients().find(p => p.patientId === id);
}

export function createPatient(input: Omit<Patient, 'patientId' | 'noShowCount' | 'totalVisits' | 'createdAt' | 'isActive'>): Patient {
  const patients = getAllPatients();
  const patient: Patient = {
    patientId: generatePatientId(),
    ...input,
    noShowCount: 0,
    totalVisits: 0,
    createdAt: new Date().toISOString(),
    isActive: true,
  };
  patients.push(patient);
  writeJSON(PATIENTS_FILE, patients);
  return patient;
}

export function updatePatient(id: string, updates: Partial<Patient>): Patient | null {
  const patients = getAllPatients();
  const idx = patients.findIndex(p => p.patientId === id);
  if (idx === -1) return null;
  patients[idx] = { ...patients[idx], ...updates };
  writeJSON(PATIENTS_FILE, patients);
  return patients[idx];
}

export function deletePatient(id: string): boolean {
  const patients = getAllPatients();
  const idx = patients.findIndex(p => p.patientId === id);
  if (idx === -1) return false;
  patients[idx].isActive = false;
  writeJSON(PATIENTS_FILE, patients);
  return true;
}

// ===================== APPOINTMENTS =====================

export function getAllAppointments(): Appointment[] {
  return readJSON<Appointment>(APPOINTMENTS_FILE);
}

export function getAppointmentById(id: string): Appointment | undefined {
  return getAllAppointments().find(a => a.appointmentId === id);
}

export function getAppointmentsByDate(date: string): Appointment[] {
  return getAllAppointments().filter(a => a.date === date && a.status !== 'Cancelled');
}

export function getAppointmentsByPatient(patientId: string): Appointment[] {
  return getAllAppointments().filter(a => a.patientId === patientId);
}

export function getAppointmentsByDentist(dentistName: string, date: string): Appointment[] {
  return getAllAppointments().filter(
    a => a.dentistName === dentistName && a.date === date && a.status !== 'Cancelled'
  );
}

export function getTodayAppointments(): Appointment[] {
  const today = new Date().toISOString().split('T')[0];
  return getAppointmentsByDate(today);
}

export function getUpcomingAppointments(hoursAhead: number): Appointment[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const allAppts = getAllAppointments();

  return allAppts.filter(a => {
    if (a.status === 'Cancelled' || a.status === 'Completed' || a.status === 'NoShow') return false;
    const apptDateTime = new Date(`${a.date}T${a.time}:00`);
    return apptDateTime >= now && apptDateTime <= cutoff;
  });
}

export function getPendingReminders(hoursAhead: number = 24): Appointment[] {
  return getUpcomingAppointments(hoursAhead).filter(a => !a.reminderSent);
}

export function createAppointment(input: Omit<Appointment, 'appointmentId' | 'status' | 'reminderSent' | 'createdAt' | 'updatedAt'>): Appointment {
  const appointments = getAllAppointments();
  const appointment: Appointment = {
    appointmentId: generateAppointmentId(input.date),
    ...input,
    status: 'Scheduled',
    reminderSent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  appointments.push(appointment);
  writeJSON(APPOINTMENTS_FILE, appointments);
  return appointment;
}

export function updateAppointment(id: string, updates: Partial<Appointment>): Appointment | null {
  const appointments = getAllAppointments();
  const idx = appointments.findIndex(a => a.appointmentId === id);
  if (idx === -1) return null;
  appointments[idx] = {
    ...appointments[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeJSON(APPOINTMENTS_FILE, appointments);
  return appointments[idx];
}

export function cancelAppointment(id: string, reason: string): Appointment | null {
  return updateAppointment(id, {
    status: 'Cancelled',
    cancellationReason: reason,
  });
}

// ===================== REMINDERS =====================

export function getAllReminders(): Reminder[] {
  return readJSON<Reminder>(REMINDERS_FILE);
}

export function getRemindersByAppointment(appointmentId: string): Reminder[] {
  return getAllReminders().filter(r => r.appointmentId === appointmentId);
}

export function createReminder(input: Omit<Reminder, 'reminderId' | 'sentAt' | 'status' | 'retryCount'>): Reminder {
  const reminders = getAllReminders();
  const reminder: Reminder = {
    reminderId: generateReminderId(),
    ...input,
    sentAt: new Date().toISOString(),
    status: 'Sent',
    retryCount: 0,
  };
  reminders.push(reminder);
  writeJSON(REMINDERS_FILE, reminders);
  return reminder;
}

export function updateReminder(id: string, updates: Partial<Reminder>): Reminder | null {
  const reminders = getAllReminders();
  const idx = reminders.findIndex(r => r.reminderId === id);
  if (idx === -1) return null;
  reminders[idx] = { ...reminders[idx], ...updates };
  writeJSON(REMINDERS_FILE, reminders);
  return reminders[idx];
}

// ===================== ANALYTICS =====================

export function getNoShowRate(): { rate: number; total: number; noShows: number } {
  const all = getAllAppointments().filter(a => a.status === 'Completed' || a.status === 'NoShow');
  const noShows = all.filter(a => a.status === 'NoShow').length;
  return {
    rate: all.length > 0 ? (noShows / all.length) * 100 : 0,
    total: all.length,
    noShows,
  };
}

export function getDailySummary(date: string) {
  const appts = getAppointmentsByDate(date);
  return {
    date,
    total: appts.length,
    confirmed: appts.filter(a => a.status === 'Confirmed').length,
    scheduled: appts.filter(a => a.status === 'Scheduled').length,
    completed: appts.filter(a => a.status === 'Completed').length,
    cancelled: appts.filter(a => a.status === 'Cancelled').length,
    noShow: appts.filter(a => a.status === 'NoShow').length,
  };
}

// ===================== SEED DATA =====================

export function seedDemoData(): void {
  ensureDataDir();

  // Only seed if data files don't exist or are empty
  const existingPatients = getAllPatients();
  if (existingPatients.length > 0) return;

  const dentists = ['Dr. Sarah Ahmed', 'Dr. Omar Hassan', 'Dr. Layla Mansour'];
  const treatments: Array<Appointment['treatmentType']> = ['Checkup', 'Cleaning', 'Filling', 'RootCanal', 'Whitening', 'Consultation'];

  // Create demo patients
  const patients: Patient[] = [
    { patientId: 'PAT-001', fullName: 'Ahmed Ali', phone: '+201012345678', email: 'ahmed@email.com', language: 'AR', preferredChannel: 'WhatsApp', noShowCount: 1, totalVisits: 8, createdAt: '2025-01-15', isActive: true },
    { patientId: 'PAT-002', fullName: 'Sara Mohammed', phone: '+201098765432', email: 'sara@email.com', language: 'AR', preferredChannel: 'SMS', noShowCount: 0, totalVisits: 12, createdAt: '2024-11-20', isActive: true },
    { patientId: 'PAT-003', fullName: 'John Smith', phone: '+14155551234', email: 'john@email.com', language: 'EN', preferredChannel: 'Email', noShowCount: 3, totalVisits: 5, createdAt: '2025-03-10', isActive: true },
    { patientId: 'PAT-004', fullName: 'Fatima Hassan', phone: '+201155556789', email: 'fatima@email.com', language: 'AR', preferredChannel: 'WhatsApp', noShowCount: 0, totalVisits: 20, createdAt: '2024-06-05', isActive: true },
    { patientId: 'PAT-005', fullName: 'Mike Johnson', phone: '+14155559876', email: 'mike@email.com', language: 'EN', preferredChannel: 'SMS', noShowCount: 4, totalVisits: 6, createdAt: '2025-02-28', isActive: true },
    { patientId: 'PAT-006', fullName: 'Nour ElDin', phone: '+201234567890', email: 'nour@email.com', language: 'AR', preferredChannel: 'WhatsApp', noShowCount: 0, totalVisits: 15, createdAt: '2024-09-12', isActive: true },
    { patientId: 'PAT-007', fullName: 'Emily Davis', phone: '+14155554321', email: 'emily@email.com', language: 'EN', preferredChannel: 'Email', noShowCount: 1, totalVisits: 3, createdAt: '2025-04-01', isActive: true },
    { patientId: 'PAT-008', fullName: 'Khaled Youssef', phone: '+201187654321', email: 'khaled@email.com', language: 'AR', preferredChannel: 'SMS', noShowCount: 2, totalVisits: 9, createdAt: '2024-12-15', isActive: true },
  ];
  writeJSON(PATIENTS_FILE, patients);

  // Create demo appointments for today and upcoming days
  const today = new Date();
  const appointments: Appointment[] = [];

  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    if (date.getDay() === 5) continue; // skip Friday
    const dateStr = date.toISOString().split('T')[0];

    const slotsPerDay = Math.floor(Math.random() * 4) + 3;
    for (let slot = 0; slot < slotsPerDay; slot++) {
      const hour = 9 + slot * 1.5;
      const patient = patients[Math.floor(Math.random() * patients.length)];
      const dentist = dentists[Math.floor(Math.random() * dentists.length)];
      const treatment = treatments[Math.floor(Math.random() * treatments.length)];
      const statuses: Appointment['status'][] = dayOffset === 0
        ? ['Confirmed', 'Scheduled', 'Confirmed', 'Scheduled']
        : ['Scheduled', 'Scheduled', 'Confirmed'];

      appointments.push({
        appointmentId: generateAppointmentId(dateStr) + slot,
        patientId: patient.patientId,
        patientName: patient.fullName,
        date: dateStr,
        time: `${Math.floor(hour).toString().padStart(2, '0')}:${hour % 1 === 0.5 ? '30' : '00'}`,
        duration: [30, 45, 60][Math.floor(Math.random() * 3)],
        dentistName: dentist,
        treatmentType: treatment,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        reminderSent: dayOffset === 0,
        notes: '',
        createdAt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  writeJSON(APPOINTMENTS_FILE, appointments);

  // Create demo reminders
  const reminders: Reminder[] = appointments
    .filter(a => a.reminderSent)
    .map(a => ({
      reminderId: generateReminderId(),
      appointmentId: a.appointmentId,
      patientId: a.patientId,
      patientName: a.patientName,
      channel: (['SMS', 'WhatsApp', 'Email'] as const)[Math.floor(Math.random() * 3)],
      type: '24h' as const,
      sentAt: new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      status: (['Sent', 'Delivered'] as const)[Math.floor(Math.random() * 2)],
      messageContent: 'Reminder: Your dental appointment is tomorrow.',
      retryCount: 0,
    }));
  writeJSON(REMINDERS_FILE, reminders);

  console.log(`✅ Seeded: ${patients.length} patients, ${appointments.length} appointments, ${reminders.length} reminders`);
}
