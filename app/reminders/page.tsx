'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface ReminderLog {
  reminderId: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  channel: string;
  type: string;
  sentAt: string;
  status: string;
  messageContent: string;
  errorMessage?: string;
  retryCount: number;
}

function getChannelClass(ch: string): string {
  switch (ch) { case 'SMS': return 'sms'; case 'WhatsApp': return 'whatsapp'; case 'Email': return 'email'; default: return 'sms'; }
}

function getStatusDot(status: string): string {
  switch (status) { case 'Delivered': return '🟢'; case 'Sent': return '🟡'; case 'Failed': return '🔴'; case 'Read': return '🔵'; default: return '⚪'; }
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<ReminderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const fetchReminders = useCallback(async () => {
    try {
      let url = `${API_URL}/reminders/log`;
      const params: string[] = [];
      if (filterChannel !== 'All') params.push(`channel=${filterChannel}`);
      if (filterStatus !== 'All') params.push(`status=${filterStatus}`);
      if (params.length) url += '?' + params.join('&');

      const res = await fetch(url);
      const data = await res.json();
      setReminders(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filterChannel, filterStatus]);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const handleRetry = async (r: ReminderLog) => {
    await fetch(`${API_URL}/reminders/send/${r.appointmentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: r.type }),
    });
    fetchReminders();
  };

  // Stats
  const totalSent = reminders.length;
  const delivered = reminders.filter(r => r.status === 'Delivered').length;
  const failed = reminders.filter(r => r.status === 'Failed').length;
  const pending = reminders.filter(r => r.status === 'Sent' || r.status === 'Pending').length;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="logo-icon">🦷</div><h1>DentFlow</h1></div>
        <nav className="sidebar-nav">
          <div className="nav-section-title">Menu</div>
          <a href="/" className="nav-item"><span className="nav-icon">📊</span><span className="nav-label">Dashboard</span></a>
          <a href="/appointments" className="nav-item"><span className="nav-icon">📅</span><span className="nav-label">Appointments</span></a>
          <a href="/patients" className="nav-item"><span className="nav-icon">👥</span><span className="nav-label">Patients</span></a>
          <a href="/reminders" className="nav-item active"><span className="nav-icon">🔔</span><span className="nav-label">Reminders</span></a>
          <a href="/analytics" className="nav-item"><span className="nav-icon">📈</span><span className="nav-label">Analytics</span></a>
        </nav>
      </aside>

      <header className="topbar">
        <div className="topbar-left"><h2 className="topbar-title">Reminder Log</h2></div>
        <div className="topbar-right" />
      </header>

      <main className="main-content">
        <div className="page-container">
          <div className="page-header">
            <div>
              <h2>Reminder History</h2>
              <p className="page-subtitle">Track all SMS, WhatsApp, and Email reminders</p>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card teal">
              <div className="stat-header"><span className="stat-label">Total Sent</span><div className="stat-icon">📨</div></div>
              <div className="stat-value">{totalSent}</div>
            </div>
            <div className="stat-card blue">
              <div className="stat-header"><span className="stat-label">Delivered</span><div className="stat-icon">✅</div></div>
              <div className="stat-value">{delivered}</div>
              <div className="stat-change positive">{totalSent > 0 ? ((delivered / totalSent) * 100).toFixed(0) : 0}% success</div>
            </div>
            <div className="stat-card amber">
              <div className="stat-header"><span className="stat-label">Pending</span><div className="stat-icon">⏳</div></div>
              <div className="stat-value">{pending}</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-header"><span className="stat-label">Failed</span><div className="stat-icon">❌</div></div>
              <div className="stat-value">{failed}</div>
              {failed > 0 && <div className="stat-change negative">Needs retry</div>}
            </div>
          </div>

          {/* Filters */}
          <div className="filters-bar">
            {['All', 'SMS', 'WhatsApp', 'Email'].map(ch => (
              <button key={ch} className={`filter-chip ${filterChannel === ch ? 'active' : ''}`} onClick={() => setFilterChannel(ch)}>{ch}</button>
            ))}
            <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />
            {['All', 'Delivered', 'Sent', 'Failed'].map(s => (
              <button key={s} className={`filter-chip ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>{s}</button>
            ))}
          </div>

          {/* Table */}
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Sent At</th>
                  <th>Patient</th>
                  <th>Channel</th>
                  <th>Type</th>
                  <th>Message</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3,4,5].map(i => (
                    <tr key={i}>{[1,2,3,4,5,6,7].map(j => <td key={j}><div className="skeleton" style={{ height: '14px', width: `${50+j*10}px` }} /></td>)}</tr>
                  ))
                ) : reminders.length === 0 ? (
                  <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">🔔</div><h4>No reminders sent yet</h4><p>Reminders will appear here once they are sent.</p></div></td></tr>
                ) : (
                  reminders.map(r => (
                    <tr key={r.reminderId}>
                      <td><span title={r.status}>{getStatusDot(r.status)} {r.status}</span></td>
                      <td>
                        <div style={{ fontSize: '13px' }}>{new Date(r.sentAt).toLocaleDateString()}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(r.sentAt).toLocaleTimeString()}</div>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{r.patientName}</td>
                      <td><span className={`channel-badge ${getChannelClass(r.channel)}`}>{r.channel}</span></td>
                      <td>{r.type}</td>
                      <td>
                        <div style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
                          {r.messageContent}
                        </div>
                      </td>
                      <td>
                        {r.status === 'Failed' && (
                          <button className="btn btn-sm btn-secondary" onClick={() => handleRetry(r)}>🔄 Retry</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
