'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Appointment {
  appointmentId: string;
  patientName: string;
  date: string;
  time: string;
  duration: number;
  dentistName: string;
  treatmentType: string;
  status: string;
  reminderSent: boolean;
}

interface Patient {
  patientId: string;
  fullName: string;
  noShowCount: number;
  totalVisits: number;
}

interface ReminderLog {
  channel: string;
  status: string;
  sentAt: string;
}

export default function AnalyticsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [reminders, setReminders] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [apptRes, patRes, remRes] = await Promise.all([
        fetch(`${API_URL}/appointments`),
        fetch(`${API_URL}/patients`),
        fetch(`${API_URL}/reminders/log`),
      ]);
      const apptData = await apptRes.json();
      const patData = await patRes.json();
      const remData = await remRes.json();
      setAppointments(apptData.data || []);
      setPatients(patData.data || []);
      setReminders(remData.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Computed analytics ──
  const totalAppts = appointments.length;
  const completed = appointments.filter(a => a.status === 'Completed').length;
  const noShows = appointments.filter(a => a.status === 'NoShow').length;
  const cancelled = appointments.filter(a => a.status === 'Cancelled').length;
  const confirmed = appointments.filter(a => a.status === 'Confirmed').length;
  const noShowRate = (completed + noShows) > 0 ? (noShows / (completed + noShows) * 100) : 0;

  // Reminder effectiveness
  const remindersDelivered = reminders.filter(r => r.status === 'Delivered').length;
  const remindersFailed = reminders.filter(r => r.status === 'Failed').length;
  const remindersSent = reminders.filter(r => r.status === 'Sent').length;

  // Channel breakdown
  const smsCnt = reminders.filter(r => r.channel === 'SMS').length;
  const waCnt = reminders.filter(r => r.channel === 'WhatsApp').length;
  const emailCnt = reminders.filter(r => r.channel === 'Email').length;

  // Top no-show patients
  const topNoShows = [...patients]
    .filter(p => p.noShowCount > 0)
    .sort((a, b) => b.noShowCount - a.noShowCount)
    .slice(0, 5);

  // Daily appointment distribution (hour of day)
  const hourDistribution: Record<number, number> = {};
  for (let h = 9; h < 18; h++) hourDistribution[h] = 0;
  appointments.forEach(a => {
    const h = parseInt(a.time.split(':')[0]);
    if (hourDistribution[h] !== undefined) hourDistribution[h]++;
  });
  const maxHourCount = Math.max(...Object.values(hourDistribution), 1);

  // Dentist workload
  const dentistWorkload: Record<string, number> = {};
  appointments.filter(a => a.status !== 'Cancelled').forEach(a => {
    dentistWorkload[a.dentistName] = (dentistWorkload[a.dentistName] || 0) + 1;
  });

  // Treatment type breakdown
  const treatmentBreakdown: Record<string, number> = {};
  appointments.forEach(a => {
    treatmentBreakdown[a.treatmentType] = (treatmentBreakdown[a.treatmentType] || 0) + 1;
  });
  const topTreatments = Object.entries(treatmentBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxTreatment = Math.max(...topTreatments.map(([, v]) => v), 1);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="logo-icon">🦷</div><h1>DentFlow</h1></div>
        <nav className="sidebar-nav">
          <div className="nav-section-title">Menu</div>
          <a href="/" className="nav-item"><span className="nav-icon">📊</span><span className="nav-label">Dashboard</span></a>
          <a href="/appointments" className="nav-item"><span className="nav-icon">📅</span><span className="nav-label">Appointments</span></a>
          <a href="/patients" className="nav-item"><span className="nav-icon">👥</span><span className="nav-label">Patients</span></a>
          <a href="/reminders" className="nav-item"><span className="nav-icon">🔔</span><span className="nav-label">Reminders</span></a>
          <a href="/analytics" className="nav-item active"><span className="nav-icon">📈</span><span className="nav-label">Analytics</span></a>
        </nav>
      </aside>

      <header className="topbar">
        <div className="topbar-left"><h2 className="topbar-title">Analytics</h2></div>
        <div className="topbar-right" />
      </header>

      <main className="main-content">
        <div className="page-container">
          <div className="page-header">
            <div>
              <h2>Clinic Analytics</h2>
              <p className="page-subtitle">Performance overview and insights</p>
            </div>
          </div>

          {loading ? (
            <div className="stats-grid">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="stat-card">
                  <div className="skeleton" style={{ height: '16px', width: '120px', marginBottom: '12px' }} />
                  <div className="skeleton" style={{ height: '36px', width: '60px' }} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* ── KPI Cards ── */}
              <div className="stats-grid">
                <div className="stat-card teal">
                  <div className="stat-header"><span className="stat-label">Total Patients</span><div className="stat-icon">👥</div></div>
                  <div className="stat-value">{patients.length}</div>
                </div>
                <div className="stat-card blue">
                  <div className="stat-header"><span className="stat-label">Total Appointments</span><div className="stat-icon">📅</div></div>
                  <div className="stat-value">{totalAppts}</div>
                  <div className="stat-change">{confirmed} confirmed</div>
                </div>
                <div className="stat-card amber">
                  <div className="stat-header"><span className="stat-label">No-Show Rate</span><div className="stat-icon">⚠️</div></div>
                  <div className="stat-value">{noShowRate.toFixed(1)}%</div>
                  <div className="stat-change negative">{noShows} no-shows</div>
                </div>
                <div className="stat-card purple">
                  <div className="stat-header"><span className="stat-label">Reminders Sent</span><div className="stat-icon">📨</div></div>
                  <div className="stat-value">{reminders.length}</div>
                  <div className="stat-change positive">{remindersDelivered} delivered</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                {/* ── Appointment Status Breakdown ── */}
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>Appointment Status</h3>
                  {[
                    { label: 'Completed', count: completed, color: 'var(--status-completed)', icon: '✅' },
                    { label: 'Confirmed', count: confirmed, color: 'var(--status-confirmed)', icon: '🟢' },
                    { label: 'Scheduled', count: appointments.filter(a => a.status === 'Scheduled').length, color: 'var(--status-scheduled)', icon: '🔵' },
                    { label: 'No-Show', count: noShows, color: 'var(--status-noshow)', icon: '⚠️' },
                    { label: 'Cancelled', count: cancelled, color: 'var(--status-cancelled)', icon: '❌' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <span style={{ width: '24px', textAlign: 'center' }}>{item.icon}</span>
                      <span style={{ flex: '0 0 100px', fontSize: '13px', color: 'var(--text-secondary)' }}>{item.label}</span>
                      <div style={{ flex: 1, height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${totalAppts > 0 ? (item.count / totalAppts * 100) : 0}%`,
                          height: '100%', background: item.color, borderRadius: '4px',
                          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                        }} />
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: item.color, width: '40px', textAlign: 'right' }}>{item.count}</span>
                    </div>
                  ))}
                </div>

                {/* ── Reminder Channel Distribution ── */}
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>Reminder Channels</h3>
                  <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '24px' }}>
                    {[
                      { label: 'SMS', count: smsCnt, color: 'var(--accent-blue)', icon: '📱' },
                      { label: 'WhatsApp', count: waCnt, color: 'var(--accent-teal)', icon: '💬' },
                      { label: 'Email', count: emailCnt, color: 'var(--accent-purple)', icon: '📧' },
                    ].map(ch => (
                      <div key={ch.label} style={{ textAlign: 'center' }}>
                        <div style={{
                          width: '64px', height: '64px', borderRadius: '50%',
                          background: `${ch.color}22`, display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: '24px', margin: '0 auto 8px',
                        }}>
                          {ch.icon}
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: ch.color }}>{ch.count}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ch.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Success rate: <span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>
                      {reminders.length > 0 ? ((remindersDelivered / reminders.length) * 100).toFixed(0) : 0}%
                    </span>
                    &nbsp;·&nbsp;
                    Failed: <span style={{ color: 'var(--status-cancelled)', fontWeight: 600 }}>{remindersFailed}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                {/* ── Peak Hours Heatmap ── */}
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>Peak Hours</h3>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '160px' }}>
                    {Object.entries(hourDistribution).map(([h, count]) => {
                      const height = (count / maxHourCount) * 100;
                      const hNum = parseInt(h);
                      return (
                        <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{count}</div>
                          <div style={{
                            width: '100%', height: `${Math.max(height, 4)}%`,
                            background: `linear-gradient(to top, var(--accent-teal), ${count > maxHourCount * 0.7 ? 'var(--status-noshow)' : 'var(--accent-blue)'})`,
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                            opacity: count > 0 ? 1 : 0.2,
                          }} />
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
                            {hNum > 12 ? `${hNum - 12}P` : hNum === 12 ? '12P' : `${hNum}A`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Treatment Types ── */}
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>Top Treatments</h3>
                  {topTreatments.map(([name, count]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                      <span style={{ flex: '0 0 100px', fontSize: '13px', color: 'var(--text-secondary)' }}>{name}</span>
                      <div style={{ flex: 1, height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${(count / maxTreatment) * 100}%`,
                          height: '100%', background: 'linear-gradient(90deg, var(--accent-teal), var(--accent-blue))',
                          borderRadius: '3px', transition: 'width 0.8s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', width: '30px', textAlign: 'right' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* ── Dentist Workload ── */}
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>Dentist Workload</h3>
                  {Object.entries(dentistWorkload).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
                    const maxWork = Math.max(...Object.values(dentistWorkload), 1);
                    return (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'rgba(59,130,246,0.15)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                        }}>🦷</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
                          <div style={{ height: '4px', background: 'var(--bg-input)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${(count / maxWork) * 100}%`, height: '100%', background: 'var(--accent-blue)', borderRadius: '2px' }} />
                          </div>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-blue)' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>

                {/* ── Top No-Show Patients ── */}
                <div className="card">
                  <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>Top No-Show Patients</h3>
                  {topNoShows.length === 0 ? (
                    <div className="empty-state" style={{ padding: '20px' }}>
                      <div className="empty-icon">✅</div>
                      <h4>No frequent no-shows</h4>
                    </div>
                  ) : (
                    topNoShows.map(p => {
                      const rate = p.totalVisits > 0 ? (p.noShowCount / p.totalVisits * 100) : 0;
                      return (
                        <div key={p.patientId} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 0', borderBottom: '1px solid var(--border-color)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '14px' }}>{rate > 50 ? '🚩' : '⚠️'}</span>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.fullName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.noShowCount} no-shows / {p.totalVisits} visits</div>
                            </div>
                          </div>
                          <span style={{
                            fontSize: '13px', fontWeight: 700,
                            color: rate > 50 ? 'var(--status-cancelled)' : 'var(--status-noshow)',
                          }}>
                            {rate.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
