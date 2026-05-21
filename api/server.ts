// ============================================
// Express.js API Server
// ============================================

import express from 'express';
import cors from 'cors';
import * as dataStore from '../lib/dataStore';
import { detectConflicts, findAvailableSlots } from '../lib/conflictDetector';
import { sendReminder, sendBatchReminders } from '../lib/reminderService';
import { initCronJobs } from '../lib/cronScheduler';
import {
  validatePhone, validateEmail,
  validateAppointmentDate, validateWorkingHours, isWorkingDay,
} from '../models';

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

// Seed demo data on startup
dataStore.seedDemoData();

// Start automated cron jobs (reminders, no-show marking)
initCronJobs();

// ===================== HEALTH CHECK =====================

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===================== PATIENTS =====================

app.get('/api/patients', (_req, res) => {
  const patients = dataStore.getAllPatients().filter(p => p.isActive);
  res.json({ success: true, data: patients, count: patients.length });
});

app.get('/api/patients/:id', (req, res) => {
  const patient = dataStore.getPatientById(req.params.id);
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });
  const appointments = dataStore.getAppointmentsByPatient(req.params.id);
  res.json({ success: true, data: { ...patient, appointments } });
});

app.post('/api/patients', (req, res) => {
  const { fullName, phone, email, language, preferredChannel } = req.body;

  if (!fullName || !phone || !email) {
    return res.status(400).json({ success: false, error: 'fullName, phone, and email are required' });
  }
  if (!validatePhone(phone)) {
    return res.status(400).json({ success: false, error: 'Invalid phone number format. Use E.164 (e.g., +201012345678)' });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email address' });
  }

  const patient = dataStore.createPatient({
    fullName,
    phone,
    email,
    language: language || 'EN',
    preferredChannel: preferredChannel || 'SMS',
  });

  res.status(201).json({ success: true, data: patient });
});

app.put('/api/patients/:id', (req, res) => {
  const updated = dataStore.updatePatient(req.params.id, req.body);
  if (!updated) return res.status(404).json({ success: false, error: 'Patient not found' });
  res.json({ success: true, data: updated });
});

app.delete('/api/patients/:id', (req, res) => {
  const deleted = dataStore.deletePatient(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Patient not found' });
  res.json({ success: true, message: 'Patient deactivated' });
});

// ===================== APPOINTMENTS =====================

app.get('/api/appointments', (req, res) => {
  let appointments = dataStore.getAllAppointments();

  // Filters
  if (req.query.date) appointments = appointments.filter(a => a.date === req.query.date);
  if (req.query.dentist) appointments = appointments.filter(a => a.dentistName === req.query.dentist);
  if (req.query.status) appointments = appointments.filter(a => a.status === req.query.status);
  if (req.query.patientId) appointments = appointments.filter(a => a.patientId === req.query.patientId);

  // Sort by date and time
  appointments.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    return dateCompare !== 0 ? dateCompare : a.time.localeCompare(b.time);
  });

  res.json({ success: true, data: appointments, count: appointments.length });
});

app.get('/api/appointments/today', (_req, res) => {
  const appointments = dataStore.getTodayAppointments();
  appointments.sort((a, b) => a.time.localeCompare(b.time));
  res.json({ success: true, data: appointments, count: appointments.length });
});

app.get('/api/appointments/conflicts', (req, res) => {
  const { date, time, duration, dentist, patientId, excludeId } = req.query;
  if (!date || !time || !dentist || !patientId) {
    return res.status(400).json({ success: false, error: 'date, time, dentist, and patientId are required' });
  }

  const report = detectConflicts(
    date as string,
    time as string,
    parseInt(duration as string) || 30,
    dentist as string,
    patientId as string,
    excludeId as string
  );

  res.json({ success: true, data: report });
});

app.get('/api/appointments/available-slots', (req, res) => {
  const { date, duration, dentist } = req.query;
  if (!date || !dentist) {
    return res.status(400).json({ success: false, error: 'date and dentist are required' });
  }
  const slots = findAvailableSlots(
    date as string,
    parseInt(duration as string) || 30,
    dentist as string,
    10
  );
  res.json({ success: true, data: slots });
});

app.get('/api/appointments/:id', (req, res) => {
  const appointment = dataStore.getAppointmentById(req.params.id);
  if (!appointment) return res.status(404).json({ success: false, error: 'Appointment not found' });
  res.json({ success: true, data: appointment });
});

app.post('/api/appointments', (req, res) => {
  const { patientId, patientName, date, time, duration, dentistName, treatmentType, notes } = req.body;

  if (!patientId || !patientName || !date || !time || !dentistName || !treatmentType) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  // Validate
  if (!validateAppointmentDate(date)) {
    return res.status(400).json({ success: false, error: 'Cannot schedule in the past' });
  }

  // Conflict check
  const conflicts = detectConflicts(date, time, duration || 30, dentistName, patientId);
  if (conflicts.hasConflict) {
    return res.status(409).json({
      success: false,
      error: 'Scheduling conflict detected',
      conflicts: conflicts.conflicts,
      suggestedSlots: conflicts.suggestedSlots,
    });
  }

  const appointment = dataStore.createAppointment({
    patientId,
    patientName,
    date,
    time,
    duration: duration || 30,
    dentistName,
    treatmentType,
    notes: notes || '',
  });

  res.status(201).json({ success: true, data: appointment });
});

app.put('/api/appointments/:id', (req, res) => {
  const existing = dataStore.getAppointmentById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, error: 'Appointment not found' });

  // If rescheduling (date or time changed), run conflict check
  if (req.body.date || req.body.time) {
    const newDate = req.body.date || existing.date;
    const newTime = req.body.time || existing.time;
    const newDuration = req.body.duration || existing.duration;
    const newDentist = req.body.dentistName || existing.dentistName;

    const conflicts = detectConflicts(newDate, newTime, newDuration, newDentist, existing.patientId, existing.appointmentId);
    if (conflicts.hasConflict) {
      return res.status(409).json({
        success: false,
        error: 'Rescheduling conflict',
        conflicts: conflicts.conflicts,
        suggestedSlots: conflicts.suggestedSlots,
      });
    }
  }

  const updated = dataStore.updateAppointment(req.params.id, req.body);
  res.json({ success: true, data: updated });
});

app.put('/api/appointments/:id/cancel', (req, res) => {
  const { reason } = req.body;
  const cancelled = dataStore.cancelAppointment(req.params.id, reason || 'No reason provided');
  if (!cancelled) return res.status(404).json({ success: false, error: 'Appointment not found' });

  // Send cancellation notification
  const patient = dataStore.getPatientById(cancelled.patientId);
  if (patient) {
    sendReminder(cancelled, patient, 'Cancellation').catch(console.error);
  }

  res.json({ success: true, data: cancelled });
});

app.put('/api/appointments/:id/status', (req, res) => {
  const { status } = req.body;
  const validStatuses = ['Scheduled', 'Confirmed', 'Cancelled', 'Completed', 'NoShow', 'Rescheduled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const updated = dataStore.updateAppointment(req.params.id, { status });
  if (!updated) return res.status(404).json({ success: false, error: 'Appointment not found' });

  // Update patient no-show count
  if (status === 'NoShow') {
    const patient = dataStore.getPatientById(updated.patientId);
    if (patient) {
      dataStore.updatePatient(patient.patientId, { noShowCount: patient.noShowCount + 1 });
    }
  }
  if (status === 'Completed') {
    const patient = dataStore.getPatientById(updated.patientId);
    if (patient) {
      dataStore.updatePatient(patient.patientId, { totalVisits: patient.totalVisits + 1 });
    }
  }

  res.json({ success: true, data: updated });
});

// ===================== REMINDERS =====================

app.post('/api/reminders/send/:appointmentId', async (req, res) => {
  const appointment = dataStore.getAppointmentById(req.params.appointmentId);
  if (!appointment) return res.status(404).json({ success: false, error: 'Appointment not found' });

  const patient = dataStore.getPatientById(appointment.patientId);
  if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });

  const type = req.body.type || '24h';
  
  // If the frontend explicitly requests an email, temporarily override the patient's preferred channel
  if (req.body.forceChannel) {
    patient.preferredChannel = req.body.forceChannel;
  }

  const result = await sendReminder(appointment, patient, type);
  res.json({ success: result.success, data: result });
});

app.post('/api/reminders/send-batch', async (_req, res) => {
  const results = await sendBatchReminders(24);
  res.json({ success: true, data: results });
});

app.get('/api/reminders/log', (req, res) => {
  let reminders = dataStore.getAllReminders();
  if (req.query.appointmentId) {
    reminders = reminders.filter(r => r.appointmentId === req.query.appointmentId);
  }
  if (req.query.channel) {
    reminders = reminders.filter(r => r.channel === req.query.channel);
  }
  if (req.query.status) {
    reminders = reminders.filter(r => r.status === req.query.status);
  }
  // Sort by most recent first
  reminders.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  res.json({ success: true, data: reminders, count: reminders.length });
});

// ===================== ANALYTICS =====================

app.get('/api/analytics/no-show-rate', (_req, res) => {
  const data = dataStore.getNoShowRate();
  res.json({ success: true, data });
});

app.get('/api/analytics/daily-summary', (req, res) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const data = dataStore.getDailySummary(date);
  res.json({ success: true, data });
});

app.get('/api/analytics/overview', (_req, res) => {
  const allAppts = dataStore.getAllAppointments();
  const allPatients = dataStore.getAllPatients().filter(p => p.isActive);
  const allReminders = dataStore.getAllReminders();
  const today = new Date().toISOString().split('T')[0];
  const todayAppts = allAppts.filter(a => a.date === today);

  res.json({
    success: true,
    data: {
      totalPatients: allPatients.length,
      totalAppointments: allAppts.length,
      todayAppointments: todayAppts.length,
      pendingConfirmations: todayAppts.filter(a => a.status === 'Scheduled').length,
      confirmedToday: todayAppts.filter(a => a.status === 'Confirmed').length,
      noShowRate: dataStore.getNoShowRate(),
      remindersSentToday: allReminders.filter(r => r.sentAt.startsWith(today)).length,
      upcomingReminders: dataStore.getPendingReminders(24).length,
    },
  });
});

// ===================== UIPATH INTEGRATION =====================

// Middleware: API key check for UiPath endpoints
function uipathAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKey = req.headers['x-uipath-key'];
  if (!apiKey || apiKey !== (process.env.UIPATH_API_KEY || 'demo-key')) {
    // In demo mode, allow all requests
    if (process.env.NODE_ENV !== 'production') return next();
    return res.status(401).json({ success: false, error: 'Invalid API key' });
  }
  next();
}

app.get('/api/uipath/pending-reminders', uipathAuth, (_req, res) => {
  const pending = dataStore.getPendingReminders(24);
  // Flatten for UiPath's/n8n's Deserialize JSON activity
  const flat = pending.map(a => ({
    AppointmentID: a.appointmentId,
    PatientID: a.patientId,
    PatientName: a.patientName,
    Date: a.date,
    Time: a.time,
    Duration: a.duration,
    DentistName: a.dentistName,
    TreatmentType: a.treatmentType,
    Status: a.status,
  }));
  res.json({ TransactionItems: flat, Count: flat.length });
});

app.post('/api/uipath/update-status', uipathAuth, (req, res) => {
  const { appointmentId, status, notes } = req.body;
  const updated = dataStore.updateAppointment(appointmentId, { status, notes });
  if (!updated) return res.status(404).json({ success: false, error: 'Appointment not found' });
  res.json({ success: true, data: updated });
});

app.post('/api/uipath/log-exception', uipathAuth, (req, res) => {
  const { appointmentId, errorType, errorMessage, timestamp } = req.body;
  console.error(`⚠️ UiPath Exception [${errorType}] for ${appointmentId}: ${errorMessage} at ${timestamp}`);
  // In production: send alert email to staff, log to database
  res.json({ success: true, message: 'Exception logged' });
});

app.get('/api/uipath/daily-sheet', uipathAuth, (_req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const appointments = dataStore.getAppointmentsByDate(today);
  // CSV-friendly flat format for Excel
  const rows = appointments.map(a => ({
    AppointmentID: a.appointmentId,
    PatientName: a.patientName,
    Date: a.date,
    Time: a.time,
    Duration: a.duration,
    Dentist: a.dentistName,
    Treatment: a.treatmentType,
    Status: a.status,
    ReminderSent: a.reminderSent ? 'Yes' : 'No',
  }));
  res.json({ data: rows, count: rows.length, generatedAt: new Date().toISOString() });
});

// ===================== DENTISTS =====================

app.get('/api/dentists', (_req, res) => {
  // In a real app, this would come from the database
  res.json({
    success: true,
    data: [
      { id: 'DEN-001', name: 'Dr. Sarah Ahmed', specialty: 'General Dentistry' },
      { id: 'DEN-002', name: 'Dr. Omar Hassan', specialty: 'Orthodontics' },
      { id: 'DEN-003', name: 'Dr. Layla Mansour', specialty: 'Cosmetic Dentistry' },
    ],
  });
});

// ===================== START SERVER =====================

app.listen(PORT, () => {
  console.log(`\n🦷 Dental Clinic API running on http://localhost:${PORT}`);
  console.log(`📋 API Docs: http://localhost:${PORT}/api/health`);
  console.log(`🤖 UiPath endpoint: http://localhost:${PORT}/api/uipath/pending-reminders\n`);
});

export default app;
