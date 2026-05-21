// ============================================
// Twilio Reminder Service
// ============================================
// Handles SMS and WhatsApp message sending via Twilio API

import { Reminder, REMINDER_TEMPLATES, ReminderChannelType, ReminderType } from '../models/Reminder';
import { Appointment } from '../models/Appointment';
import { Patient } from '../models/Patient';
import * as dataStore from './dataStore';

// In production, initialize with: const client = twilio(SID, TOKEN);
// For demo, we simulate Twilio calls

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send a reminder via the patient's preferred channel
 */
export async function sendReminder(
  appointment: Appointment,
  patient: Patient,
  type: ReminderType
): Promise<SendResult> {
  const channel = patient.preferredChannel;
  const lang = patient.language === 'AR' ? 'AR' : 'EN';

  // Build message from template
  let messageContent = '';
  const templates = REMINDER_TEMPLATES[lang];

  switch (type) {
    case '24h':
      messageContent = templates['24h'](appointment.dentistName, appointment.time, appointment.date);
      break;
    case '2h':
      messageContent = templates['2h']('Bright Smile Dental Clinic', appointment.time);
      break;
    case 'Confirmation':
      messageContent = templates['Confirmation'](appointment.dentistName, appointment.date, appointment.time);
      break;
    case 'Cancellation':
      messageContent = templates['Cancellation'](appointment.date, '+201000000000');
      break;
    case 'Reschedule':
      messageContent = templates['Reschedule'](
        appointment.rescheduledFrom || appointment.date,
        appointment.date,
        appointment.time
      );
      break;
    default:
      messageContent = `Your dental appointment on ${appointment.date} at ${appointment.time}. Please contact us for any changes.`;
  }

  // Send via appropriate channel
  let result: SendResult;

  try {
    switch (channel) {
      case 'SMS':
        result = await sendSMS(patient.phone, messageContent);
        break;
      case 'WhatsApp':
        result = await sendWhatsApp(patient.phone, messageContent);
        break;
      case 'Email':
        result = await sendEmailReminder(patient.email, messageContent, appointment);
        break;
      default:
        result = await sendSMS(patient.phone, messageContent);
    }

    // Log the reminder
    dataStore.createReminder({
      appointmentId: appointment.appointmentId,
      patientId: patient.patientId,
      patientName: patient.fullName,
      channel: channel as ReminderChannelType,
      type,
      messageContent,
      errorMessage: result.error,
    });

    // Mark appointment as reminder sent
    if (result.success) {
      dataStore.updateAppointment(appointment.appointmentId, { reminderSent: true });
    }

    return result;
  } catch (error: any) {
    const errorResult: SendResult = {
      success: false,
      error: error.message || 'Unknown error sending reminder',
    };

    dataStore.createReminder({
      appointmentId: appointment.appointmentId,
      patientId: patient.patientId,
      patientName: patient.fullName,
      channel: channel as ReminderChannelType,
      type,
      messageContent,
      errorMessage: errorResult.error,
    });

    return errorResult;
  }
}

/**
 * Send SMS via Twilio
 */
async function sendSMS(to: string, body: string): Promise<SendResult> {
  // ── PRODUCTION CODE (uncomment when Twilio is configured) ──
  // const twilio = require('twilio');
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // const message = await client.messages.create({
  //   body,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   to,
  // });
  // return { success: true, messageId: message.sid };

  // ── DEMO MODE ──
  console.log(`📱 SMS → ${to}: ${body.substring(0, 50)}...`);
  return { success: true, messageId: `SMS-${Date.now()}` };
}

/**
 * Send WhatsApp via Twilio
 */
async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  // ── PRODUCTION CODE ──
  // const twilio = require('twilio');
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // const message = await client.messages.create({
  //   body,
  //   from: process.env.TWILIO_WHATSAPP_NUMBER,
  //   to: `whatsapp:${to}`,
  // });
  // return { success: true, messageId: message.sid };

  // ── DEMO MODE ──
  console.log(`💬 WhatsApp → ${to}: ${body.substring(0, 50)}...`);
  return { success: true, messageId: `WA-${Date.now()}` };
}

/**
 * Send Email reminder
 */
async function sendEmailReminder(to: string, textContent: string, appointment: Appointment): Promise<SendResult> {
  // ── PRODUCTION CODE ──
  // const nodemailer = require('nodemailer');
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST,
  //   port: parseInt(process.env.SMTP_PORT || '587'),
  //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  // });
  // await transporter.sendMail({
  //   from: process.env.SMTP_FROM,
  //   to,
  //   subject: `Dental Appointment Reminder - ${appointment.date}`,
  //   text: textContent,
  //   html: buildEmailHTML(textContent, appointment),
  // });

  // ── DEMO MODE ──
  console.log(`📧 Email → ${to}: ${textContent.substring(0, 50)}...`);
  return { success: true, messageId: `EMAIL-${Date.now()}` };
}

/**
 * Send batch reminders for all pending appointments
 */
export async function sendBatchReminders(hoursAhead: number = 24): Promise<{
  sent: number;
  failed: number;
  results: Array<{ appointmentId: string; success: boolean; error?: string }>;
}> {
  const pending = dataStore.getPendingReminders(hoursAhead);
  const results: Array<{ appointmentId: string; success: boolean; error?: string }> = [];
  let sent = 0;
  let failed = 0;

  for (const appointment of pending) {
    const patient = dataStore.getPatientById(appointment.patientId);
    if (!patient) {
      results.push({ appointmentId: appointment.appointmentId, success: false, error: 'Patient not found' });
      failed++;
      continue;
    }

    const result = await sendReminder(appointment, patient, '24h');
    results.push({
      appointmentId: appointment.appointmentId,
      success: result.success,
      error: result.error,
    });

    if (result.success) sent++;
    else failed++;
  }

  return { sent, failed, results };
}
