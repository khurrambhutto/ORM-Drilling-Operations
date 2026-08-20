import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from './config';
import ProvinceImage from './ProvinceImage';
import WellMap from './WellMap';
import SiteHeader from './SiteHeader';
import { useAuth } from './auth';

export default function RemovedWellView() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const wellId = Number(sp.get('wellId')) || null;
  const wellName = sp.get('wellName') || '';
  const [well, setWell] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { authFetch } = useAuth() || {};

  // Helpers copied from dashboard for visual consistency
  const getProvinceFromBlock = (blockName) => {
    if (!blockName) return 'Unknown';
    const blockLower = blockName.toLowerCase();
    if (blockLower.includes('punjab') || blockLower.includes('sargodha') || blockLower.includes('chakwal')) return 'Punjab';
    if (blockLower.includes('sindh') || blockLower.includes('karachi') || blockLower.includes('hyderabad')) return 'Sindh';
    if (blockLower.includes('kpk') || blockLower.includes('peshawar') || blockLower.includes('swat')) return 'Khyber Pakhtunkhwa';
    if (blockLower.includes('balochistan') || blockLower.includes('quetta') || blockLower.includes('sui')) return 'Balochistan';
    if (blockLower.includes('gilgit') || blockLower.includes('baltistan')) return 'Gilgit-Baltistan';
    if (blockLower.includes('kashmir') || blockLower.includes('ajk')) return 'Azad Jammu and Kashmir';
    if (blockLower.includes('islamabad') || blockLower.includes('ict')) return 'Islamabad Capital Territory';
    return 'Unknown';
  };

  const province = useMemo(() => getProvinceFromBlock(well?.BlockName), [well]);

  const calculateWeeklyMetersDrilled = (mDrld, lastUpdated) => {
    if (!mDrld || !lastUpdated) return 0;
    const today = new Date();
    const lastUpdate = new Date(lastUpdated);
    const daysSinceLastUpdate = Math.floor((today - lastUpdate) / (1000 * 60 * 60 * 24));
    const metersPerDay = mDrld / Math.max(daysSinceLastUpdate, 1);
    const dayOfWeek = today.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 7 : dayOfWeek;
    const weeklyTotal = Math.min(metersPerDay * daysSinceMonday, mDrld);
    return Math.round(weeklyTotal);
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        // Reuse /past-wells and pick the one we need
  const res = await (authFetch || fetch)(`${API_BASE}/past-wells`);
        if (!res.ok) throw new Error('Failed to load removed wells');
        const data = await res.json();
        const found = data.find(w => String(w.WellID) === String(wellId) || (w.WellName || '').toLowerCase() === (wellName || '').toLowerCase());
        if (!found) throw new Error('Removed well not found');
        setWell(found);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [wellId, wellName]);

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: 24 }}>Loading removed well…</div>;
  if (error) return <div style={{ color: '#ff8a80', textAlign: 'center', padding: 24 }}>Error: {error}</div>;
  if (!well) return <div style={{ color: '#fff', textAlign: 'center', padding: 24 }}>Not found</div>;

  return (
  <div className="dashboard-container" style={{ paddingTop: 12 }}>
  <SiteHeader title={`${well.WellName} (Removed)`} />
  <h1 className="dashboard-title" style={{ display: 'none' }}>{well.WellName} (Removed)</h1>
      {/* Top action buttons (kept) */}
  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
        <button
          className="action-button button-danger"
          onClick={() => navigate('/dashboard', { state: { selectWell: '' } })}
        >
          ← Back
        </button>
        <button
          className="action-button button-primary"
          onClick={() => navigate(`/well-details?wellId=${well.WellID}&wellName=${encodeURIComponent(well.WellName || '')}&readOnly=1`)}
        >
          View Well Details (Read-only)
        </button>
        <button
          className="action-button button-purple"
          onClick={() => navigate(`/slideshow?wellId=${well.WellID}&wellName=${encodeURIComponent(well.WellName || '')}`)}
        >
          View Slideshow for this Well
        </button>
      </div>

      {/* Read-only version of the selected well screen */}
      <div className="professional-card" style={{ padding: 24, marginBottom: 32, position: 'relative', maxWidth: '1200px', margin: '0 auto 32px auto', background: '#0F1D3B', borderRadius: 16, boxShadow: '0 8px 32px rgba(25, 118, 210, 0.10)', border: '1px solid #2a5bd7' }}>
        {/* Header chips (now at the top, before maps) */}
        <div style={{ width: '100%', textAlign: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', marginRight: 8, fontSize: '16px', color: 'white' }}>RIG:</span>
              <span style={{ padding: '6px 14px', background: '#23234c', borderRadius: 4, border: '1px solid #2a5bd7', fontSize: '16px', fontWeight: '500', color: 'white' }}>{well.RigNo || '-'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', marginRight: 8, color: '#ff5252', fontSize: '16px' }}>WELL:</span>
              <span style={{ padding: '6px 14px', background: '#23234c', borderRadius: 4, border: '1px solid #ff5252', color: '#ff5252', fontSize: '16px', fontWeight: '500' }}>{well.WellName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', marginRight: 8, fontSize: '16px', color: 'white' }}>BLOCK:</span>
              <span style={{ padding: '6px 14px', background: '#23234c', borderRadius: 4, border: '1px solid #2a5bd7', fontSize: '16px', fontWeight: '500', color: 'white' }}>{well.BlockName || '-'}</span>
            </div>
          </div>
        </div>

        {/* Province Image and Well Location Map */}
        <div style={{ display: 'flex', gap: 32, marginBottom: 24, justifyContent: 'center', alignItems: 'center', maxWidth: '1200px', margin: '0 auto 24px auto' }}>
          <div style={{ background: '#0e1b33', borderRadius: 16, padding: 20, boxShadow: '0 8px 24px rgba(35, 35, 76, 0.3)', border: '2px solid rgba(0, 150, 136, 0.6)', flex: 1 }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(0, 150, 136, 0.3) 0%, rgba(0, 188, 212, 0.2) 100%)', borderRadius: 12, padding: 16, border: '2px solid rgba(0, 150, 136, 0.4)' }}>
              <ProvinceImage province={province} />
            </div>
          </div>
          <div style={{ background: '#0e1b33', borderRadius: 16, padding: 20, boxShadow: '0 8px 24px rgba(35, 35, 76, 0.3)', border: '2px solid rgba(211, 47, 47, 0.6)', flex: 1 }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(211, 47, 47, 0.3) 0%, rgba(255, 87, 34, 0.2) 100%)', borderRadius: 12, padding: 16, border: '2px solid rgba(211, 47, 47, 0.4)' }}>
              <WellMap latitude={well.Latitude} longitude={well.Longitude} wellName={well.WellName} blockName={well.BlockName} />
            </div>
          </div>
        </div>

  {/* Chips moved above */}

        {/* Stat boxes (read-only) */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, background: '#23234c', color: 'white', borderRadius: 12, padding: '12px', minWidth: 200, minHeight: 100, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '6px', color: '#fff' }}>Spud Date</div>
            <div style={{ background: '#1a4e4a', borderRadius: 8, padding: 8, textAlign: 'center', border: 'none', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, textAlign: 'center', color: 'white' }}>{well.SpudDate ? String(well.SpudDate).split('T')[0] : '—'}</div>
            </div>
          </div>
          <div style={{ flex: 1, background: '#23234c', color: 'white', borderRadius: 12, padding: '12px', minWidth: 200, minHeight: 100, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '6px', color: '#fff' }}>STOP CARDS</div>
            <div style={{ background: '#4a1a1a', borderRadius: 8, padding: 8, textAlign: 'center', border: 'none', width: '100%' }}>
              <div style={{ background: '#0F1D3B', borderRadius: 6, padding: '8px 12px', border: '2px solid #d32f2f' }}>{well.StopCard ?? 0}</div>
            </div>
          </div>
          <div style={{ flex: 1, background: '#23234c', color: 'white', borderRadius: 12, padding: '12px', minWidth: 200, minHeight: 100, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '6px', color: '#fff' }}>Meters Drilled</div>
            <div style={{ background: '#1a4a4a', borderRadius: 8, padding: 8, textAlign: 'center', border: 'none', width: '100%' }}>
              <div style={{ background: '#0F1D3B', borderRadius: 6, padding: '8px 12px', border: '2px solid #00acc1' }}>{well.MDrld ?? 0}</div>
            </div>
          </div>
          <div style={{ flex: 1, background: '#23234c', color: 'white', borderRadius: 12, padding: '12px', minWidth: 200, minHeight: 100, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '6px', color: '#fff' }}>Weekly</div>
            <div style={{ background: '#4a3a1a', borderRadius: 8, padding: 8, textAlign: 'center', border: 'none', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, textAlign: 'center', color: 'white' }}>{calculateWeeklyMetersDrilled(well.MDrld, well.LastUpdated)}</div>
            </div>
          </div>
        </div>

        {/* Present vs Target Depth (read-only) */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, background: '#23234c', color: '#fff', borderRadius: 12, padding: 20, minHeight: '140px', boxShadow: '0 4px 16px rgba(25, 118, 210, 0.10)', border: 'none', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', minWidth: 600, textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#fff', background: 'transparent', padding: 0, borderRadius: 0, fontSize: '22px', fontWeight: 800, letterSpacing: 0.5, textAlign: 'center' }}>Present Depth M vs Target Depth M</h4>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <div style={{ flex: 1, background: '#1a3a4a', borderRadius: 8, padding: 12, textAlign: 'center', border: 'none' }}>
                <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: '#fff' }}>Present Depth M</div>
                <div style={{ background: '#0F1D3B', borderRadius: 6, padding: '8px 12px', border: '2px solid #00bcd4' }}>{well.PresentDepthM ?? 0}</div>
              </div>
              <div style={{ flex: 1, background: '#4a1a3a', borderRadius: 8, padding: 12, textAlign: 'center', border: 'none' }}>
                <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: '#fff' }}>Target Depth M</div>
                <div style={{ background: '#0F1D3B', borderRadius: 6, padding: '8px 12px', border: '2px solid #e91e63' }}>{well.TDM ?? 0}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Operation Log */}
        <div style={{ marginBottom: 24, marginTop: 24, textAlign: 'center' }}>
          <div style={{ background: '#23234c', color: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 4px 16px rgba(25, 118, 210, 0.10)', border: 'none', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#fff', background: 'transparent', padding: 0, borderRadius: 0, fontSize: '24px', fontWeight: 900, letterSpacing: 0.5, textAlign: 'center' }}>Operation Log</h4>
            <div style={{ whiteSpace: 'pre-line', lineHeight: 1.8, color: '#fff', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', fontSize: 22, background: 'transparent', padding: 0, borderRadius: 0, border: 'none', minHeight: '120px', textAlign: 'center' }}>
              {well.OperationLog || '—'}
            </div>
            {/* JUV Shares display */}
            {well?.JUVPercent && String(well.JUVPercent).trim().length > 0 && (
              <div style={{ marginTop: 16, textAlign: 'left' }}>
                <div style={{ fontWeight: 800, color: '#9bb1ff', marginBottom: 6 }}>JUV Shares</div>
                <div style={{ background: '#0b1530', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-line', color: '#e8ecff', fontSize: 14 }}>
                  {String(well.JUVPercent)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
