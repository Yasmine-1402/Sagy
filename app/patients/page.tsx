'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Patient {
  patientId: string;
  fullName: string;
  phone: string;
  email: string;
  language: string;
  preferredChannel: string;
  noShowCount: number;
  totalVisits: number;
  createdAt: string;
  isActive: boolean;
}

interface Appointment {
  appointmentId: string;
  date: string;
  time: string;
  dentistName: string;
  treatmentType: string;
  status: string;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showProfile, setShowProfile] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<{ patient: Patient; appointments: Appointment[] } | null>(null);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', language: 'EN', preferredChannel: 'SMS' });

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/patients`);
      const data = await res.json();
      setPatients(data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const fetchProfile = async (id: string) => {
    const res = await fetch(`${API_URL}/patients/${id}`);
    const data = await res.json();
    setProfileData({ patient: data.data, appointments: data.data.appointments || [] });
    setShowProfile(id);
  };

  const handleCreate = async () => {
    await fetch(`${API_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setShowModal(false);
    setForm({ fullName: '', phone: '', email: '', language: 'EN', preferredChannel: 'SMS' });
    fetchPatients();
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API_URL}/patients/${id}`, { method: 'DELETE' });
    fetchPatients();
    setShowProfile(null);
  };

  const filtered = searchQuery
    ? patients.filter(p =>
        p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.phone.includes(searchQuery) ||
        p.email.toLowerCase().includes(searchQuery.toLowerCase()))
    : patients;

  const getNoShowRate = (p: Patient) => p.totalVisits > 0 ? (p.noShowCount / p.totalVisits * 100) : 0;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo"><div className="logo-icon">🦷</div><h1>DentFlow</h1></div>
        <nav className="sidebar-nav">
          <div className="nav-section-title">Menu</div>
          <a href="/" className="nav-item"><span className="nav-icon">📊</span><span className="nav-label">Dashboard</span></a>
          <a href="/appointments" className="nav-item"><span className="nav-icon">📅</span><span className="nav-label">Appointments</span></a>
          <a href="/patients" className="nav-item active"><span className="nav-icon">👥</span><span className="nav-label">Patients</span></a>
          <a href="/reminders" className="nav-item"><span className="nav-icon">🔔</span><span className="nav-label">Reminders</span></a>
          <a href="/analytics" className="nav-item"><span className="nav-icon">📈</span><span className="nav-label">Analytics</span></a>
        </nav>
      </aside>

      <header className="topbar">
        <div className="topbar-left"><h2 className="topbar-title">Patients</h2></div>
        <div className="topbar-right">
          <div className="search-bar">
            <span>🔍</span>
            <input type="text" placeholder="Search patients..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="page-container">
          <div className="page-header">
            <div>
              <h2>Patient Directory</h2>
              <p className="page-subtitle">{filtered.length} active patients</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Patient</button>
          </div>

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Language</th>
                  <th>Channel</th>
                  <th>Visits</th>
                  <th>No-Shows</th>
                  <th>Risk</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3,4,5].map(i => (
                    <tr key={i}>{[1,2,3,4,5,6,7,8,9].map(j => <td key={j}><div className="skeleton" style={{ height: '14px', width: `${50+j*8}px` }} /></td>)}</tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9}><div className="empty-state"><div className="empty-icon">👥</div><h4>No patients found</h4></div></td></tr>
                ) : (
                  filtered.map(p => {
                    const risk = getNoShowRate(p);
                    return (
                      <tr key={p.patientId} onClick={() => fetchProfile(p.patientId)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '36px', height: '36px', borderRadius: '50%',
                              background: 'rgba(0,217,166,0.12)', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              fontSize: '13px', fontWeight: 700, color: 'var(--accent-teal)',
                            }}>
                              {p.fullName.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.fullName}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.patientId}</div>
                            </div>
                          </div>
                        </td>
                        <td>{p.phone}</td>
                        <td>{p.email}</td>
                        <td><span className="channel-badge sms">{p.language}</span></td>
                        <td><span className={`channel-badge ${p.preferredChannel.toLowerCase()}`}>{p.preferredChannel}</span></td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.totalVisits}</td>
                        <td style={{ color: p.noShowCount > 0 ? 'var(--status-noshow)' : 'var(--text-muted)' }}>{p.noShowCount}</td>
                        <td>
                          {risk > 20 ? (
                            <span style={{ color: 'var(--status-cancelled)', fontWeight: 600, fontSize: '13px' }}>🚩 High</span>
                          ) : risk > 0 ? (
                            <span style={{ color: 'var(--status-noshow)', fontSize: '13px' }}>⚠ Med</span>
                          ) : (
                            <span style={{ color: 'var(--accent-teal)', fontSize: '13px' }}>✓ Low</span>
                          )}
                        </td>
                        <td>
                          <button className="btn-icon" title="View Profile" onClick={(e) => { e.stopPropagation(); fetchProfile(p.patientId); }}>👁</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── Add Patient Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Patient</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="e.g. Ahmed Ali" />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Phone (E.164)</label>
                  <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+201012345678" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Language</label>
                  <select className="form-select" value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                    <option value="EN">English</option>
                    <option value="AR">Arabic</option>
                    <option value="FR">French</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Channel</label>
                  <select className="form-select" value={form.preferredChannel} onChange={e => setForm(f => ({ ...f, preferredChannel: e.target.value }))}>
                    <option value="SMS">SMS</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.fullName || !form.phone || !form.email}>Add Patient</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Patient Profile Modal ── */}
      {showProfile && profileData && (
        <div className="modal-overlay" onClick={() => setShowProfile(null)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Patient Profile</h2>
              <button className="btn-icon" onClick={() => setShowProfile(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-teal), var(--accent-blue))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px', fontWeight: 700, color: 'white',
                }}>
                  {profileData.patient.fullName.split(' ').map((n: string) => n[0]).join('')}
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{profileData.patient.fullName}</h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{profileData.patient.patientId} · Since {new Date(profileData.patient.createdAt).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="grid-3" style={{ marginBottom: '20px' }}>
                <div className="card" style={{ textAlign: 'center', padding: '14px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-teal)' }}>{profileData.patient.totalVisits}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Visits</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '14px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--status-noshow)' }}>{profileData.patient.noShowCount}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No-Shows</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '14px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: getNoShowRate(profileData.patient) > 20 ? 'var(--status-cancelled)' : 'var(--accent-teal)' }}>
                    {getNoShowRate(profileData.patient).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No-Show Rate</div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '6px' }}>Contact</div>
                <div style={{ fontSize: '14px' }}>📱 {profileData.patient.phone} · 📧 {profileData.patient.email}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Language: {profileData.patient.language} · Channel: {profileData.patient.preferredChannel}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Appointment History ({profileData.appointments.length})</div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {profileData.appointments.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No appointment history</div>
                  ) : (
                    profileData.appointments
                      .sort((a: Appointment, b: Appointment) => b.date.localeCompare(a.date))
                      .slice(0, 10)
                      .map((a: Appointment) => (
                        <div key={a.appointmentId} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 0', borderBottom: '1px solid var(--border-color)',
                          fontSize: '13px',
                        }}>
                          <span>{a.date} at {a.time} — {a.dentistName}</span>
                          <span className={`status-badge ${a.status.toLowerCase()}`} style={{ fontSize: '11px', padding: '2px 8px' }}>{a.status}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-danger" onClick={() => handleDelete(profileData.patient.patientId)}>Deactivate Patient</button>
              <button className="btn btn-secondary" onClick={() => setShowProfile(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
