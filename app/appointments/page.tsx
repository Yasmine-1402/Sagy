'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

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

interface Patient {
  patientId: string;
  fullName: string;
  phone: string;
  email: string;
}

interface Dentist {
  id: string;
  name: string;
  specialty: string;
}

interface ConflictReport {
  hasConflict: boolean;
  conflicts: Array<{ type: string; message: string }>;
  suggestedSlots: string[];
}

const STATUS_OPTIONS = ['All', 'Scheduled', 'Confirmed', 'Cancelled', 'Completed', 'NoShow'];
const TREATMENT_TYPES = ['Checkup', 'Cleaning', 'Filling', 'RootCanal', 'Extraction', 'Whitening', 'Braces', 'Crown', 'Bridge', 'Implant', 'Consultation', 'Emergency', 'Other'];

function getStatusClass(s: string): string {
  switch (s) { case 'Confirmed': return 'confirmed'; case 'Scheduled': return 'scheduled'; case 'Cancelled': return 'cancelled'; case 'Completed': return 'completed'; case 'NoShow': return 'noshow'; default: return 'scheduled'; }
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dentists, setDentists] = useState<Dentist[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDentist, setFilterDentist] = useState('All');
  const [filterDate, setFilterDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [conflictReport, setConflictReport] = useState<ConflictReport | null>(null);

  // New appointment form
  const [form, setForm] = useState({
    patientId: '', patientName: '', date: '', time: '09:00',
    duration: 30, dentistName: '', treatmentType: 'Checkup', notes: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const [apptRes, patRes, denRes] = await Promise.all([
        fetch(`${API_URL}/appointments`),
        fetch(`${API_URL}/patients`),
        fetch(`${API_URL}/dentists`),
      ]);
      const apptData = await apptRes.json();
      const patData = await patRes.json();
      const denData = await denRes.json();
      setAppointments(apptData.data || []);
      setPatients(patData.data || []);
      setDentists(denData.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStatusChange = async (id: string, status: string) => {
    if (status === 'Cancelled') {
      await fetch(`${API_URL}/appointments/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled from dashboard' }),
      });
    } else {
      await fetch(`${API_URL}/appointments/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    }
    fetchData();
  };

  const handleSendReminder = async (id: string) => {
    await fetch(`${API_URL}/reminders/send/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: '24h' }) });
    fetchData();
  };

  const handleCreateAppointment = async () => {
    setConflictReport(null);
    // Check conflicts first
    const conflictRes = await fetch(`${API_URL}/appointments/conflicts?date=${form.date}&time=${form.time}&duration=${form.duration}&dentist=${encodeURIComponent(form.dentistName)}&patientId=${form.patientId}`);
    const conflictData = await conflictRes.json();
    if (conflictData.data?.hasConflict) {
      setConflictReport(conflictData.data);
      return;
    }

    await fetch(`${API_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    setForm({ patientId: '', patientName: '', date: '', time: '09:00', duration: 30, dentistName: '', treatmentType: 'Checkup', notes: '' });
    setConflictReport(null);
    fetchData();
  };

  // Filtered list
  let filtered = appointments;
  if (filterStatus !== 'All') filtered = filtered.filter(a => a.status === filterStatus);
  if (filterDentist !== 'All') filtered = filtered.filter(a => a.dentistName === filterDentist);
  if (filterDate) filtered = filtered.filter(a => a.date === filterDate);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(a => a.patientName.toLowerCase().includes(q) || a.appointmentId.toLowerCase().includes(q));
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🦷</div>
          <h1>DentFlow</h1>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-title">Menu</div>
          <a href="/" className="nav-item"><span className="nav-icon">📊</span><span className="nav-label">Dashboard</span></a>
          <a href="/appointments" className="nav-item active"><span className="nav-icon">📅</span><span className="nav-label">Appointments</span></a>
          <a href="/patients" className="nav-item"><span className="nav-icon">👥</span><span className="nav-label">Patients</span></a>
          <a href="/reminders" className="nav-item"><span className="nav-icon">🔔</span><span className="nav-label">Reminders</span></a>
          <a href="/analytics" className="nav-item"><span className="nav-icon">📈</span><span className="nav-label">Analytics</span></a>
        </nav>
      </aside>

      <header className="topbar">
        <div className="topbar-left"><h2 className="topbar-title">Appointments</h2></div>
        <div className="topbar-right">
          <div className="search-bar">
            <span>🔍</span>
            <input type="text" placeholder="Search by patient name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="page-container">
          <div className="page-header">
            <div>
              <h2>Manage Appointments</h2>
              <p className="page-subtitle">{filtered.length} appointments found</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Appointment</button>
          </div>

          {/* Filters */}
          <div className="filters-bar">
            {STATUS_OPTIONS.map(s => (
              <button key={s} className={`filter-chip ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>{s}</button>
            ))}
            <select className="form-select" style={{ width: '200px' }} value={filterDentist} onChange={e => setFilterDentist(e.target.value)}>
              <option value="All">All Dentists</option>
              {dentists.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
            <input type="date" className="form-input" style={{ width: '180px' }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            {filterDate && <button className="btn btn-sm btn-secondary" onClick={() => setFilterDate('')}>Clear Date</button>}
          </div>

          {/* Table */}
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Dentist</th>
                  <th>Treatment</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Reminder</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3,4,5].map(i => (
                    <tr key={i}>
                      {[1,2,3,4,5,6,7,8].map(j => (
                        <td key={j}><div className="skeleton" style={{ height: '14px', width: `${60+j*10}px` }} /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon">📅</div><h4>No appointments found</h4><p>Try adjusting your filters.</p></div></td></tr>
                ) : (
                  filtered.map(a => (
                    <tr key={a.appointmentId}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatTime(a.time)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.date}</div>
                      </td>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{a.patientName}</td>
                      <td>{a.dentistName}</td>
                      <td>{a.treatmentType}</td>
                      <td>{a.duration} min</td>
                      <td><span className={`status-badge ${getStatusClass(a.status)}`}>{a.status}</span></td>
                      <td>{a.reminderSent ? <span style={{ color: 'var(--accent-teal)' }}>✓ Sent</span> : <span style={{ color: 'var(--text-muted)' }}>Pending</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {a.status === 'Scheduled' && (
                            <button className="btn-icon" title="Confirm" onClick={() => handleStatusChange(a.appointmentId, 'Confirmed')}>✓</button>
                          )}
                          {a.status !== 'Cancelled' && a.status !== 'Completed' && a.status !== 'NoShow' && (
                            <>
                              <button className="btn-icon" title="Send Reminder" onClick={() => handleSendReminder(a.appointmentId)}>📤</button>
                              <button className="btn-icon" title="Cancel" onClick={() => handleStatusChange(a.appointmentId, 'Cancelled')} style={{ color: 'var(--status-cancelled)' }}>✕</button>
                            </>
                          )}
                          {a.status === 'Confirmed' && (
                            <button className="btn-icon" title="Mark No-Show" onClick={() => handleStatusChange(a.appointmentId, 'NoShow')} style={{ color: 'var(--status-noshow)' }}>⚠</button>
                          )}
                          {(a.status === 'Confirmed' || a.status === 'Scheduled') && (
                            <button className="btn-icon" title="Complete" onClick={() => handleStatusChange(a.appointmentId, 'Completed')} style={{ color: 'var(--status-completed)' }}>✔</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── New Appointment Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setConflictReport(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Appointment</h2>
              <button className="btn-icon" onClick={() => { setShowModal(false); setConflictReport(null); }}>✕</button>
            </div>
            <div className="modal-body">
              {conflictReport && (
                <div style={{
                  padding: '14px 18px', marginBottom: '18px',
                  background: 'rgba(255,77,79,0.1)',
                  border: '1px solid var(--status-cancelled)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--status-cancelled)', marginBottom: '6px' }}>⚠️ Scheduling Conflict</div>
                  {conflictReport.conflicts.map((c, i) => (
                    <div key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>• {c.message}</div>
                  ))}
                  {conflictReport.suggestedSlots.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-teal)', marginBottom: '4px' }}>Suggested times:</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {conflictReport.suggestedSlots.map(s => (
                          <button key={s} className="btn btn-sm btn-secondary" onClick={() => { setForm(f => ({ ...f, time: s })); setConflictReport(null); }}>
                            {formatTime(s)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Patient</label>
                  <select className="form-select" value={form.patientId} onChange={e => {
                    const p = patients.find(p => p.patientId === e.target.value);
                    setForm(f => ({ ...f, patientId: e.target.value, patientName: p?.fullName || '' }));
                  }}>
                    <option value="">Select patient...</option>
                    {patients.map(p => <option key={p.patientId} value={p.patientId}>{p.fullName}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Dentist</label>
                  <select className="form-select" value={form.dentistName} onChange={e => setForm(f => ({ ...f, dentistName: e.target.value }))}>
                    <option value="">Select dentist...</option>
                    {dentists.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input type="time" className="form-input" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Treatment</label>
                  <select className="form-select" value={form.treatmentType} onChange={e => setForm(f => ({ ...f, treatmentType: e.target.value }))}>
                    {TREATMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Duration (min)</label>
                  <select className="form-select" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) }))}>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowModal(false); setConflictReport(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateAppointment} disabled={!form.patientId || !form.date || !form.dentistName}>
                Create Appointment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
