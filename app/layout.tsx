import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DentFlow — Smart Dental Appointment Management',
  description: 'Automated patient appointment scheduling, reminders, and analytics for dental clinics. Reduce no-shows by 40% with intelligent automation.',
  keywords: 'dental clinic, appointment management, patient reminders, automation, UiPath',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
