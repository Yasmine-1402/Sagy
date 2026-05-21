'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ──
interface Appointment {
  appointmentId: string;
  patientId: string;
  patientName: string;
  date: string;
  time: string;
  duration: number;
  dentistName: string;
  treatmentType: string;
  status: string;
  reminderSent: boolean;
  notes: string;
}

interface OverviewData {
  totalPatients: number;
  totalAppointments: number;
  todayAppointments: number;
  pendingConfirmations: number;
  confirmedToday: number;
  noShowRate: { rate: number; total: number; noShows: number };
  remindersSentToday: number;
  upcomingReminders: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ── Navigation Items ──
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', href: '/' },
  { id: 'appointments', label: 'Appointments', icon: '📅', href: '/appointments' },
  { id: 'patients', label: 'Patients', icon: '👥', href: '/patients' },
  { id: 'reminders', label: 'Reminders', icon: '🔔', href: '/reminders' },
  { id: 'analytics', label: 'Analytics', icon: '📈', href: '/analytics' },
];

// ── Status color helper ──
function getStatusClass(status: string): string {
  switch (status) {
    case 'Confirmed': return 'confirmed';
    case 'Scheduled': return 'scheduled';
    case 'Cancelled': return 'cancelled';
    case 'Completed': return 'completed';
    case 'NoShow': return 'noshow';
    default: return 'scheduled';
  }
}

// ── Time helpers ──
function formatTime(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getTimePosition(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return ((h - 9) * 60 + m) / (9 * 60) * 100; // 9 AM to 6 PM = 9 hours
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');
  const [sendingBatch, setSendingBatch] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, todayRes] = await Promise.all([
        fetch(`${API_URL}/analytics/overview`),
        fetch(`${API_URL}/appointments/today`),
      ]);
      const overviewData = await overviewRes.json();
      const todayData = await todayRes.json();
      setOverview(overviewData.data);
      setTodayAppts(todayData.data || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSendBatch = async () => {
    setSendingBatch(true);
    setBatchResult(null);
    try {
      const res = await fetch(`${API_URL}/reminders/send-batch`, { method: 'POST' });
      const data = await res.json();
      setBatchResult(`✅ Sent ${data.data.sent} reminders (${data.data.failed} failed)`);
      fetchData();
    } catch {
      setBatchResult('❌ Failed to send batch reminders');
    } finally {
      setSendingBatch(false);
      setTimeout(() => setBatchResult(null), 5000);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await fetch(`${API_URL}/appointments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchData();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // ── Dentist colors for timeline ──
  const dentistColors: Record<string, string> = {};
  const palette = ['#00D9A6', '#3B82F6', '#8B5CF6', '#FFB020', '#06B6D4', '#FF4D4F'];
  const uniqueDentists = Array.from(new Set(todayAppts.map(a => a.dentistName)));
  uniqueDentists.forEach((d, i) => { dentistColors[d] = palette[i % palette.length]; });

  const currentTimePos = (() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    if (h < 9 || h >= 18) return -1;
    return ((h - 9) * 60 + m) / (9 * 60) * 100;
  })();

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🦷</div>
          <h1>DentFlow</h1>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-title">Menu</div>
          {NAV_ITEMS.map(item => (
            <a
              key={item.id}
              href={item.href}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={(e) => {
                if (item.href === '/') { e.preventDefault(); setActivePage('dashboard'); }
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </a>
          ))}
          <div className="nav-section-title" style={{ marginTop: '24px' }}>System</div>
          <button className="nav-item">
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Settings</span>
          </button>
          <button className="nav-item">
            <span className="nav-icon">🤖</span>
            <span className="nav-label">UiPath Status</span>
          </button>
        </nav>
      </aside>

      {/* ── Top Bar ── */}
      <header className="topbar">
        <div className="topbar-left">
          <h2 className="topbar-title">Dashboard</h2>
        </div>
        <div className="topbar-right">
          <div className="search-bar">
            <span>🔍</span>
            <input type="text" placeholder="Search patients, appointments..." />
          </div>
          <button className="icon-btn" title="Notifications">
            🔔
            {overview && overview.upcomingReminders > 0 && (
              <span className="notification-badge">{overview.upcomingReminders}</span>
            )}
          </button>
          <div className="user-avatar">SA</div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="main-content">
        <div className="page-container">
          {/* Page Header */}
          <div className="page-header">
            <div>
              <h2>Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'} 👋</h2>
              <p className="page-subtitle">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-secondary"
                onClick={handleSendBatch}
                disabled={sendingBatch}
              >
                {sendingBatch ? '⏳ Sending...' : '📤 Send Batch Reminders'}
              </button>
              <a href="/appointments" className="btn btn-primary">
                + New Appointment
              </a>
            </div>
          </div>

          {batchResult && (
            <div style={{
              padding: '12px 20px',
              background: batchResult.startsWith('✅') ? 'rgba(0,217,166,0.1)' : 'rgba(255,77,79,0.1)',
              border: `1px solid ${batchResult.startsWith('✅') ? 'var(--accent-teal)' : 'var(--status-cancelled)'}`,
              borderRadius: 'var(--radius-sm)',
              marginBottom: '20px',
              fontSize: '14px',
              animation: 'fadeIn 200ms ease',
            }}>
              {batchResult}
            </div>
          )}

          {/* ── Stat Cards ── */}
          {loading ? (
            <div className="stats-grid">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="stat-card">
                  <div className="skeleton" style={{ height: '16px', width: '120px', marginBottom: '12px' }} />
                  <div className="skeleton" style={{ height: '36px', width: '60px', marginBottom: '8px' }} />
                  <div className="skeleton" style={{ height: '12px', width: '80px' }} />
                </div>
              ))}
            </div>
          ) : overview && (
            <div className="stats-grid">
              <div className="stat-card teal">
                <div className="stat-header">
                  <span className="stat-label">Today&apos;s Appointments</span>
                  <div className="stat-icon">📅</div>
                </div>
                <div className="stat-value">{overview.todayAppointments}</div>
                <div className="stat-change positive">{overview.confirmedToday} confirmed</div>
              </div>

              <div className="stat-card blue">
                <div className="stat-header">
                  <span className="stat-label">Pending Confirmations</span>
                  <div className="stat-icon">⏳</div>
                </div>
                <div className="stat-value">{overview.pendingConfirmations}</div>
                <div className="stat-change">Awaiting response</div>
              </div>

              <div className="stat-card amber">
                <div className="stat-header">
                  <span className="stat-label">No-Show Rate</span>
                  <div className="stat-icon">⚠️</div>
                </div>
                <div className="stat-value">{overview.noShowRate.rate.toFixed(1)}%</div>
                <div className="stat-change negative">
                  {overview.noShowRate.noShows} of {overview.noShowRate.total} visits
                </div>
              </div>

              <div className="stat-card purple">
                <div className="stat-header">
                  <span className="stat-label">Reminders Sent</span>
                  <div className="stat-icon">📨</div>
                </div>
                <div className="stat-value">{overview.remindersSentToday}</div>
                <div className="stat-change">{overview.upcomingReminders} pending</div>
              </div>
            </div>
          )}

          {/* ── Two column: Timeline + Upcoming list ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px' }}>
            {/* Timeline */}
            <div className="data-table-wrapper">
              <div className="data-table-header">
                <h3>Today&apos;s Timeline</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {uniqueDentists.map(d => (
                    <span key={d} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      fontSize: '12px', color: 'var(--text-secondary)',
                    }}>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: dentistColors[d],
                      }} />
                      {d.replace('Dr. ', '')}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ padding: '24px', position: 'relative', minHeight: '360px' }}>
                {/* Time labels */}
                {[9, 10, 11, 12, 13, 14, 15, 16, 17].map(h => (
                  <div key={h} style={{
                    position: 'absolute',
                    left: `${((h - 9) / 9) * 100}%`,
                    top: '0', bottom: '0',
                    borderLeft: '1px solid var(--border-color)',
                    paddingLeft: '6px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    zIndex: 1,
                  }}>
                    {h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`}
                  </div>
                ))}

                {/* Current time indicator */}
                {currentTimePos >= 0 && currentTimePos <= 100 && (
                  <div style={{
                    position: 'absolute',
                    left: `${currentTimePos}%`,
                    top: '0', bottom: '0',
                    borderLeft: '2px solid var(--status-cancelled)',
                    zIndex: 5,
                  }}>
                    <div style={{
                      position: 'absolute', top: '-4px', left: '-4px',
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: 'var(--status-cancelled)',
                    }} />
                  </div>
                )}

                {/* Appointment blocks per dentist row */}
                {uniqueDentists.map((dentist, dIdx) => (
                  <div key={dentist} style={{
                    position: 'relative', height: '50px',
                    marginTop: dIdx === 0 ? '28px' : '12px',
                  }}>
                    {todayAppts
                      .filter(a => a.dentistName === dentist && a.status !== 'Cancelled')
                      .map(appt => {
                        const left = getTimePosition(appt.time);
                        const width = (appt.duration / (9 * 60)) * 100;
                        return (
                          <div
                            key={appt.appointmentId}
                            title={`${appt.patientName} — ${appt.treatmentType} (${appt.duration}min)`}
                            style={{
                              position: 'absolute',
                              left: `${left}%`,
                              width: `${Math.max(width, 3)}%`,
                              top: '4px', height: '42px',
                              background: `${dentistColors[dentist]}22`,
                              border: `1px solid ${dentistColors[dentist]}66`,
                              borderLeft: `3px solid ${dentistColors[dentist]}`,
                              borderRadius: 'var(--radius-sm)',
                              padding: '4px 8px',
                              fontSize: '11px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                              zIndex: 2,
                            }}
                            onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'scale(1.02)'; }}
                            onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                          >
                            <div style={{ fontWeight: 600, color: dentistColors[dentist] }}>
                              {appt.patientName}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                              {formatTime(appt.time)} · {appt.treatmentType}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ))}

                {todayAppts.length === 0 && !loading && (
                  <div className="empty-state">
                    <div className="empty-icon">📅</div>
                    <h4>No appointments today</h4>
                    <p>Your schedule is clear. Add new appointments to fill the day.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right column: Today's Appointments List */}
            <div className="data-table-wrapper" style={{ maxHeight: '540px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="data-table-header">
                <h3>Appointment List</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {todayAppts.length} total
                </span>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                {loading ? (
                  <div style={{ padding: '20px' }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                        <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                        <div style={{ flex: 1 }}>
                          <div className="skeleton" style={{ height: '14px', width: '120px', marginBottom: '6px' }} />
                          <div className="skeleton" style={{ height: '12px', width: '80px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : todayAppts.length === 0 ? (
                  <div className="empty-state" style={{ padding: '32px' }}>
                    <div className="empty-icon">🗓️</div>
                    <h4>No appointments</h4>
                  </div>
                ) : (
                  todayAppts
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map(appt => (
                      <div
                        key={appt.appointmentId}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '14px 20px',
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background var(--transition-fast)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--bg-card-hover)'; }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
                      >
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: `${dentistColors[appt.dentistName] || '#3B82F6'}22`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '14px', fontWeight: 700,
                            color: dentistColors[appt.dentistName] || '#3B82F6',
                            flexShrink: 0,
                          }}>
                            {appt.patientName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {appt.patientName}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {formatTime(appt.time)} · {appt.dentistName} · {appt.treatmentType}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`status-badge ${getStatusClass(appt.status)}`}>
                            {appt.status}
                          </span>
                          {appt.status === 'Scheduled' && (
                            <button
                              className="btn-icon"
                              title="Confirm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(appt.appointmentId, 'Confirmed');
                              }}
                            >
                              ✓
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* ── Quick Stats Row ── */}
          {overview && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '16px', marginTop: '20px',
            }}>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Total Patients</div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent-teal)' }}>{overview.totalPatients}</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Total Appointments</div>
                <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent-blue)' }}>{overview.totalAppointments}</div>
              </div>
              <div className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>UiPath Bot Status</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-teal)', marginTop: '4px' }}>🟢 Connected</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Last sync: {new Date().toLocaleTimeString()}</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
