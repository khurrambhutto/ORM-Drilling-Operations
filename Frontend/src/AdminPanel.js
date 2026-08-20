import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from './auth';
import { API_BASE } from './config';
import SiteHeader from './SiteHeader';
import { useNavigate } from 'react-router-dom';

// Simple Admin Panel: list users, create user, edit activation & well access
export default function AdminPanel() {
  const { authFetch, user } = useAuth() || {};
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wells, setWells] = useState([]); // list of wells for assignment
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', password: 'TempPass123!', isAdmin: false, wellIds: [] });
  const [saving, setSaving] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(null); // user ID being updated
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [resettingUser, setResettingUser] = useState(null); // { user, loading, generatedPwd? }
  const [showSelfPwModal, setShowSelfPwModal] = useState(false);
  const [selfPwForm, setSelfPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [selfPwStatus, setSelfPwStatus] = useState('');

  const loadUsers = useCallback(async () => {
    if (!authFetch) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/admin/users`);
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const loadWells = useCallback(async () => {
    if (!authFetch) return;
    try {
      const res = await authFetch(`${API_BASE}/drilling-operations`);
      if (!res.ok) throw new Error('Failed to load wells');
      const data = await res.json();
      setWells(data.map(w => ({ WellID: w.WellID, WellName: w.WellName })));
    } catch (e) {
      // non-critical
    }
  }, [authFetch]);

  useEffect(() => { loadUsers(); loadWells(); }, [loadUsers, loadWells, refreshFlag]);

  async function createUser(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...createForm };
      if (payload.isAdmin) payload.wellIds = []; // ignore wells for admins
      const res = await authFetch(`${API_BASE}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Create failed');
      }
      setShowCreate(false);
      setCreateForm({ username: '', password: 'TempPass123!', isAdmin: false, wellIds: [] });
      setRefreshFlag(x => x + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleCreateWell(id) {
    setCreateForm(f => ({ ...f, wellIds: f.wellIds.includes(id) ? f.wellIds.filter(x => x !== id) : [...f.wellIds, id] }));
  }

  async function toggleActive(u) {
    if (!window.confirm(`Toggle active for ${u.Username}?`)) return;
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${u.UserID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !u.IsActive })
      });
      if (!res.ok) throw new Error('Update failed');
      setRefreshFlag(x => x + 1);
    } catch (e) {
      alert(e.message);
    }
  }

  async function deleteUser(u) {
    if (!window.confirm(`Delete user ${u.Username}? This cannot be undone.`)) return;
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${u.UserID}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setRefreshFlag(x => x + 1);
    } catch (e) {
      alert(e.message);
    }
  }

  function startEditWells(u) {
    setUpdatingUser({ ...u, wells: [], loading: true });
    (async () => {
      try {
        const res = await authFetch(`${API_BASE}/admin/users/${u.UserID}/wells`);
        if (res.ok) {
          const list = await res.json();
          setUpdatingUser(prev => ({ ...prev, wells: Array.isArray(list) ? list : [], loading: false }));
        } else {
          setUpdatingUser(prev => ({ ...prev, wells: [], loading: false }));
        }
      } catch {
        setUpdatingUser(prev => ({ ...prev, wells: [], loading: false }));
      }
    })();
  }

  function toggleEditWell(id) {
    setUpdatingUser(u => ({ ...u, wells: u.wells.includes(id) ? u.wells.filter(x => x !== id) : [...u.wells, id] }));
  }

  async function saveEditWells() {
    if (!updatingUser) return;
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${updatingUser.UserID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wellIds: updatingUser.wells })
      });
      if (!res.ok) throw new Error('Save failed');
      setUpdatingUser(null);
      setRefreshFlag(x => x + 1);
    } catch (e) {
      alert(e.message);
    }
  }

  async function openResetPassword(u) {
    setResettingUser({ user: u, loading: false, generatedPwd: null, error: '' });
  }

  async function generatePassword() {
    setResettingUser(r => ({ ...r, loading: true, error: '' }));
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${resettingUser.user.UserID}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate: true })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResettingUser(r => ({ ...r, loading: false, generatedPwd: data.newPassword || '(set)' }));
    } catch (e) {
      setResettingUser(r => ({ ...r, loading: false, error: e.message }));
    }
  }

  async function setCustomPassword(pwd) {
    if (!pwd || pwd.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }
    setResettingUser(r => ({ ...r, loading: true, error: '' }));
    try {
      const res = await authFetch(`${API_BASE}/admin/users/${resettingUser.user.UserID}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: pwd })
      });
      if (!res.ok) throw new Error(await res.text());
      await res.json();
      setResettingUser(r => ({ ...r, loading: false, generatedPwd: '(updated)' }));
    } catch (e) {
      setResettingUser(r => ({ ...r, loading: false, error: e.message }));
    }
  }

  async function submitSelfPassword(e) {
    e.preventDefault();
    setSelfPwStatus('');
    if (selfPwForm.newPassword !== selfPwForm.confirm) {
      setSelfPwStatus('Passwords do not match');
      return;
    }
    try {
      const res = await authFetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: selfPwForm.currentPassword, newPassword: selfPwForm.newPassword })
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Change failed');
      }
      setSelfPwStatus('Password updated');
      setSelfPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) {
      setSelfPwStatus(e.message);
    }
  }

  if (!user?.IsAdmin) {
    return <div style={{ padding: 40, color: '#fff' }}>Admin only.</div>;
  }

  return (
    <div className="dashboard-container" style={{ paddingTop: 12 }}>
      <SiteHeader />
      <h1 style={{ textAlign: 'center', color: '#fff', margin: '20px 0 6px', fontSize: 34, fontWeight: 900 }}>Admin Panel</h1>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'linear-gradient(140deg,#00c79b 0%,#009b77 100%)', border: '1px solid #00b28a', color: '#fff', padding: '6px 16px', borderRadius: 24, fontWeight: 700, letterSpacing: .5, cursor: 'pointer', fontSize: 14 }}>
          ← Back to Dashboard
        </button>
      </div>
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setShowCreate(s => !s)} style={{ background: 'linear-gradient(140deg,#1976d2 0%,#1565c0 100%)', color: '#fff', border: '1px solid #1976d2', padding: '10px 18px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px -2px rgba(25,118,210,0.35)', transition: 'all 0.2s' }}>{showCreate ? 'Close Create' : 'Create User'}</button>
          <button onClick={() => setShowSelfPwModal(true)} style={{ background: 'linear-gradient(140deg,#455a64 0%,#37474f 100%)', color: '#fff', border: '1px solid #455a64', padding: '10px 18px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px -2px rgba(69,90,100,0.35)', transition: 'all 0.2s' }}>Change My Password</button>
          <button onClick={() => setRefreshFlag(x => x + 1)} style={{ background: 'linear-gradient(140deg,#616161 0%,#424242 100%)', color: '#fff', border: '1px solid #616161', padding: '10px 18px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px -2px rgba(97,97,97,0.35)', transition: 'all 0.2s' }}>Refresh</button>
        </div>
        {error && <div style={{ color: '#ff6b6b', marginBottom: 16 }}>{error}</div>}
        {showCreate && (
          <form onSubmit={createUser} style={{ background: '#0F1D3B', padding: 20, borderRadius: 12, marginBottom: 24, border: '1px solid rgba(255,255,255,0.15)', color: '#fff', display: 'grid', gap: 14 }}>
            <h3 style={{ margin: 0 }}>New User</h3>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>Username</span>
              <input value={createForm.username} onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))} required style={{ padding: '8px 10px', borderRadius: 6 }} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span>Password</span>
              <input value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} required style={{ padding: '8px 10px', borderRadius: 6 }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={createForm.isAdmin} onChange={e => setCreateForm(f => ({ ...f, isAdmin: e.target.checked }))} /> Admin
            </label>
            {!createForm.isAdmin && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Allowed Wells</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {wells.map(w => (
                    <label key={w.WellID} style={{ background: createForm.wellIds.includes(w.WellID) ? '#1976d2' : '#1e2b45', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                      <input type="checkbox" style={{ marginRight: 4 }} checked={createForm.wellIds.includes(w.WellID)} onChange={() => toggleCreateWell(w.WellID)} />
                      {w.WellName}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="submit" disabled={saving} style={{ background: 'linear-gradient(140deg,#43ea7f 0%,#2e7d32 100%)', color: '#000', border: '1px solid #43ea7f', padding: '10px 18px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px -2px rgba(67,234,127,0.45)', transition: 'all 0.2s', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save User'}</button>
              <button type="button" onClick={() => { setShowCreate(false); }} style={{ background: 'linear-gradient(140deg,#616161 0%,#424242 100%)', color: '#fff', border: '1px solid #616161', padding: '10px 18px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px -2px rgba(97,97,97,0.35)', transition: 'all 0.2s' }}>Cancel</button>
            </div>
          </form>
        )}
        <div style={{ background: '#0F1D3B', borderRadius: 12, padding: 20, border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}>
          <h3 style={{ marginTop: 0 }}>Users</h3>
          {loading ? (<div>Loading users...</div>) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#192b50' }}>
                  <th style={th}>ID</th>
                  <th style={th}>Username</th>
                  <th style={th}>Admin</th>
                  <th style={th}>Active</th>
                  <th style={th}>Created</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.UserID} style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <td style={td}>{u.UserID}</td>
                    <td style={td}>{u.Username}</td>
                    <td style={td}>{u.IsAdmin ? 'Yes' : 'No'}</td>
                    <td style={td}>{u.IsActive ? 'Yes' : 'No'}</td>
                    <td style={td}>{u.CreatedAt ? String(u.CreatedAt).split('T')[0] : ''}</td>
                    <td style={{ ...td, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {!u.IsAdmin && (
                        <button onClick={() => startEditWells(u)} style={btnSm}>Wells</button>
                      )}
                      {u.Username !== user.Username && (
                        <button onClick={() => openResetPassword(u)} style={{ ...btnSm, background: 'linear-gradient(140deg,#8e24aa 0%,#6a1b99 100%)', border: '1px solid #8e24aa', boxShadow: '0 2px 8px -1px rgba(142,36,170,0.35)' }}>Reset PW</button>
                      )}
                      <button onClick={() => toggleActive(u)} style={btnSm}>{u.IsActive ? 'Deactivate' : 'Activate'}</button>
                      {u.Username !== user.Username && (
                        <button onClick={() => deleteUser(u)} style={{ ...btnSm, background: 'linear-gradient(140deg,#ff6b6b 0%,#e53e3e 100%)', border: '1px solid #ff6b6b', boxShadow: '0 2px 8px -1px rgba(255,107,107,0.35)' }}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {updatingUser && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <h3 style={{ marginTop: 0 }}>Edit Wells: {updatingUser.Username}</h3>
            {updatingUser.loading ? <div>Loading...</div> : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {wells.map(w => (
                  <label key={w.WellID} style={{ background: updatingUser.wells.includes(w.WellID) ? '#1976d2' : '#1e2b45', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" style={{ marginRight: 4 }} checked={updatingUser.wells.includes(w.WellID)} onChange={() => toggleEditWell(w.WellID)} />
                    {w.WellName}
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={saveEditWells} style={{ ...btnSm, background: 'linear-gradient(140deg,#43ea7f 0%,#2e7d32 100%)', color: '#000', border: '1px solid #43ea7f', boxShadow: '0 2px 8px -1px rgba(67,234,127,0.35)' }}>Save</button>
              <button onClick={() => setUpdatingUser(null)} style={btnSm}>Close</button>
            </div>
          </div>
        </div>
      )}
      {resettingUser && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <h3 style={{ marginTop:0 }}>Reset Password: {resettingUser.user.Username}</h3>
            <p style={{ fontSize: 13, lineHeight: 1.4 }}>You can either generate a secure random password (will display once) or set a custom password.</p>
            {resettingUser.error && <div style={{ color:'#ff6b6b', marginBottom:8 }}>{resettingUser.error}</div>}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:14 }}>
              <button disabled={resettingUser.loading} onClick={generatePassword} style={{ ...btnSm, background: 'linear-gradient(140deg,#0277bd 0%,#01579b 100%)', border: '1px solid #0277bd', boxShadow: '0 2px 8px -1px rgba(2,119,189,0.35)', opacity: resettingUser.loading ? 0.7 : 1 }}>{resettingUser.loading ? 'Working...' : 'Generate Password'}</button>
              <CustomPwSetter onSet={setCustomPassword} disabled={resettingUser.loading} />
            </div>
            {resettingUser.generatedPwd && (
              <div style={{ background:'#102845', padding:'12px 16px', borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', marginBottom:12 }}>
                <div style={{ fontSize:12, color:'#9bb1ff', marginBottom:4 }}>New Password (copy now)</div>
                <code style={{ fontSize:16, fontWeight:700, letterSpacing:.5 }}>{resettingUser.generatedPwd}</code>
              </div>
            )}
            <div style={{ textAlign:'right' }}>
              <button onClick={() => setResettingUser(null)} style={btnSm}>Close</button>
            </div>
          </div>
        </div>
      )}
      {showSelfPwModal && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <h3 style={{ marginTop:0 }}>Change My Password</h3>
            <form onSubmit={submitSelfPassword} style={{ display:'grid', gap:12 }}>
              <label style={{ display:'grid', gap:4 }}>
                <span>Current Password</span>
                <input type="password" value={selfPwForm.currentPassword} onChange={e=>setSelfPwForm(f=>({...f,currentPassword:e.target.value}))} required style={{ padding:'8px 10px', borderRadius:6 }} />
              </label>
              <label style={{ display:'grid', gap:4 }}>
                <span>New Password</span>
                <input type="password" value={selfPwForm.newPassword} onChange={e=>setSelfPwForm(f=>({...f,newPassword:e.target.value}))} required minLength={8} style={{ padding:'8px 10px', borderRadius:6 }} />
              </label>
              <label style={{ display:'grid', gap:4 }}>
                <span>Confirm New Password</span>
                <input type="password" value={selfPwForm.confirm} onChange={e=>setSelfPwForm(f=>({...f,confirm:e.target.value}))} required minLength={8} style={{ padding:'8px 10px', borderRadius:6 }} />
              </label>
              {selfPwStatus && <div style={{ color: selfPwStatus.includes('updated') ? '#43ea7f' : '#ff6b6b' }}>{selfPwStatus}</div>}
              <div style={{ display:'flex', gap:10 }}>
                <button type="submit" style={{ ...btnSm, background: 'linear-gradient(140deg,#43ea7f 0%,#2e7d32 100%)', color: '#000', border: '1px solid #43ea7f', boxShadow: '0 2px 8px -1px rgba(67,234,127,0.35)' }}>Update</button>
                <button type="button" onClick={()=>{ setShowSelfPwModal(false); setSelfPwForm({ currentPassword:'', newPassword:'', confirm:'' }); setSelfPwStatus(''); }} style={btnSm}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: '8px 10px', textAlign: 'left', fontWeight: 700 };
const td = { padding: '6px 10px' };
const btnSm = { 
  background: 'linear-gradient(140deg,#1976d2 0%,#1565c0 100%)', 
  color: '#fff', 
  border: '1px solid #1976d2', 
  padding: '6px 10px', 
  borderRadius: 6, 
  fontWeight: 600, 
  cursor: 'pointer', 
  fontSize: 12,
  boxShadow: '0 2px 8px -1px rgba(25,118,210,0.25)',
  transition: 'all 0.2s'
};
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 };
const modalCard = { background: '#0F1D3B', color: '#fff', padding: 24, borderRadius: 14, minWidth: 'min(92vw,780px)', maxHeight: '85vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.15)' };

function CustomPwSetter({ onSet, disabled }) {
  const [val, setVal] = useState('');
  return (
    <form onSubmit={e=>{ e.preventDefault(); onSet(val); }} style={{ display:'flex', gap:6, alignItems:'center' }}>
      <input type="text" placeholder="Custom password" value={val} onChange={e=>setVal(e.target.value)} disabled={disabled} style={{ padding:'6px 8px', borderRadius:6 }} />
      <button type="submit" disabled={disabled} style={{ background: 'linear-gradient(140deg,#26a69a 0%,#00695c 100%)', color: '#fff', border: '1px solid #26a69a', padding: '6px 10px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 12, boxShadow: '0 2px 8px -1px rgba(38,166,154,0.35)', transition: 'all 0.2s', opacity: disabled ? 0.7 : 1 }}>Set</button>
    </form>
  );
}
