// ============================================
// Cron Job Scheduler — Automated Reminders
// ============================================
// Schedule automated reminder sending and no-show marking.
// In production, import and call initCronJobs() from server.ts.

import cron from 'node-cron';
import * as dataStore from './dataStore';
import { sendReminder, sendBatchReminders } from './reminderService';

/**
 * Initialize all cron jobs for the clinic.
 * Call this once from your server startup.
 */
export function initCronJobs() {
  console.log('⏰ Initializing cron jobs...\n');

  // ── Every hour: Send 24h reminders for upcoming appointments ──
  cron.schedule('0 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] CRON: Sending 24h reminders...`);
    const result = await sendBatchReminders(24);
    console.log(`  → Sent: ${result.sent}, Failed: ${result.failed}`);
  }, { timezone: 'Africa/Cairo' });

  // ── Every 30 min: Send 2h reminders for imminent appointments ──
  cron.schedule('*/30 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] CRON: Sending 2h reminders...`);
    const upcoming = dataStore.getUpcomingAppointments(2);
    const needsReminder = upcoming.filter(a => a.status === 'Confirmed' || a.status === 'Scheduled');
    let sent = 0;

    for (const appt of needsReminder) {
      const patient = dataStore.getPatientById(appt.patientId);
      if (!patient) continue;

      // Check if a 2h reminder was already sent
      const existingReminders = dataStore.getRemindersByAppointment(appt.appointmentId);
      const already2h = existingReminders.some(r => r.type === '2h');
      if (already2h) continue;

      await sendReminder(appt, patient, '2h');
      sent++;
    }
    console.log(`  → 2h reminders sent: ${sent}`);
  }, { timezone: 'Africa/Cairo' });

  // ── 7 PM daily: Alert staff about unconfirmed appointments ──
  cron.schedule('0 19 * * *', () => {
    console.log(`[${new Date().toISOString()}] CRON: Checking unconfirmed appointments...`);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const unconfirmed = dataStore.getAllAppointments().filter(
      a => a.date === tomorrowStr && a.status === 'Scheduled'
    );

    if (unconfirmed.length > 0) {
      console.log(`  ⚠️ ${unconfirmed.length} unconfirmed appointments for tomorrow:`);
      unconfirmed.forEach(a => {
        console.log(`    - ${a.patientName} at ${a.time} with ${a.dentistName}`);
      });
      // In production: send email alert to clinic manager via Nodemailer
    } else {
      console.log('  ✅ All tomorrow\'s appointments are confirmed.');
    }
  }, { timezone: 'Africa/Cairo' });

  // ── 8 PM daily: Mark no-shows ──
  cron.schedule('0 20 * * *', () => {
    console.log(`[${new Date().toISOString()}] CRON: Marking no-shows...`);
    const today = new Date().toISOString().split('T')[0];
    const todayAppts = dataStore.getAppointmentsByDate(today);

    let marked = 0;
    for (const appt of todayAppts) {
      // If appointment was Scheduled or Confirmed but not completed
      if (appt.status === 'Scheduled' || appt.status === 'Confirmed') {
        const apptTime = new Date(`${appt.date}T${appt.time}:00`);
        const endTime = new Date(apptTime.getTime() + appt.duration * 60000);

        // If the appointment end time has passed
        if (endTime < new Date()) {
          dataStore.updateAppointment(appt.appointmentId, { status: 'NoShow' });
          const patient = dataStore.getPatientById(appt.patientId);
          if (patient) {
            dataStore.updatePatient(patient.patientId, { noShowCount: patient.noShowCount + 1 });
          }
          marked++;
        }
      }
    }
    console.log(`  → Marked ${marked} appointments as no-show.`);
  }, { timezone: 'Africa/Cairo' });

  console.log('✅ Cron jobs initialized:');
  console.log('   • Every hour    — 24h reminder batch');
  console.log('   • Every 30 min  — 2h final reminders');
  console.log('   • 7:00 PM daily — Unconfirmed alert');
  console.log('   • 8:00 PM daily — No-show marking\n');
}
