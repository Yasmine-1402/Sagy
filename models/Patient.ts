// ============================================
// Patient Data Model
// ============================================

export type Language = 'EN' | 'AR' | 'FR';
export type ReminderChannel = 'SMS' | 'WhatsApp' | 'Email';

export interface Patient {
  patientId: string;
  fullName: string;
  phone: string;
  email: string;
  language: Language;
  preferredChannel: ReminderChannel;
  noShowCount: number;
  totalVisits: number;
  createdAt: string;
  isActive: boolean;
}

export interface CreatePatientInput {
  fullName: string;
  phone: string;
  email: string;
  language?: Language;
  preferredChannel?: ReminderChannel;
}

export interface UpdatePatientInput {
  fullName?: string;
  phone?: string;
  email?: string;
  language?: Language;
  preferredChannel?: ReminderChannel;
  isActive?: boolean;
}

/**
 * Validates a phone number (E.164 format)
 */
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  return phoneRegex.test(phone);
}

/**
 * Validates an email address
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generates a unique patient ID: PAT-XXXXXX
 */
export function generatePatientId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'PAT-';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
