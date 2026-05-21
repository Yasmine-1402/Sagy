// ============================================
// Reminder Data Model
// ============================================

export type ReminderChannelType = 'SMS' | 'WhatsApp' | 'Email';
export type ReminderStatus = 'Pending' | 'Sent' | 'Delivered' | 'Failed' | 'Read';
export type ReminderType = '24h' | '2h' | 'Confirmation' | 'Cancellation' | 'Reschedule' | 'Custom';

export interface Reminder {
  reminderId: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  channel: ReminderChannelType;
  type: ReminderType;
  sentAt: string;
  status: ReminderStatus;
  messageContent: string;
  errorMessage?: string;
  retryCount: number;
}

export interface CreateReminderInput {
  appointmentId: string;
  patientId: string;
  patientName: string;
  channel: ReminderChannelType;
  type: ReminderType;
  messageContent: string;
}

/**
 * Generates a unique reminder ID: REM-XXXXXXX
 */
export function generateReminderId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `REM-${timestamp}${random}`.toUpperCase();
}

/**
 * Multi-language reminder templates
 */
export const REMINDER_TEMPLATES = {
  EN: {
    '24h': (dentist: string, time: string, date: string) =>
      `🦷 Reminder: Your dental appointment with Dr. ${dentist} is tomorrow (${date}) at ${time}. Reply C to confirm or R to reschedule.`,
    '2h': (clinic: string, time: string) =>
      `⏰ Your dental appointment is in 2 hours at ${clinic}. Please arrive 10 minutes early. See you soon!`,
    'Confirmation': (dentist: string, date: string, time: string) =>
      `✅ Confirmed! Your appointment with Dr. ${dentist} on ${date} at ${time} is confirmed. Thank you!`,
    'Cancellation': (date: string, phone: string) =>
      `❌ Your appointment on ${date} has been cancelled. Call ${phone} to reschedule.`,
    'Reschedule': (oldDate: string, newDate: string, newTime: string) =>
      `🔄 Your appointment has been rescheduled from ${oldDate} to ${newDate} at ${newTime}. Reply C to confirm.`,
  },
  AR: {
    '24h': (dentist: string, time: string, date: string) =>
      `🦷 تذكير: موعدك مع الدكتور ${dentist} غداً (${date}) الساعة ${time}. أرسل ت للتأكيد أو ج لإعادة الجدولة.`,
    '2h': (clinic: string, time: string) =>
      `⏰ موعدك بعد ساعتين في ${clinic}. يرجى الحضور قبل 10 دقائق. نراكم قريباً!`,
    'Confirmation': (dentist: string, date: string, time: string) =>
      `✅ تم التأكيد! موعدك مع الدكتور ${dentist} يوم ${date} الساعة ${time} مؤكد. شكراً!`,
    'Cancellation': (date: string, phone: string) =>
      `❌ تم إلغاء موعدك يوم ${date}. اتصل بـ ${phone} لإعادة الحجز.`,
    'Reschedule': (oldDate: string, newDate: string, newTime: string) =>
      `🔄 تم تغيير موعدك من ${oldDate} إلى ${newDate} الساعة ${newTime}. أرسل ت للتأكيد.`,
  },
} as const;
