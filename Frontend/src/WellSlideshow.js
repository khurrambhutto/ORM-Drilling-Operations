import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from './config';
import { useAuth } from './auth';
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import SiteHeader from "./SiteHeader";

function WellSlideshow({ operations: propOperations, onClose }) {
  const [operations, setOperations] = useState(propOperations || []);
  const [loading, setLoading] = useState(!propOperations);
  const [error, setError] = useState(null);
  const [dailyByWell, setDailyByWell] = useState(new Map());
  const { authFetch } = useAuth() || {};
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const qWellId = sp.get('wellId');
  const qWellName = sp.get('wellName');

  // Function to calculate weekly meters drilled
  const calculateWeeklyMetersDrilled = (mDrld, lastUpdated) => {
    if (!mDrld || !lastUpdated) return 0;
    
    const today = new Date();
    const lastUpdate = new Date(lastUpdated);
    const daysSinceLastUpdate = Math.floor((today - lastUpdate) / (1000 * 60 * 60 * 24));
    
    // Calculate meters per day (assuming daily drilling)
    const metersPerDay = mDrld / Math.max(daysSinceLastUpdate, 1);
    
    // Calculate days since Monday (0 = Monday, 6 = Sunday)
    const dayOfWeek = today.getDay();
    const daysSinceMonday = dayOfWeek === 0 ? 7 : dayOfWeek; // Sunday = 7 days since Monday
    
    // Calculate weekly total (max 7 days)
    const weeklyTotal = Math.min(metersPerDay * daysSinceMonday, mDrld);
    
    return Math.round(weeklyTotal);
  };

  useEffect(() => {
    if (!propOperations) {
      setLoading(true);
      (authFetch || fetch)(`${API_BASE}/drilling-operations`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch data");
          return res.json();
        })
        .then(async (data) => {
          if (qWellId || qWellName) {
            const filtered = data.filter(op =>
              (qWellId && String(op.WellID) === String(qWellId)) ||
              (qWellName && (op.WellName || '').toLowerCase() === String(qWellName).toLowerCase())
            );
            if (filtered.length) {
              // Show only the targeted active well
              setOperations(filtered.slice(0, 1));
            } else {
              // Not in active list — try removed wells and show a single-slide preview
              try {
                const resPast = await (authFetch || fetch)(`${API_BASE}/past-wells`);
                if (resPast.ok) {
                  const past = await resPast.json();
                  const found = past.find(w =>
                    (qWellId && String(w.WellID) === String(qWellId)) ||
                    (qWellName && (w.WellName || '').toLowerCase() === String(qWellName).toLowerCase())
                  );
          if (found) {
                    const mapped = {
                      // minimal shape used by slideshow
            DrillingOperationID: `removed-${found.WellID || found.PastWellID || Date.now()}`,
                      WellID: found.WellID,
                      WellName: found.WellName,
                      RigNo: found.RigNo,
                      BlockName: found.BlockName,
                      PresentDepthM: found.PresentDepthM ?? 0,
                      TDM: found.TDM ?? 0,
                      MDrld: found.MDrld ?? 0,
                      LastUpdated: found.LastUpdated || found.DeletedAt || new Date().toISOString(),
                      DrlgDays: found.DrlgDays ?? 0,
                      DryDays: found.DryDays ?? 0,
                      TestDays: found.TestDays ?? 0,
                      TestWODays: found.TestWODays ?? 0,
                      StopCard: found.StopCard ?? 0,
                      OperationLog: found.OperationLog || '',
                      GeneralNotes: found.GeneralNotes || '',
                      JUVPercent: found.JUVPercent || '',
                      isRemoved: true,
                    };
                    setOperations([mapped]);
                  } else {
                    setOperations([]);
                  }
                } else {
                  setOperations([]);
                }
              } catch (e) {
                setOperations([]);
              }
            }
          } else {
            setOperations(data);
          }
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [propOperations, qWellId, qWellName]);

  // Load Well Details (daily progress) for each operation so values are fresh at runtime
  useEffect(() => {
    if (!operations || operations.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(operations.map(async (op) => {
          if (!op?.WellID) return [op?.WellID, []];
          try {
            const res = await (authFetch || fetch)(`${API_BASE}/well-daily-progress?wellId=${encodeURIComponent(String(op.WellID))}`);
            if (!res.ok) throw new Error('load failed');
            const data = await res.json();
            return [op.WellID, Array.isArray(data) ? data : []];
          } catch {
            return [op.WellID, []];
          }
        }));
        if (!cancelled) setDailyByWell(new Map(results));
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [operations]);

  // Helpers to derive runtime values from Well Details
  const getDerived = (op) => {
    const rows = dailyByWell.get(op.WellID) || [];
    // Last complete row: has non-empty OperationLog and numeric ActualDepth
    const complete = rows
      .filter(r => r && r.OperationLog && String(r.OperationLog).trim().length > 0 && Number.isFinite(Number(r.ActualDepth)))
      .sort((a,b) => (Number(a.Day)||0) - (Number(b.Day)||0));
    const lastComplete = complete.length ? complete[complete.length - 1] : null;
    // Present depth from last numeric ActualDepth
    const numeric = rows
      .filter(r => Number.isFinite(Number(r.ActualDepth)))
      .sort((a,b) => (Number(a.Day)||0) - (Number(b.Day)||0));
    const lastNum = numeric.length ? numeric[numeric.length - 1] : null;
    const presentDepth = Number.isFinite(Number(lastNum?.ActualDepth)) ? Number(lastNum.ActualDepth) : (op.PresentDepthM ?? 0);
    // Meters drilled (today) from lastComplete Progress
    const metersDrilled = Number.isFinite(Number(lastComplete?.Progress)) ? Number(lastComplete.Progress) : (Number.isFinite(Number(op.MDrld)) ? Number(op.MDrld) : 0);
    // Operation log full text from lastComplete
    const opLog = (lastComplete?.OperationLog && String(lastComplete.OperationLog).trim().length > 0)
      ? String(lastComplete.OperationLog)
      : String(op.OperationLog || '');
    return { presentDepth, metersDrilled, opLog };
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (qWellId || qWellName) {
      // Return to removed-well view when opened for a specific removed well
      navigate(`/removed-well?wellId=${encodeURIComponent(String(qWellId || ''))}&wellName=${encodeURIComponent(String(qWellName || ''))}`);
    } else {
      navigate("/dashboard");
    }
  };

  if (loading) {
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 2000,
        background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%)",
        display: "flex", alignItems: "center", justifyContent: "center"
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ width: 60, height: 60, border: '8px solid rgba(255, 255, 255, 0.3)', borderTop: '8px solid #ffffff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <div style={{ color: '#ffffff', fontSize: 20, marginTop: 18 }}>Loading slideshow...</div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ 
        color: '#ef4444', 
        textAlign: 'center', 
        padding: 40, 
        background: 'rgba(239, 68, 68, 0.1)', 
        borderRadius: 8,
        border: '1px solid rgba(239, 68, 68, 0.3)'
      }}>
        Error: {error}
      </div>
    );
  }
  if (!operations || operations.length === 0) {
    return (
      <div style={{ 
        color: '#ffffff', 
        textAlign: 'center', 
        padding: 40,
        background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #60a5fa 100%)",
        borderRadius: 12
      }}>
        No well data available.
      </div>
    );
  }

  const isSingleRemoved = operations.length === 1 && operations[0] && operations[0].isRemoved === true;

  const sliderSettings = {
    dots: isSingleRemoved ? false : true,
    infinite: isSingleRemoved ? false : true,
    speed: 600,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: isSingleRemoved ? false : true,
    adaptiveHeight: false,
  };

  return (
    <div style={{
      position: "relative", 
      width: "1080px", 
      height: "720px", 
      margin: "0 auto",
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 25%, #3b82f6 50%, #60a5fa 75%, #93c5fd 100%)",
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center",
      padding: "52px 20px 20px 20px",
      borderRadius: "12px",
      boxShadow: "0 10px 40px rgba(15, 23, 42, 0.4)"
    }}>
      {/* Close Button */}
      <div style={{ 
        position: "absolute", 
        top: 15, 
        right: 15, 
        zIndex: 3000
      }}>
        <button
          onClick={handleClose}
          style={{
            background: "#ef4444",
            color: "#ffffff",
            border: "2px solid #dc2626",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            fontSize: "18px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(10px)",
            transition: "all 0.3s ease",
            fontWeight: "bold"
          }}
        >
          ✕
        </button>
      </div>

      {/* Slideshow Container */}
      <div style={{ width: "100%", height: "100%" }}>
        <Slider {...sliderSettings}>
          {operations.map((op, index) => (
            <div key={op.DrillingOperationID} style={{ padding: "20px" }}>
              {/* Well Header */}
              <div style={{ 
                textAlign: "center", 
                marginBottom: "22px",
                background: "#fff",
                borderRadius: "12px",
                padding: "20px",
                backdropFilter: "blur(10px)",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)"
              }}>
                <h1 style={{ 
                  color: "#1e3a8a", 
                  fontSize: "32px", 
                  fontWeight: "900", 
                  margin: "0 0 10px 0",
                  textShadow: "none",
                  letterSpacing: "0.5px",
                  fontFamily: "Calibri, Arial, sans-serif"
                }}>
                  {op.WellName}
                </h1>
                <div style={{ 
                  color: "#111", 
                  fontSize: "18px", 
                  fontWeight: "600",
                  display: "flex",
                  justifyContent: "center",
                  gap: "20px",
                  flexWrap: "wrap",
                  textShadow: "none",
                  fontFamily: "Calibri, Arial, sans-serif"
                }}>
                  <span>Rig: {op.RigNo}</span>
                  <span>Block: {op.BlockName}</span>
                  {!op.isRemoved && (
                    <button
                      onClick={() => navigate(`/well-details?wellId=${op.WellID}&wellName=${encodeURIComponent(op.WellName)}`)}
                      style={{
                        background: '#1976d2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Update Info
                    </button>
                  )}
                </div>
              </div>

              {/* Compact Stats Grid (slightly smaller cards) */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(4, 1fr)", 
                gap: 10, 
                marginBottom: 14 
              }}>
                <div style={{
                  background: "#fff",
                  borderRadius: 10,
                  padding: "10px 14px",
                  textAlign: "center",
                  backdropFilter: "blur(10px)",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)"
                }}>
                  <div style={{ color: "#111", fontSize: 18, fontWeight: 600, marginBottom: 8, textShadow: "none" }}>Present Depth</div>
                  <hr style={{ border: 0, borderTop: '1.5px solid #e5e7eb', margin: '8px 0 12px 0' }} />
                  {(() => { const d = getDerived(op).presentDepth; return (
                    <div style={{ color: "#1e3a8a", fontSize: 22, fontWeight: 900, textShadow: "none", fontFamily: "Calibri, Arial, sans-serif", letterSpacing: 0 }}>{d} {typeof d === 'number' ? 'M' : ''}</div>
                  ); })()}
                </div>
                <div style={{
                  background: "#fff",
                  borderRadius: 10,
                  padding: "10px 14px",
                  textAlign: "center",
                  backdropFilter: "blur(10px)",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)"
                }}>
                  <div style={{ color: "#111", fontSize: 18, fontWeight: 600, marginBottom: 8, textShadow: "none" }}>Target Depth</div>
                  <hr style={{ border: 0, borderTop: '1.5px solid #e5e7eb', margin: '8px 0 12px 0' }} />
                  <div style={{ color: "#1e3a8a", fontSize: 22, fontWeight: 900, textShadow: "none", fontFamily: "Calibri, Arial, sans-serif", letterSpacing: 0 }}>{op.TDM} {typeof op.TDM === 'number' ? 'M' : ''}</div>
                </div>
                <div style={{
                  background: "#fff",
                  borderRadius: 10,
                  padding: "10px 14px",
                  textAlign: "center",
                  backdropFilter: "blur(10px)",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)"
                }}>
                  <div style={{ color: "#111", fontSize: 18, fontWeight: 600, marginBottom: 8, textShadow: "none" }}>Meters Drilled Today</div>
                  <hr style={{ border: 0, borderTop: '1.5px solid #e5e7eb', margin: '8px 0 12px 0' }} />
                  {(() => { const m = getDerived(op).metersDrilled; return (
                    <div style={{ color: "#1e3a8a", fontSize: 22, fontWeight: 900, textShadow: "none", fontFamily: "Calibri, Arial, sans-serif", letterSpacing: 0 }}>{m} {typeof m === 'number' ? 'M' : ''}</div>
                  ); })()}
                </div>
                <div style={{
                  background: "#fff",
                  borderRadius: 10,
                  padding: "10px 14px",
                  textAlign: "center",
                  backdropFilter: "blur(10px)",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)"
                }}>
                  <div style={{ color: "#111", fontSize: 18, fontWeight: 600, marginBottom: 8, textShadow: "none" }}>Weekly Meters Drilled</div>
                  <hr style={{ border: 0, borderTop: '1.5px solid #e5e7eb', margin: '8px 0 12px 0' }} />
                  <div style={{ color: "#1e3a8a", fontSize: 22, fontWeight: 900, textShadow: "none", fontFamily: "Calibri, Arial, sans-serif", letterSpacing: 0 }}>{calculateWeeklyMetersDrilled(op.MDrld, op.LastUpdated)} {typeof calculateWeeklyMetersDrilled(op.MDrld, op.LastUpdated) === 'number' ? 'M' : ''}</div>
                </div>
              </div>

              {/* Compact KPIs Grid */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 1fr 1fr 2fr",
                alignItems: "stretch",
                gap: 12, 
                marginBottom: 14 
              }}>
                {/* Drilling Days box: */}
                <div style={{ flex: 1, background: "#fff", color: "#1e3a8a", borderRadius: 12, padding: "12px 14px", minHeight: 72, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)", border: "1px solid #e5e7eb", textAlign: "center", fontFamily: "Calibri, Arial, sans-serif" }}>
                  <div style={{ color: "#111", fontSize: 16, fontWeight: 700, marginBottom: 8, textShadow: "none" }}>Drilling Days</div>
                  <hr style={{ border: 0, borderTop: '1.5px solid #e5e7eb', margin: '8px 0 12px 0' }} />
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, marginTop: 6 }}>
                    <span style={{ color: "#111", fontSize: 14, fontWeight: 600, textShadow: "none" }}>Plan: <span style={{ color: "#1e3a8a", fontSize: 18, fontWeight: 900, textShadow: "none" }}>{op.DrlgDays}</span></span>
                    <span style={{ color: "#111", fontSize: 14, fontWeight: 600, textShadow: "none" }}>Dry: <span style={{ color: "#1e3a8a", fontSize: 18, fontWeight: 900, textShadow: "none" }}>{op.DryDays}</span></span>
                  </div>
                </div>
                {/* Test Days box: */}
                <div style={{ flex: 1, background: "#fff", color: "#1e3a8a", borderRadius: 12, padding: "12px 14px", minHeight: 72, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)", border: "1px solid #e5e7eb", textAlign: "center", fontFamily: "Calibri, Arial, sans-serif" }}>
                  <div style={{ color: "#111", fontSize: 16, fontWeight: 700, marginBottom: 8, textShadow: "none" }}>Test Days</div>
                  <hr style={{ border: 0, borderTop: '1.5px solid #e5e7eb', margin: '8px 0 12px 0' }} />
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, marginTop: 6 }}>
                    <span style={{ color: "#111", fontSize: 14, fontWeight: 600, textShadow: "none" }}>Plan: <span style={{ color: "#1e3a8a", fontSize: 18, fontWeight: 900, textShadow: "none" }}>{op.TestDays}</span></span>
                    <span style={{ color: "#111", fontSize: 14, fontWeight: 600, textShadow: "none" }}>Test W/O: <span style={{ color: "#1e3a8a", fontSize: 18, fontWeight: 900, textShadow: "none" }}>{op.TestWODays}</span></span>
                  </div>
                </div>
                <div style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: "12px 14px",
                  textAlign: "center",
                  backdropFilter: "blur(10px)",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)"
                }}>
                  <div style={{ 
                    fontSize: 16, 
                    fontWeight: 700, 
                    marginBottom: 8, 
                    color: "#111", 
                    textAlign: "center",
                    textShadow: "none" 
                  }}>
                    Stop Cards
                  </div>
                  <hr style={{ border: 0, borderTop: '1.5px solid #e5e7eb', margin: '8px 0 12px 0' }} />
                  <div style={{ 
                    fontSize: 18, 
                    fontWeight: 900, 
                    color: "#1e3a8a", 
                    textAlign: "center",
                    marginTop: 6,
                    textShadow: "none",
                    fontFamily: "Calibri, Arial, sans-serif",
                    letterSpacing: 0
                  }}>
                    {op.StopCard}
                  </div>
                </div>
                {/* JUV Shares card (always shown) */}
                <div style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: "12px 14px",
                  textAlign: "left",
                  backdropFilter: "blur(10px)",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)"
                }}>
                  <div style={{ color: "#111", fontSize: 16, fontWeight: 700, marginBottom: 8, textShadow: "none" }}>JUV Shares</div>
                  <hr style={{ border: 0, borderTop: '1.5px solid #e5e7eb', margin: '6px 0 8px 0' }} />
                  <div style={{ whiteSpace: 'pre-line', color: '#111', background: '#f8fafc', borderRadius: 8, padding: '8px 10px', border: '1px solid #e5e7eb', fontSize: 14, lineHeight: 1.35, maxHeight: 86, overflow: 'auto' }}>
                    {op?.JUVPercent && String(op.JUVPercent).trim().length > 0 ? String(op.JUVPercent) : '—'}
                  </div>
                </div>
              </div>

              {/* Operation Log (larger) */}
              <div style={{ 
                background: "#fff", 
                color: "#1e3a8a", 
                borderRadius: 12, 
                padding: "20px 24px", 
                marginBottom: 12,
                fontWeight: 500, 
                fontSize: 18, 
                textAlign: "left", 
                backdropFilter: "blur(10px)",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)"
              }}>
                {/* Extract main idea from first line */}
                {(() => {
                  const mainIdea = (() => {
                    const firstLine = (op.OperationLog || '').split('\n')[0].toLowerCase();
                    if (firstLine.includes('well under drilling')) return 'Well under Drilling';
                    if (firstLine.includes('well under production')) return 'Well under Production';
                    if (firstLine.includes('rig shifting')) return 'Rig Shifting';
                    if (firstLine.includes('rig down')) return 'Rig Down';
                    // Add more as needed
                    return '';
                  })();
                  return (
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#1e3a8a', marginBottom: 8 }}>
                      {mainIdea}
                    </div>
                  );
                })()}
                <div style={{ 
                  lineHeight: 1.6, 
                  maxHeight: "360px", 
                  overflow: "hidden", 
                  fontSize: 20, 
                  fontWeight: 400,
                  textShadow: "none",
                  fontFamily: "Calibri, Arial, sans-serif"
                }}>
                  {(() => { const txt = getDerived(op).opLog; return txt || "No operation log available."; })()}
                </div>
              </div>

              {/* Compact General Notes */}
              <div style={{ 
                background: "#fff", 
                color: "#1e3a8a", 
                borderRadius: 12, 
                padding: "12px 16px", 
                fontSize: 12, 
                textAlign: "left", 
                backdropFilter: "blur(10px)",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.05)"
              }}>
                <div style={{ 
                  fontWeight: 700, 
                  fontSize: 16, 
                  marginBottom: 10,
                  color: "#111",
                  textShadow: "none"
                }}>
                  General Notes
                </div>
                <hr style={{ border: 0, borderTop: '1.5px solid #e5e7eb', margin: '8px 0 12px 0' }} />
                <div style={{ 
                  lineHeight: 1.4, 
                  fontSize: 12,
                  textShadow: "none",
                  whiteSpace: "pre-line",
                  fontFamily: "Calibri, Arial, sans-serif"
                }}>
                  {op.GeneralNotes ? op.GeneralNotes : "Target: 2025-26: 16 Wells (Spudded: 4, Exp: 3, Dev: 0, S/T/R/E: 00, W/O: 8, P&A: 1)\nMeter Drilled in F.Y 2025-26: Since July 01, 2024 = 21753 M, In march, 2025 = 1906 M.\nNote:- Rig N-1 stacked at location# Rajian-7 & under technical assessment"}
                </div>
              </div>
            </div>
          ))}
        </Slider>
      </div>
    </div>
  );
}

// Compact Card Styles
const compactCardStyle = {
  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  color: "#fff",
  borderRadius: 10,
  padding: "12px 16px",
  minHeight: 70,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 16px rgba(102,126,234,0.25)",
  border: "1px solid rgba(255,255,255,0.15)",
  transition: "all 0.3s ease",
  fontFamily: "Inter, Segoe UI, Arial, sans-serif",
};

const compactStatNum = { 
  fontSize: 20, 
  fontWeight: 800, 
  color: "#fff", 
  textAlign: "center",
  textShadow: "0 1px 2px rgba(0,0,0,0.2)"
};

const compactStatLabel = { 
  fontSize: 18, 
  opacity: 0.9, 
  marginBottom: 4, 
  textAlign: "center",
  fontWeight: 700
};

const compactKpiCard = { 
  background: "linear-gradient(135deg, #fc466b 0%, #3f5efb 100%)",
  color: "#fff",
  borderRadius: 10,
  padding: "12px 16px",
  minHeight: 80,
  boxShadow: "0 4px 16px rgba(252,70,107,0.25)",
  border: "1px solid rgba(255,255,255,0.15)",
};

const compactKpiTitle = { 
  fontWeight: 800, 
  fontSize: 16, 
  color: "#fff", 
  textAlign: "center",
  textShadow: "0 1px 2px rgba(0,0,0,0.3)"
};

const compactKpiItem = { 
  display: "flex", 
  flexDirection: "column", 
  alignItems: "center"
};

const compactKpiLabel = { 
  fontSize: 12, 
  color: "rgba(255,255,255,0.8)", 
  fontWeight: 500,
  marginBottom: 2
};

const compactKpiValue = { 
  fontSize: 18, 
  color: "#fff", 
  fontWeight: 700,
  textShadow: "0 1px 2px rgba(0,0,0,0.3)"
};

export default WellSlideshow;