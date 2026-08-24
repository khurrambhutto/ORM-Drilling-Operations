import React, { useEffect, useState, useMemo, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, CartesianGrid, Brush, LabelList } from 'recharts';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import Slider from "react-slick";
import WellPieChartBox from "./WellPieChartBox";
import { useNavigate, useLocation } from "react-router-dom";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ProvinceImage from "./ProvinceImage";
import WellMap from "./WellMap";
import WellSelector from "./WellSelector";
import WellSummaryCard from "./WellSummaryCard";
import WellCharts from "./WellCharts";
import WellSlideshow from "./WellSlideshow";
import SiteHeader from "./SiteHeader";
import { API_BASE } from './config';
import { useAuth } from './auth';

// Separate AddWellModal component to prevent re-renders
const AddWellModal = ({ isOpen, onClose, onSubmit, initialData = {} }) => {
  const [formData, setFormData] = useState({
    WellName: '',
    RigName: '',
    BlockName: '',
    Longitude: '',
    Latitude: '',
    SpudDate: '',
    TargetDepth: '',
    PlannedAFEDaysDrilling: '',
  PlannedAFEDaysTesting: '',
  JUVPercent: '',
  GeneralNotes: '',
    ...initialData
  });
  const [error, setError] = useState(null);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      await onSubmit(formData);
  setFormData({
        WellName: '',
        RigName: '',
        BlockName: '',
        Longitude: '',
        Latitude: '',
        SpudDate: '',
        TargetDepth: '',
        PlannedAFEDaysDrilling: '',
        PlannedAFEDaysTesting: '',
        JUVPercent: '',
        GeneralNotes: ''
      });
      onClose();
    } catch (err) {
  // Remove '400:' prefix if present
  let msg = err.message;
  if (msg.startsWith('400:')) msg = msg.replace(/^400:\s*/, '');
  setError(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', padding: 32, borderRadius: 12, minWidth: 400, maxWidth: 600, boxShadow: '0 4px 32px rgba(25, 118, 210, 0.20)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: 16, color: '#23234c' }}>Add New Well</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <input 
            placeholder="Well Name *" 
            type="text"
            value={formData.WellName} 
            onChange={e => handleInputChange('WellName', e.target.value)} 
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }} 
          />
          <input 
            placeholder="Rig Name *" 
            type="text"
            value={formData.RigName} 
            onChange={e => handleInputChange('RigName', e.target.value)} 
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }} 
          />
          <input 
            placeholder="Block Name *" 
            type="text"
            value={formData.BlockName} 
            onChange={e => handleInputChange('BlockName', e.target.value)} 
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }} 
          />
          <input 
            placeholder="Spud Date (DD/MM/YYYY) *"
            type="date"
            value={formData.SpudDate} 
            onChange={e => handleInputChange('SpudDate', e.target.value)} 
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }} 
          />
          <input 
            placeholder="Longitude *" 
            type="number"
            step="any"
            value={formData.Longitude} 
            onChange={e => handleInputChange('Longitude', e.target.value)} 
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }} 
          />
          <input 
            placeholder="Latitude *" 
            type="number"
            step="any"
            value={formData.Latitude} 
            onChange={e => handleInputChange('Latitude', e.target.value)} 
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }} 
          />
          <input 
            placeholder="Target Depth (M) *" 
            type="number"
            value={formData.TargetDepth} 
            onChange={e => handleInputChange('TargetDepth', e.target.value)} 
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }} 
          />
          <input 
            placeholder="Planned AFE Days (Drilling) *" 
            type="number"
            value={formData.PlannedAFEDaysDrilling} 
            onChange={e => handleInputChange('PlannedAFEDaysDrilling', e.target.value)} 
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }} 
          />
          <input 
            placeholder="Planned AFE Days (Testing) *" 
            type="number"
            value={formData.PlannedAFEDaysTesting} 
            onChange={e => handleInputChange('PlannedAFEDaysTesting', e.target.value)} 
            style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }} 
          />
          <div style={{ gridColumn: '1 / span 2', display: 'flex', flexDirection: 'column' }}>
            <textarea
              placeholder="JUV Shares (one per line: Company: value%)"
              value={formData.JUVPercent}
              onChange={e => handleInputChange('JUVPercent', e.target.value)}
              rows={4}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', resize: 'vertical', minHeight: 100 }}
            />
            <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>Example: OGDC The Energy: 65%\nPOL: 25%\nGovernment: 10%</div>
          </div>
          <div style={{ gridColumn: '1 / span 2', display: 'flex', flexDirection: 'column' }}>
            <textarea
              placeholder="General Notes (optional)"
              value={formData.GeneralNotes}
              onChange={e => handleInputChange('GeneralNotes', e.target.value)}
              rows={3}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', resize: 'vertical' }}
            />
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: '12px', color: '#666' }}>
          * Required fields
        </div>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
        <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: '#eee', color: '#23234c', border: 'none', borderRadius: 6, padding: '8px 18px', fontWeight: 600 }}>Cancel</button>
          <button 
            onClick={handleSubmit} 
            disabled={(() => {
              const required = [
                formData.WellName,
                formData.RigName,
                formData.BlockName,
                formData.SpudDate,
                formData.Longitude,
                formData.Latitude,
                formData.TargetDepth,
                formData.PlannedAFEDaysDrilling,
                formData.PlannedAFEDaysTesting,
              ];
              return required.some(v => v === undefined || v === null || String(v).trim() === '');
            })()}
            style={{ 
              background: (() => {
                const required = [
                  formData.WellName,
                  formData.RigName,
                  formData.BlockName,
                  formData.SpudDate,
                  formData.Longitude,
                  formData.Latitude,
                  formData.TargetDepth,
                  formData.PlannedAFEDaysDrilling,
                  formData.PlannedAFEDaysTesting,
                ];
                return required.some(v => v === undefined || v === null || String(v).trim() === '') ? '#ccc' : '#388e3c';
              })(), 
              color: '#fff', 
              border: 'none', 
              borderRadius: 6, 
              padding: '8px 18px', 
              fontWeight: 600,
              cursor: (() => {
                const required = [
                  formData.WellName,
                  formData.RigName,
                  formData.BlockName,
                  formData.SpudDate,
                  formData.Longitude,
                  formData.Latitude,
                  formData.TargetDepth,
                  formData.PlannedAFEDaysDrilling,
                  formData.PlannedAFEDaysTesting,
                ];
                return required.some(v => v === undefined || v === null || String(v).trim() === '') ? 'not-allowed' : 'pointer';
              })()
            }}
          >
            Add Well
          </button>
        </div>
      </div>
    </div>
  );
};

// Fix default marker icon issue with webpack
if (L.Icon.Default && L.Icon.Default.mergeOptions) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
  });
}

function DrillingDashboard() {
  const { authFetch, user } = useAuth();
  const isAdmin = !!user?.IsAdmin;
  const doFetch = useCallback((url, options) => (authFetch ? authFetch(url, options) : fetch(url, options)), [authFetch]);
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWell, setSelectedWell] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [selectedProvince, setSelectedProvince] = useState("");
  // History feature removed
  const navigate = useNavigate();
  const [emailStatus, setEmailStatus] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const location = useLocation();
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingWellId, setDeletingWellId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedWellsToDelete, setSelectedWellsToDelete] = useState([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSearch, setDeleteSearch] = useState("");
  const [showPastWellsModal, setShowPastWellsModal] = useState(false);
  const [pastWells, setPastWells] = useState([]);
  const [pastWellsLoading, setPastWellsLoading] = useState(false);
  const [reactivatingId, setReactivatingId] = useState(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  // Rig-wise FY editor
  const [showRigFyEditor, setShowRigFyEditor] = useState(false);
  const [rigFilter, setRigFilter] = useState('');
  const rigOptions = useMemo(() => Array.from(new Set(operations.map(op => op.RigNo).filter(Boolean))).sort(), [operations]);
  const wellsByRig = useMemo(() => {
    const map = new Map();
    for (const op of operations) {
      if (!op.RigNo) continue;
      if (!map.has(op.RigNo)) map.set(op.RigNo, []);
      map.get(op.RigNo).push(op);
    }
    for (const [k, arr] of map) {
      arr.sort((a,b) => (a.SrNo||0) - (b.SrNo||0));
    }
    return map;
  }, [operations]);
  // Daily progress for Depth vs Days chart
  const [dailyRows, setDailyRows] = useState([]);
  const [dailyLoading, setDailyLoading] = useState(false);

  // Inline editing state
  const [editingField, setEditingField] = useState(null); // which field is being edited
  const [editingValue, setEditingValue] = useState(''); // current editing value
  const [originalValue, setOriginalValue] = useState(''); // backup of original value

  // Function to determine province from block name - moved before useMemo
  const getProvinceFromBlock = useCallback((blockName) => {
    if (!blockName) return "Unknown";
    
    const blockLower = blockName.toLowerCase();
    
    if (blockLower.includes('punjab') || blockLower.includes('sargodha') || blockLower.includes('chakwal')) {
      return "Punjab";
    } else if (blockLower.includes('sindh') || blockLower.includes('karachi') || blockLower.includes('hyderabad')) {
      return "Sindh";
    } else if (blockLower.includes('kpk') || blockLower.includes('peshawar') || blockLower.includes('swat')) {
      return "Khyber Pakhtunkhwa";
    } else if (blockLower.includes('balochistan') || blockLower.includes('quetta') || blockLower.includes('sui')) {
      return "Balochistan";
    } else if (blockLower.includes('gilgit') || blockLower.includes('baltistan')) {
      return "Gilgit-Baltistan";
    } else if (blockLower.includes('kashmir') || blockLower.includes('ajk')) {
      return "Azad Jammu and Kashmir";
    } else if (blockLower.includes('islamabad') || blockLower.includes('ict')) {
      return "Islamabad Capital Territory";
    } else {
      return "Unknown";
    }
  }, []);

  // Fallback: determine province approximately from coordinates (bounding boxes)
  const getProvinceFromCoords = useCallback((lat, lon) => {
    const toNum = v => (v === undefined || v === null ? NaN : Number(v));
    const la = toNum(lat), lo = toNum(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return "Unknown";
    // ICT (very small region around Islamabad)
    if (la >= 33.5 && la <= 33.95 && lo >= 72.8 && lo <= 73.4) return "Islamabad Capital Territory";
    // Gilgit-Baltistan (far north)
    if (la >= 35.0 && la <= 37.9 && lo >= 74.0 && lo <= 77.8) return "Gilgit-Baltistan";
    // AJK (north-east)
    if (la >= 33.0 && la <= 35.7 && lo >= 73.0 && lo <= 75.8) return "Azad Jammu and Kashmir";
    // Sindh (south)
    if (la >= 23.3 && la <= 28.9 && lo >= 66.0 && lo <= 71.5) return "Sindh";
    // Balochistan (west/south-west)
    if (la >= 24.0 && la <= 31.9 && lo >= 62.0 && lo <= 70.7) return "Balochistan";
    // Khyber Pakhtunkhwa (north-west)
    if (la >= 32.0 && la <= 36.9 && lo >= 69.0 && lo <= 74.6) return "Khyber Pakhtunkhwa";
    // Punjab (central-east)
    if (la >= 27.5 && la <= 33.1 && lo >= 69.5 && lo <= 75.7) return "Punjab";
    return "Unknown";
  }, []);

  // Function to calculate weekly meters drilled
  const calculateWeeklyMetersDrilled = useCallback((mDrld, lastUpdated) => {
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
  }, []);

  // Memoized expensive computations
  const wells = useMemo(() => Array.from(new Set(operations.map(op => op.WellName))), [operations]);
  
  const selectedOp = useMemo(() => {
    const op = operations.find(op => op.WellName === selectedWell);
    console.log('Selected operation:', op);
    console.log('Selected operation WellID:', op?.WellID);
    return op;
  }, [operations, selectedWell]);

  // Fetch daily progress rows when a well is selected
  useEffect(() => {
  const fetchDaily = async () => {
      if (!selectedOp?.WellID) { setDailyRows([]); return; }
      setDailyLoading(true);
      try {
  const res = await doFetch(`${API_BASE}/well-daily-progress?wellId=${encodeURIComponent(String(selectedOp.WellID))}`);
        if (!res.ok) throw new Error('Failed to load well daily details');
        const data = await res.json();
        setDailyRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn('Daily details error:', e.message);
        setDailyRows([]);
      } finally {
        setDailyLoading(false);
      }
    };
    fetchDaily();
  }, [selectedOp?.WellID]);
  
  // Memoized wells by province
  const wellsByProvince = useMemo(() => {
    return operations.reduce((acc, op) => {
      const province = getProvinceFromBlock(op.BlockName);
      if (!acc[province]) acc[province] = [];
      acc[province].push(op);
      return acc;
    }, {});
  }, [operations, getProvinceFromBlock]);

  // Memoized chart data
  const pieChartData = useMemo(() => {
    if (!selectedOp) return [];
    return [
      { name: 'Actual Depth', value: selectedOp.PresentDepthM },
      { name: 'Target Depth Remaining', value: Math.max(selectedOp.TDM - selectedOp.PresentDepthM, 0) }
    ];
  }, [selectedOp]);

  const barChartData = useMemo(() => {
    if (!selectedOp) return [];
    return [
  { name: selectedOp.WellName, 'Drlg Plan': selectedOp.DrlgDays, 'Dry': selectedOp.DryDays }
    ];
  }, [selectedOp]);

  const testBarChartData = useMemo(() => {
    if (!selectedOp) return [];
    return [
  { name: selectedOp.WellName, 'Test Plan': selectedOp.TestDays, 'Test W/O': selectedOp.TestWODays }
    ];
  }, [selectedOp]);

  // Depth vs Days chart data and domains
  const depthVsDays = useMemo(() => {
    if (!Array.isArray(dailyRows)) return { data: [], maxDay: 0 };
    // Map rows to { Day, PlannedDepth, ActualDepth } preserving numeric values
    const mapped = dailyRows
      .map(r => ({
        Day: Number(r.Day) || 0,
        PlannedDepth: r.PlannedDepth === null || r.PlannedDepth === undefined ? null : Number(r.PlannedDepth),
        ActualDepth: r.ActualDepth === null || r.ActualDepth === undefined ? null : Number(r.ActualDepth),
      }))
      .filter(d => Number.isFinite(d.Day))
      .sort((a,b) => a.Day - b.Day);
    const maxDay = mapped.reduce((m, d) => Math.max(m, d.Day || 0), 0);
    return { data: mapped, maxDay };
  }, [dailyRows]);

  // Daily delta bar data: delta = Actual - Planned (per day)
  const dailyDelta = useMemo(() => {
    const rows = Array.isArray(depthVsDays.data) ? depthVsDays.data : [];
    const maxDay = Number(depthVsDays.maxDay) || 0;
    // Build an index by Day for quick lookup
    const byDay = new Map();
    for (const d of rows) {
      byDay.set(Number(d.Day), d);
    }
    const data = [];
    for (let day = 1; day <= maxDay; day++) {
      const r = byDay.get(day) || {};
      const planned = Number.isFinite(r.PlannedDepth) ? Number(r.PlannedDepth) : null;
      const actual = Number.isFinite(r.ActualDepth) ? Number(r.ActualDepth) : null;
      const delta = Number.isFinite(planned) && Number.isFinite(actual) ? (actual - planned) : null;
      data.push({ Day: day, PlannedDepth: planned, ActualDepth: actual, delta });
    }
    let min = 0, max = 0;
    for (const r of data) {
      if (Number.isFinite(r.delta)) {
        if (r.delta < min) min = r.delta;
        if (r.delta > max) max = r.delta;
      }
    }
    const maxAbs = Math.max(Math.abs(min), Math.abs(max));
    return { data, maxAbs };
  }, [depthVsDays]);

  // Planned series and day index helpers for insights
  const plannedSeries = useMemo(() => {
    return (depthVsDays?.data || [])
      .filter(row => Number.isFinite(Number(row.Day)))
      .map(row => ({ Day: Number(row.Day), PlannedDepth: Number.isFinite(Number(row.PlannedDepth)) ? Number(row.PlannedDepth) : null }))
      .filter(row => row.PlannedDepth !== null)
      .sort((a,b) => a.Day - b.Day);
  }, [depthVsDays]);

  const byDayMap = useMemo(() => {
    const m = new Map();
    for (const r of (depthVsDays?.data || [])) {
      const d = Number(r.Day);
      if (Number.isFinite(d)) m.set(d, r);
    }
    return m;
  }, [depthVsDays]);

  // Compute the planned day at which the target depth is reached (linear between plan points)
  const computePlannedDayForDepth = useCallback((series, targetDepth) => {
    if (!Number.isFinite(targetDepth) || !Array.isArray(series) || series.length === 0) return null;
    if (targetDepth <= series[0].PlannedDepth) {
      if (series.length > 1) {
        const p0 = series[0].PlannedDepth, p1 = series[1].PlannedDepth;
        const d0 = series[0].Day, d1 = series[1].Day;
        if (p1 !== p0) {
          const t = (targetDepth - p0) / (p1 - p0);
          return d0 + Math.max(0, Math.min(1, t)) * (d1 - d0);
        }
      }
      return series[0].Day;
    }
    for (let j = 1; j < series.length; j++) {
      const prev = series[j-1], curr = series[j];
      if (targetDepth <= curr.PlannedDepth) {
        const p0 = prev.PlannedDepth, p1 = curr.PlannedDepth;
        const d0 = prev.Day, d1 = curr.Day;
        if (p1 === p0) return d1;
        const t = (targetDepth - p0) / (p1 - p0);
        return d0 + t * (d1 - d0);
      }
    }
    return series[series.length - 1].Day;
  }, []);

  // Helpers derived from dailyRows (Well Details)
  const lastCompleteRow = useMemo(() => {
    if (!Array.isArray(dailyRows) || dailyRows.length === 0) return null;
    // a "complete" row has ActualDepth filled (numeric) and OperationLog non-empty
    const complete = dailyRows
      .filter(r => (r && r.OperationLog && String(r.OperationLog).trim().length > 0)
        && Number.isFinite(Number(r.ActualDepth)))
      .sort((a, b) => (Number(a.Day) || 0) - (Number(b.Day) || 0));
    return complete.length ? complete[complete.length - 1] : null;
  }, [dailyRows]);

  // Day insights state (defaults to day with operation log details)
  const [insightDay, setInsightDay] = useState(1);
  useEffect(() => {
    // Default to the day that has operation log details, or latest day if none
    const dayWithOpLog = lastCompleteRow ? Number(lastCompleteRow.Day) || 1 : 1;
    const maxDay = Number(depthVsDays.maxDay) || 1;
    const defaultDay = lastCompleteRow ? dayWithOpLog : maxDay;
    setInsightDay(defaultDay);
  }, [depthVsDays.maxDay, lastCompleteRow]);

  const dayInsights = useMemo(() => {
    const d = Number(insightDay);
    const row = byDayMap.get(d) || {};
    const planned = Number.isFinite(Number(row.PlannedDepth)) ? Number(row.PlannedDepth) : null;
    const actual = Number.isFinite(Number(row.ActualDepth)) ? Number(row.ActualDepth) : null;
    const deltaMeters = (Number.isFinite(actual) && Number.isFinite(planned)) ? (actual - planned) : null;
    const plannedDayForActual = Number.isFinite(actual) ? computePlannedDayForDepth(plannedSeries, actual) : null;
    const deltaDays = (Number.isFinite(plannedDayForActual) && Number.isFinite(d)) ? (plannedDayForActual - d) : null;
    return { day: d, planned, actual, deltaMeters, deltaDays };
  }, [insightDay, byDayMap, plannedSeries, computePlannedDayForDepth]);

  const computedPresentDepth = useMemo(() => {
    // last numeric ActualDepth from dailyRows
    const numericRows = (dailyRows || [])
      .filter(r => Number.isFinite(Number(r.ActualDepth)))
      .sort((a, b) => (Number(a.Day) || 0) - (Number(b.Day) || 0));
    const last = numericRows.length ? numericRows[numericRows.length - 1] : null;
    const val = last ? Number(last.ActualDepth) : (selectedOp?.PresentDepthM || 0);
    return Number.isFinite(val) ? val : 0;
  }, [dailyRows, selectedOp]);

  const computedMetersDrilled = useMemo(() => {
    // Progress value of the last complete row; fallback to last numeric Progress
    if (lastCompleteRow && Number.isFinite(Number(lastCompleteRow.Progress))) {
      return Number(lastCompleteRow.Progress);
    }
    const numeric = (dailyRows || [])
      .filter(r => Number.isFinite(Number(r.Progress)))
      .sort((a, b) => (Number(a.Day) || 0) - (Number(b.Day) || 0));
    const last = numeric.length ? Number(numeric[numeric.length - 1].Progress) : 0;
    return Number.isFinite(last) ? last : 0;
  }, [dailyRows, lastCompleteRow]);

  const computedWeeklyProgress = useMemo(() => {
    if (!Array.isArray(dailyRows) || dailyRows.length === 0) return 0;
    const today = new Date();
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // strip time
    // Monday-start week: get Monday of this week
    const day = d.getDay(); // 0=Sun..6=Sat
    const mondayOffset = day === 0 ? -6 : 1 - day; // if Sunday, go back 6 days
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    let sum = 0;
    for (const r of dailyRows) {
      const dateStr = r.Date ? String(r.Date).slice(0, 10) : '';
      if (!dateStr) continue;
      const dt = new Date(dateStr + 'T00:00:00');
      if (dt >= monday && dt <= d) {
        const p = Number(r.Progress);
        if (Number.isFinite(p)) sum += p;
      }
    }
    return Math.max(0, Math.round(sum));
  }, [dailyRows]);

  const computedDryFromLast = useMemo(() => {
    const day = Number(lastCompleteRow?.Day);
    return Number.isFinite(day) ? day : (selectedOp?.DryDays || 0);
  }, [lastCompleteRow, selectedOp]);

  // Operation Log preview (from last complete row)
  const opLogPreview = useMemo(() => {
    const raw = String(lastCompleteRow?.OperationLog || selectedOp?.OperationLog || '').trim();
    if (!raw) return { title: '', text: '' };
    const idx = raw.indexOf('\n');
    const title = (idx === -1 ? raw : raw.slice(0, idx)).trim();
    const rest = (idx === -1 ? '' : raw.slice(idx + 1)).trim();
    // First two sentences of rest
    const sentences = rest.split(/(?<=[.!?])\s+/).filter(Boolean);
    const preview = sentences.slice(0, 2).join(' ');
    return { title, text: preview };
  }, [lastCompleteRow, selectedOp]);

  // Custom tooltip for daily delta chart
  const renderDeltaTooltip = useCallback(({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0]?.payload || {};
    const d = Number(p.Day);
    const planned = Number.isFinite(p.PlannedDepth) ? p.PlannedDepth : null;
    const actual = Number.isFinite(p.ActualDepth) ? p.ActualDepth : null;
    const delta = Number.isFinite(p.delta) ? p.delta : null;
    return (
      <div style={{ background: '#0b1630', color: '#fff', border: '1px solid rgba(42,91,215,0.4)', padding: '8px 10px', borderRadius: 8 }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Day {d}</div>
        <div>Planned: {planned !== null ? planned : '—'}</div>
        <div>Actual: {actual !== null ? actual : '—'}</div>
        <div style={{ fontWeight: 700, marginTop: 4 }}>Δ: {delta !== null ? (delta > 0 ? '+' + delta : delta === 0 ? '=0' : delta) : '—'}</div>
      </div>
    );
  }, []);

  // Custom tooltip for the LineChart to show days ahead/behind plan
  const renderLineDepthTooltip = useCallback(({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    // Source values for this hovered x (day)
    const d = Number(label);
    // Find the actual depth from payload entries
    const actualEntry = payload.find(p => (p.dataKey || '').toLowerCase() === 'actualdepth');
    const plannedEntry = payload.find(p => (p.dataKey || '').toLowerCase() === 'planneddepth');
    const actual = Number.isFinite(Number(actualEntry?.value)) ? Number(actualEntry.value) : null;
    const plannedAtD = Number.isFinite(Number(plannedEntry?.value)) ? Number(plannedEntry.value) : null;
    // Build planned series for interpolation from the chart data
    const plannedSeries = (depthVsDays?.data || [])
      .filter(row => Number.isFinite(Number(row.Day)))
      .map(row => ({ Day: Number(row.Day), PlannedDepth: Number.isFinite(Number(row.PlannedDepth)) ? Number(row.PlannedDepth) : null }))
      .filter(row => row.PlannedDepth !== null)
      .sort((a,b) => a.Day - b.Day);

    const computePlannedDayForDepth = (series, targetDepth) => {
      if (!Number.isFinite(targetDepth) || !Array.isArray(series) || series.length === 0) return null;
      // If below first point
      if (targetDepth <= series[0].PlannedDepth) {
        if (series.length > 1) {
          const p0 = series[0].PlannedDepth, p1 = series[1].PlannedDepth;
          const d0 = series[0].Day, d1 = series[1].Day;
          if (p1 !== p0) {
            const t = (targetDepth - p0) / (p1 - p0);
            return d0 + Math.max(0, Math.min(1, t)) * (d1 - d0);
          }
        }
        return series[0].Day;
      }
      // Find first index where plan >= targetDepth
      for (let j = 1; j < series.length; j++) {
        const prev = series[j-1], curr = series[j];
        if (targetDepth <= curr.PlannedDepth) {
          const p0 = prev.PlannedDepth, p1 = curr.PlannedDepth;
          const d0 = prev.Day, d1 = curr.Day;
          if (p1 === p0) return d1; // plateau
          const t = (targetDepth - p0) / (p1 - p0);
          return d0 + t * (d1 - d0);
        }
      }
      // Above last plan — clamp to last day
      return series[series.length - 1].Day;
    };

    const dStar = computePlannedDayForDepth(plannedSeries, actual);
    const deltaDays = Number.isFinite(dStar) && Number.isFinite(d) ? (dStar - d) : null;
    const fmtDelta = (() => {
      if (!Number.isFinite(deltaDays)) return '—';
      const v = Math.round(deltaDays * 10) / 10; // 1 decimal
      if (v > 0) return `Ahead by ${v} day${Math.abs(v) === 1 ? '' : 's'}`;
      if (v < 0) return `Behind by ${Math.abs(v)} day${Math.abs(v) === 1 ? '' : 's'}`;
      return 'On plan';
    })();

    return (
      <div style={{ background: '#23234c', color: '#fff', border: '1px solid rgba(42,91,215,0.4)', padding: '10px 12px', borderRadius: 8 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Day {Number.isFinite(d) ? d : '—'}</div>
        <div>Planned: {Number.isFinite(plannedAtD) ? plannedAtD : '—'}</div>
        <div>Actual: {Number.isFinite(actual) ? actual : '—'}</div>
        <div style={{ fontWeight: 800, marginTop: 6 }}>{fmtDelta}</div>
      </div>
    );
  }, [depthVsDays]);

  // small helper to retry fetches (3 tries, exponential backoff)
  const fetchWithRetry = useCallback(async (url, options = {}, tries = 3, baseDelay = 400) => {
    let lastErr;
    for (let i = 0; i < tries; i++) {
      try {
    const res = await doFetch(url, options);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res;
      } catch (e) {
        lastErr = e;
        if (i < tries - 1) {
          const delay = baseDelay * Math.pow(2, i);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastErr || new Error('Fetch failed');
  }, [doFetch]);

  const loadOperations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithRetry(`${API_BASE}/drilling-operations`);
      const data = await res.json();
      setOperations(data);
    } catch (err) {
      setError(`Failed to fetch: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  }, [fetchWithRetry]);

  useEffect(() => { loadOperations(); }, [saving, loadOperations]);

  // If navigated here with a selected well in state, auto-select it
  useEffect(() => {
    const state = location && location.state;
    const name = state && state.selectWell;
    if (name && operations && operations.length > 0) {
      handleWellSelect(name);
    }
  }, [location, operations]);

  // Add GeneralNotes to editData when entering edit mode
  const handleEdit = useCallback(() => {
    setEditData({
      ...selectedOp,
      GeneralNotes: selectedOp.GeneralNotes || '',
  JUVPercent: selectedOp.JUVPercent || '',
      DrlgDays: selectedOp.DrlgDays || '',
      DryDays: selectedOp.DryDays || '',
      TestDays: selectedOp.TestDays || '',
      TestWODays: selectedOp.TestWODays || '',
      // Ensure fiscalYearPlans is initialized for editing
      fiscalYearPlans: selectedOp.fiscalYearPlans && selectedOp.fiscalYearPlans.length > 0
        ? [...selectedOp.fiscalYearPlans]
        : (selectedOp.FiscalYearPlans && selectedOp.FiscalYearPlans.length > 0
            ? [...selectedOp.FiscalYearPlans]
            : [])
    });
    setEditMode(true);
    setSaveError(null);
  }, [selectedOp]);

  const handleChange = useCallback((e) => {
    setEditData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }, []);

  const handleCancel = useCallback(() => {
    setEditMode(false);
    setEditData({});
    setSaveError(null);
  }, []);

  // Add GeneralNotes to the save payload
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    // Sanitize INT fields to avoid sending empty strings or undefined
    const sanitizeInt = val => (val === "" || val === null || val === undefined ? null : Number(val));
    const payload = {
      SrNo: sanitizeInt(editData.SrNo),
      SpudDate: editData.SpudDate || null,
      PresentDepthM: sanitizeInt(editData.PresentDepthM),
      TDM: sanitizeInt(editData.TDM),
      MDrld: editData.MDrld || null,
      OperationLog: editData.OperationLog || null,
      StopCard: sanitizeInt(editData.StopCard),
      GeneralNotes: editData.GeneralNotes || null,
  JUVPercent: (editData.JUVPercent || '').trim() === '' ? null : String(editData.JUVPercent),
      DrlgDays: sanitizeInt(editData.DrlgDays),
      DryDays: sanitizeInt(editData.DryDays),
      TestDays: sanitizeInt(editData.TestDays),
      TestWODays: sanitizeInt(editData.TestWODays)
    };
    try {
  const res = await doFetch(`${API_BASE}/drilling-operations/${selectedOp.DrillingOperationID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to save changes");
      setEditMode(false);
      setEditData({});
      setSaving(false);
      setSelectedWell(""); // Go back to all wells view
      setSelectedProvince("");
    } catch (err) {
      setSaveError(err.message);
      setSaving(false);
    }
  }, [selectedOp, editData]);

  const handleWellSelect = useCallback((wellName) => {
    setSelectedWell(wellName);
    setEditMode(false);
    setEditData({});
    if (wellName) {
      const selectedOperation = operations.find(op => op.WellName === wellName);
      if (selectedOperation) {
        let prov = getProvinceFromBlock(selectedOperation.BlockName);
        if (prov === "Unknown") {
          prov = getProvinceFromCoords(selectedOperation.Latitude, selectedOperation.Longitude);
        }
        setSelectedProvince(prov);
      }
    } else {
      setSelectedProvince("");
    }
  }, [operations, getProvinceFromBlock, getProvinceFromCoords]);

  // Inline editing functions
  const startEditing = useCallback((fieldName, currentValue) => {
    setEditingField(fieldName);
    // Preserve 0 for numeric fields by using nullish coalescing
    const val = currentValue ?? '';
    setEditingValue(val);
    setOriginalValue(val);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingField(null);
    setEditingValue('');
    setOriginalValue('');
  }, []);

  const confirmEdit = useCallback(async (fieldName, newValue = null) => {
    if (!selectedOp) return;
    
    try {
      // Use provided newValue or current editingValue
      const valueToSave = newValue !== null ? newValue : editingValue;
      
      // Prepare the payload with just the field being updated
      const integerFields = new Set(['StopCard', 'TestWODays']);
      const sanitizeValue = (val, type) => {
        if (type === 'number') {
          if (val === "" || val === null || val === undefined) return null;
          const n = Number(val);
          if (!Number.isFinite(n)) return null;
          return integerFields.has(fieldName) ? Math.trunc(n) : n;
        }
        if (type === 'date') {
          return val || null;
        }
        return val || null;
      };

      // Determine the data type for each field
      const fieldTypes = {
        'SpudDate': 'date',
        'StopCard': 'number',
        'MDrld': 'number',
        'PresentDepthM': 'number',
        'TDM': 'number',
        'DrlgDays': 'number',
        'DryDays': 'number',
        'TestDays': 'number',
        'TestWODays': 'number'
      };

      const fieldType = fieldTypes[fieldName] || 'text';
      const payload = { [fieldName]: sanitizeValue(valueToSave, fieldType) };
      // Include paired fields so backend doesn't overwrite with NULL
      if (fieldName === 'DryDays' || fieldName === 'TestWODays') {
        payload.DryDays = fieldName === 'DryDays' ? payload.DryDays ?? sanitizeValue(valueToSave, 'number') : sanitizeValue(selectedOp.DryDays, 'number');
        payload.TestWODays = fieldName === 'TestWODays' ? payload.TestWODays ?? sanitizeValue(valueToSave, 'number') : sanitizeValue(selectedOp.TestWODays, 'number');
      }
      if (fieldName === 'DrlgDays' || fieldName === 'TestDays') {
        payload.DrlgDays = fieldName === 'DrlgDays' ? payload.DrlgDays ?? sanitizeValue(valueToSave, 'number') : sanitizeValue(selectedOp.DrlgDays, 'number');
        payload.TestDays = fieldName === 'TestDays' ? payload.TestDays ?? sanitizeValue(valueToSave, 'number') : sanitizeValue(selectedOp.TestDays, 'number');
      }

  const res = await doFetch(`${API_BASE}/drilling-operations/${selectedOp.DrillingOperationID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        try {
          const errJson = await res.json();
          throw new Error(errJson?.detail || `Failed to save changes (${res.status})`);
        } catch {
          throw new Error(`Failed to save changes (${res.status})`);
        }
      }
      
      // Optimistically update local state so UI reflects the change immediately
      try {
        const updatedValue = payload[fieldName];
        setOperations(prev => prev.map(op => {
          if (op.DrillingOperationID !== selectedOp.DrillingOperationID) return op;
          const next = { ...op };
          // Straight field update
          next[fieldName] = updatedValue;
          // Keep paired fields in sync for ActualRigDays and AFEPlan views
          if (fieldName === 'DryDays' || fieldName === 'TestWODays') {
            next.DryDays = payload.DryDays ?? next.DryDays ?? null;
            next.TestWODays = payload.TestWODays ?? next.TestWODays ?? null;
          }
          if (fieldName === 'DrlgDays' || fieldName === 'TestDays') {
            next.DrlgDays = payload.DrlgDays ?? next.DrlgDays ?? null;
            next.TestDays = payload.TestDays ?? next.TestDays ?? null;
          }
          return next;
        }));
      } catch {}
      
  // Skip immediate global refresh to avoid reverting to stale data
      
      // Clear editing state
      cancelEditing();
      
    } catch (err) {
      console.error('Error saving field:', err);
      // Revert to original value on error
      setEditingValue(originalValue);
    }
  }, [selectedOp, editingValue, originalValue, cancelEditing]);

  // fetchHistory removed; backend history endpoints deprecated

  function getCurrentDateTimeString() {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  }

  function getFyQuarterData(fyPlans, quarter) {
    if (!Array.isArray(fyPlans)) return '';
    const plan = fyPlans.find(p => (p.quarter || p.qtr || p.QTR || '').toString().includes(quarter));
    if (!plan) return '';
    // Try to show well name and meters if available
    return `${plan.well || plan.name || plan.detail || plan.plan || plan.details || ''}${plan.meters ? ' ('+plan.meters+' M)' : ''}`;
  }

  // Helper to extract all plans for a given quarter as a formatted string
  function getAllFyQuarterData(fyPlans, quarter) {
    if (!Array.isArray(fyPlans)) return '';
    const plans = fyPlans.filter(p => {
      const q = (p.quarter || p.qtr || p.QTR || '').toString();
      return q.includes(quarter);
    });
    if (!plans.length) return '';
    // Format: WellDepth (bold if possible), PlanDetails (italic if possible), each plan on a new line
    return plans.map(plan => {
      let line = '';
      if (plan.WellDepth) line += plan.WellDepth; // PDF can't do per-line bold, so just plain text
      if (plan.PlanDetails) line += (line ? '\n' : '') + plan.PlanDetails; // PDF can't do per-line italic, so just plain text
      return line;
    }).join('\n');
  }

  function buildTableRows(operations) {
    return operations.map((op, idx) => {
      const fyPlans = op.fiscalYearPlans || op.FiscalYearPlans || [];
      return [
        idx + 1,
        op.RigNo || '',
        `${op.WellName || ''}\n${op.BlockName || ''}${op.SpudDate ? '\n(' + op.SpudDate.split('T')[0] + ')' : ''}`,
        op.PresentDepthM ? `${op.PresentDepthM} m${op.PresentDepthFt ? ' ('+op.PresentDepthFt+' ft)' : ''}` : '',
        `${op.DrlgDays || ''}\n${op.TestDays || ''}`,
        `${op.DryDays || ''}\n${op.TestWODays || ''}`,
        op.TDM || '',
        op.OperationLog || '',
        getFyQuarterData(fyPlans, '1'),
        getFyQuarterData(fyPlans, '2'),
        getFyQuarterData(fyPlans, '3'),
        getFyQuarterData(fyPlans, '4')
      ];
    });
  }

  function getTableColumns() {
    return [
      { title: 'Sr. #', dataKey: 'sr' },
      { title: 'Rig #', dataKey: 'rig' },
      { title: 'Well', dataKey: 'well' },
      { title: 'Present Depth (TD)', dataKey: 'depth' },
      { title: 'Planned Rig AFE Days\nDrig | Test', dataKey: 'planned' },
      { title: 'Actual Rig Days\nDry | Test/WO', dataKey: 'actual' },
      { title: 'Mtr Drld', dataKey: 'mtr' },
      { title: 'Operations During Last 24 Hrs', dataKey: 'ops' },
      { title: 'F.Y 2025-26\n1st QTR', dataKey: 'fy1' },
      { title: '2nd QTR', dataKey: 'fy2' },
      { title: '3rd QTR', dataKey: 'fy3' },
      { title: '4th QTR', dataKey: 'fy4' }
    ];
  }

  // Helper to extract shares info from OperationLog
  function extractShares(operationLog) {
    if (!operationLog) return '';
  // Look for a line with company shares (e.g., OGDC The Energy 65%, POL 25%, ...)
  // Support company names with spaces, mixed case, and symbols like & and . before the percentage
  const match = operationLog.match(/([A-Za-z&.()'\s]+\s*\d+%[\s,]*)+/);
    return match ? match[0].trim() : '';
  }

  // PDF Download Handler
  const handleDownloadPDF = async (mode = 'download') => {
    // Fetch all fiscal year plans for the year
    let fyPlansAll = [];
    try {
  const fyRes = await doFetch(`${API_BASE}/fiscal-year-plans-all?fy=2025-26`);
      if (fyRes.ok) {
        fyPlansAll = await fyRes.json();
      }
    } catch (e) {
      // fallback: leave fyPlansAll empty
    }
  const doc = new jsPDF({ orientation: 'landscape' });
    const dateStr = getCurrentDateTimeString();
    const title = `ORM DRILLING OPERATIONS ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}`;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 14);
    // Two-row header as in the screenshot
    const head = [
      [
        'Sr. #', 'Rig #', 'Well\nSpud date\nConcession\nState', 'Present Depth (TD) M',
        { content: 'Planned Rig AFE Days', colSpan: 2, styles: { halign: 'center', fillColor: [180, 198, 231] } },
        'Mtr Drld',
        { content: 'Actual Rig Days', colSpan: 2, styles: { halign: 'center', fillColor: [180, 198, 231] } },
        'Operations During Last 24 Hrs',
        'JUV Shares',
        'Stop Cards',
        { content: 'F.Y 2025-26', colSpan: 4, styles: { halign: 'center', fillColor: [255, 224, 178] } }
      ],
      [
        '', '', '', '', 'Drlg.', 'Test.', '', 'Dry', 'Test/WO', '', '', '', '1st QTR', '2nd QTR', '3rd QTR', '4th QTR'
      ]
    ];
    // Prefetch daily progress for all wells to derive runtime values
    const dailyMap = new Map();
    try {
      const all = await Promise.all(operations.map(async (op) => {
        if (!op?.WellID) return [op?.WellID, []];
        try {
          const r = await doFetch(`${API_BASE}/well-daily-progress?wellId=${encodeURIComponent(String(op.WellID))}`);
          if (!r.ok) throw new Error('x');
          const j = await r.json();
          return [op.WellID, Array.isArray(j) ? j : []];
        } catch { return [op.WellID, []]; }
      }));
      for (const [k, v] of all) dailyMap.set(k, v);
    } catch {}

    // Helper to derive values from Well Details
    const derive = (op) => {
      const rows = dailyMap.get(op.WellID) || [];
      const complete = rows
        .filter(r => r && r.OperationLog && String(r.OperationLog).trim().length > 0 && Number.isFinite(Number(r.ActualDepth)))
        .sort((a,b) => (Number(a.Day)||0) - (Number(b.Day)||0));
      const lastComplete = complete.length ? complete[complete.length - 1] : null;
      const numeric = rows
        .filter(r => Number.isFinite(Number(r.ActualDepth)))
        .sort((a,b) => (Number(a.Day)||0) - (Number(b.Day)||0));
      const lastNum = numeric.length ? numeric[numeric.length - 1] : null;
      const presentDepth = Number.isFinite(Number(lastNum?.ActualDepth)) ? Number(lastNum.ActualDepth) : (op.PresentDepthM ?? 0);
      const metersDrilled = Number.isFinite(Number(lastComplete?.Progress)) ? Number(lastComplete.Progress) : (Number.isFinite(Number(op.MDrld)) ? Number(op.MDrld) : 0);
      const opLog = (lastComplete?.OperationLog && String(lastComplete.OperationLog).trim().length > 0)
        ? String(lastComplete.OperationLog)
        : String(op.OperationLog || '');
      return { presentDepth, metersDrilled, opLog };
    };

    // Build rows
    const rows = [];
    operations.forEach((op, idx) => {
      // Find all plans for this well
      const wellPlans = fyPlansAll.filter(plan => plan.WellID === op.WellID);
      const getQ = q =>
        wellPlans
          .filter(plan => (plan.QTR || '').toLowerCase().includes(q.toLowerCase()))
          .map(plan => plan.WellName)
          .join(', ');
      // Build runtime values
      const { presentDepth, metersDrilled, opLog } = derive(op);
  // Build Operation Log cell (no appended JUV; separate column now)
  let operationLogCell = (opLog || '').split('\n').map((line, i) => i === 0 ? `**${line}**` : line).join('\n');
  const juvText = (op.JUVPercent || '').toString().trim();
      const mainRow = [
        idx + 1,
        op.RigNo || '',
        `${op.WellName || ''}\n${op.BlockName || ''}${op.SpudDate ? '\n(' + op.SpudDate.split('T')[0] + ')' : ''}`,
  presentDepth ? `${presentDepth}m${op.PresentDepthFt ? ' ('+op.PresentDepthFt+'ft)' : ''}` : '',
  op.DrlgDays || '',
  op.TestDays || '',
  metersDrilled || '',
  op.DryDays || '',
  op.TestWODays || '',
  operationLogCell,
  juvText,
  op.StopCard || '',
  getQ('1st QTR'), getQ('2nd QTR'), getQ('3rd QTR'), getQ('4th QTR')
      ];
      rows.push(mainRow);
      // No shares row
    });
    autoTable(doc, {
      head: head,
      body: rows,
      startY: 22,
      styles: { fontSize: 8, cellPadding: 2, valign: 'middle', lineColor: [44,62,80], lineWidth: 0.2 },
      headStyles: { fillColor: [135, 206, 235], textColor: 44, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        // Only define a narrow column for the new JUV Shares; leave all other widths unchanged
        10: { cellWidth: 22, fontSize: 7, overflow: 'linebreak', halign: 'left' }
      },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 9 && data.cell.raw) {
          const lines = String(data.cell.raw).split('\n');
          if (lines.length > 0) {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
    if (mode === 'view') {
      doc.output('dataurlnewwindow');
    } else {
      doc.save(`DrillingOperations_${dateStr}.pdf`);
    }
  };

  // Email PDF Handler
  const handleSendEmail = async () => {
    setEmailStatus('');
    setEmailLoading(true);
    try {
      // Fetch all fiscal year plans for the year (same as handleDownloadPDF)
      let fyPlansAll = [];
      try {
  const fyRes = await doFetch(`${API_BASE}/fiscal-year-plans-all?fy=2025-26`);
        if (fyRes.ok) {
          fyPlansAll = await fyRes.json();
        }
      } catch (e) {
        // fallback: leave fyPlansAll empty
      }
      const doc = new jsPDF({ orientation: 'landscape' });
      const dateStr = getCurrentDateTimeString();
      const title = `ORM DRILLING OPERATIONS ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}`;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 14, 14);
      const head = [
        [
          'Sr. #', 'Rig #', 'Well\nSpud date\nConcession\nState', 'Present Depth (TD) M',
          { content: 'Planned Rig AFE Days', colSpan: 2, styles: { halign: 'center', fillColor: [180, 198, 231] } },
          'Mtr Drld',
          { content: 'Actual Rig Days', colSpan: 2, styles: { halign: 'center', fillColor: [180, 198, 231] } },
          'Operations During Last 24 Hrs',
          'JUV Shares',
          'Stop Cards',
          { content: 'F.Y 2025-26', colSpan: 4, styles: { halign: 'center', fillColor: [255, 224, 178] } }
        ],
        [
          '', '', '', '', 'Drlg.', 'Test.', '', 'Dry', 'Test/WO', '', '', '', '1st QTR', '2nd QTR', '3rd QTR', '4th QTR'
        ]
      ];
      // Prefetch daily progress for all wells to derive runtime values
      const dailyMap = new Map();
      try {
        const all = await Promise.all(operations.map(async (op) => {
          if (!op?.WellID) return [op?.WellID, []];
          try {
            const r = await doFetch(`${API_BASE}/well-daily-progress?wellId=${encodeURIComponent(String(op.WellID))}`);
            if (!r.ok) throw new Error('x');
            const j = await r.json();
            return [op.WellID, Array.isArray(j) ? j : []];
          } catch { return [op.WellID, []]; }
        }));
        for (const [k, v] of all) dailyMap.set(k, v);
      } catch {}

      const derive = (op) => {
        const rows = dailyMap.get(op.WellID) || [];
        const complete = rows
          .filter(r => r && r.OperationLog && String(r.OperationLog).trim().length > 0 && Number.isFinite(Number(r.ActualDepth)))
          .sort((a,b) => (Number(a.Day)||0) - (Number(b.Day)||0));
        const lastComplete = complete.length ? complete[complete.length - 1] : null;
        const numeric = rows
          .filter(r => Number.isFinite(Number(r.ActualDepth)))
          .sort((a,b) => (Number(a.Day)||0) - (Number(b.Day)||0));
        const lastNum = numeric.length ? numeric[numeric.length - 1] : null;
        const presentDepth = Number.isFinite(Number(lastNum?.ActualDepth)) ? Number(lastNum.ActualDepth) : (op.PresentDepthM ?? 0);
        const metersDrilled = Number.isFinite(Number(lastComplete?.Progress)) ? Number(lastComplete.Progress) : (Number.isFinite(Number(op.MDrld)) ? Number(op.MDrld) : 0);
        const opLog = (lastComplete?.OperationLog && String(lastComplete.OperationLog).trim().length > 0)
          ? String(lastComplete.OperationLog)
          : String(op.OperationLog || '');
        return { presentDepth, metersDrilled, opLog };
      };

      const rows = [];
      operations.forEach((op, idx) => {
        // Find all plans for this well (same as handleDownloadPDF)
        const wellPlans = fyPlansAll.filter(plan => plan.WellID === op.WellID);
        const getQ = q =>
          wellPlans
            .filter(plan => (plan.QTR || '').toLowerCase().includes(q.toLowerCase()))
            .map(plan => plan.WellName)
            .join(', ');
        // Build runtime Operation Log cell; append JUV shares text (if any) after the log
        const { presentDepth, metersDrilled, opLog } = derive(op);
  let operationLogCell = (opLog || '').split('\n').map((line, i) => i === 0 ? `**${line}**` : line).join('\n');
  const juvText = (op.JUVPercent || '').toString().trim();
        const mainRow = [
          idx + 1,
          op.RigNo || '',
          `${op.WellName || ''}\n${op.BlockName || ''}${op.SpudDate ? '\n(' + op.SpudDate.split('T')[0] + ')' : ''}`,
          presentDepth ? `${presentDepth}m${op.PresentDepthFt ? ' ('+op.PresentDepthFt+'ft)' : ''}` : '',
          op.DrlgDays || '',
          op.TestDays || '',
          metersDrilled || '',
          op.DryDays || '',
          op.TestWODays || '',
          operationLogCell,
          juvText,
          op.StopCard || '',
          getQ('1st QTR'), getQ('2nd QTR'), getQ('3rd QTR'), getQ('4th QTR')
        ];
        rows.push(mainRow);
      });
      autoTable(doc, {
        head: head,
        body: rows,
        startY: 22,
        styles: { fontSize: 8, cellPadding: 2, valign: 'middle', lineColor: [44,62,80], lineWidth: 0.2 },
        headStyles: { fillColor: [44, 62, 80], textColor: 255, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          // Keep only the small JUV Shares column; don't change other widths
          10: { cellWidth: 22, fontSize: 7, overflow: 'linebreak', halign: 'left' }
        },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 9 && data.cell.raw) {
            const lines = data.cell.raw.split('\n');
            if (lines.length > 0) {
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });
      const pdfBlob = doc.output('blob');
      const formData = new FormData();
      formData.append('pdf', pdfBlob, `DrillingOperations_${dateStr}.pdf`);
      formData.append('to', 'zakinabeelalu@gmail.com');
      formData.append('subject', 'Drilling Operations Report');
      formData.append('body', 'Please find attached the latest drilling operations report.');
  const response = await doFetch(`${API_BASE}/send-drilling-report`, {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        setEmailStatus('Email sent successfully!');
      } else {
        setEmailStatus('Failed to send email.');
      }
    } catch (err) {
      setEmailStatus('Error sending email.');
    } finally {
      setEmailLoading(false);
    }
  };

  // Add New Well handler
  const handleAddNewWell = async (formData) => {
    try {
      const payload = { ...formData };
      // Convert numeric fields
      payload.Longitude = payload.Longitude ? Number(payload.Longitude) : null;
      payload.Latitude = payload.Latitude ? Number(payload.Latitude) : null;
      payload.TargetDepth = payload.TargetDepth ? Number(payload.TargetDepth) : null;
  payload.PlannedAFEDaysDrilling = payload.PlannedAFEDaysDrilling ? Number(payload.PlannedAFEDaysDrilling) : null;
  payload.PlannedAFEDaysTesting = payload.PlannedAFEDaysTesting ? Number(payload.PlannedAFEDaysTesting) : null;
  // Keep JUVPercent as text (immutable shares), trim blank to null
  payload.JUVPercent = (payload.JUVPercent || '').trim() === '' ? null : String(payload.JUVPercent);
  // Ensure required text fields are present
  payload.WellName = String(payload.WellName || '');
  payload.RigName = String(payload.RigName || '');
  payload.BlockName = String(payload.BlockName || '');
  payload.OperationLog = String(payload.OperationLog || '');
  payload.GeneralNotes = String(payload.GeneralNotes || '');
      
  const res = await doFetch(`${API_BASE}/drilling-operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let msg = 'Failed to add new well';
        try {
          const data = await res.json();
          if (data && data.detail) msg = data.detail;
        } catch {}
        throw new Error(msg);
      }
      setSaving(s => !s); // trigger refresh
    } catch (err) {
      throw new Error(err.message);
    }
  };

  // Delete Well handler
  const handleDeleteWell = async (drillingOperationId) => {
  if (!window.confirm('Are you sure you want to archive this well?')) return;
    setDeletingWellId(drillingOperationId);
    try {
  const res = await doFetch(`${API_BASE}/drilling-operations/${drillingOperationId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete well');
      setDeletingWellId(null);
      setSelectedWell("");
      setSaving(s => !s); // trigger refresh
    } catch (err) {
      setDeletingWellId(null);
      alert('Error deleting well: ' + err.message);
    }
  };

  const handleFetchPastWells = async () => {
    setPastWellsLoading(true);
    try {
  const res = await doFetch(`${API_BASE}/past-wells`);
      if (!res.ok) throw new Error('Failed to fetch past wells');
      const data = await res.json();
      setPastWells(data);
      setShowPastWellsModal(true);
    } catch (err) {
      alert('Error fetching past wells: ' + err.message);
    } finally {
      setPastWellsLoading(false);
    }
  };

  // Delete modal open/close helpers to reset selection state
  const openDeleteModal = useCallback(() => {
    setSelectedWellsToDelete([]);
    setDeleteSearch("");
    setDeleteError(null);
    setShowDeleteModal(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
    setSelectedWellsToDelete([]);
    setDeleteSearch("");
    setDeleteError(null);
  }, []);

  // Reusable EditableField component
  const EditableField = ({ fieldName, value, dataType = 'text', borderColor = '#2a5bd7', style = {} }) => {
    const isEditing = editingField === fieldName;
    const integerFields = new Set(['StopCard', 'TestWODays']);

    // Only for StopCard and TestWODays: show up/down buttons, auto-save on change
    if ((fieldName === 'StopCard' || fieldName === 'TestWODays') && isAdmin) {
      if (isEditing) {
        const handleChange = async (newValue) => {
          setEditingValue(newValue);
          await confirmEdit(fieldName, newValue);
        };
        return (
          <div style={{ background: '#0F1D3B', borderRadius: 8, padding: '12px 16px', border: `2px solid ${borderColor}`, width: '100%', textAlign: 'center', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <button
              style={{ background: '#23234c', color: '#fff', border: `1px solid ${borderColor}`, borderRadius: 4, width: 24, height: 24, fontSize: 18, cursor: 'pointer', marginRight: 6 }}
              onClick={() => handleChange(Math.max(0, Number(editingValue) - 1))}
              tabIndex={0}
              aria-label="Decrease"
            >
              –
            </button>
            <input
              type="number"
              value={editingValue}
              min={0}
              style={{ fontSize: style.fontSize || 22, fontWeight: 700, background: 'transparent', color: 'white', border: 'none', textAlign: 'center', width: 60, outline: 'none' }}
              onChange={e => handleChange(e.target.value)}
              autoFocus
            />
            <button
              style={{ background: '#23234c', color: '#fff', border: `1px solid ${borderColor}`, borderRadius: 4, width: 24, height: 24, fontSize: 18, cursor: 'pointer', marginLeft: 6 }}
              onClick={() => handleChange(Number(editingValue) + 1)}
              tabIndex={0}
              aria-label="Increase"
            >
              +
            </button>
          </div>
        );
      }
      // Not editing: click to edit
      return (
        <div
          style={{ background: '#0F1D3B', borderRadius: 8, padding: '12px 16px', border: `2px solid ${borderColor}`, width: '100%', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', ...style }}
          onClick={() => startEditing(fieldName, value)}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#64b5f6'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = borderColor; }}
          role="button"
          aria-label={`Edit ${fieldName}`}
          title="Click to edit"
        >
          <div style={{ fontSize: style.fontSize || 22, fontWeight: 700, lineHeight: 1, textAlign: 'center' }}>{value || '—'}</div>
          <div style={{ position: 'absolute', top: 6, right: 6, opacity: 0.85, color: '#9bb1ff', fontSize: 12 }}>✎</div>
        </div>
      );
    }

    // Default: fallback to old logic for other fields
    const handleClick = () => { if (!isEditing) startEditing(fieldName, value); };
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') confirmEdit(fieldName);
      else if (e.key === 'Escape') cancelEditing();
    };
    const inputProps = {
      type: dataType === 'number' ? 'number' : dataType === 'date' ? 'date' : 'text',
      step: dataType === 'number' ? (integerFields.has(fieldName) ? '1' : '0.01') : undefined,
      style: { fontSize: style.fontSize || 22, fontWeight: 700, background: 'transparent', color: 'white', border: 'none', textAlign: 'center', width: '100%', outline: 'none' },
      value: editingValue,
      onChange: (e) => setEditingValue(e.target.value),
      onKeyDown: handleKeyDown,
      autoFocus: true
    };
    if (isEditing) {
      return (
        <div style={{ background: '#0F1D3B', borderRadius: 8, padding: '12px 16px', border: `2px solid ${borderColor}`, width: '100%', textAlign: 'center', position: 'relative' }}>
          <input {...inputProps} />
        </div>
      );
    }
    return (
      <div
        style={{ background: '#0F1D3B', borderRadius: 8, padding: '12px 16px', border: `2px solid ${borderColor}`, width: '100%', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative', ...style }}
        onClick={handleClick}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#64b5f6'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = borderColor; }}
        role="button"
        aria-label={`Edit ${fieldName}`}
        title="Click to edit"
      >
        <div style={{ fontSize: style.fontSize || 22, fontWeight: 700, lineHeight: 1, textAlign: 'center' }}>
          {value || '—'}
        </div>
        <div style={{ position: 'absolute', top: 6, right: 6, opacity: 0.85, color: '#9bb1ff', fontSize: 12 }}>✎</div>
      </div>
    );
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <div className="loading-spinner"></div>
      <div style={{ marginTop: '16px', color: 'white', fontSize: '18px' }}>Loading drilling operations...</div>
    </div>
  );
  
  if (error) return (
    <div style={{color: '#ff6b6b', textAlign: 'center', padding: '20px', background: 'rgba(255,107,107,0.1)', borderRadius: '8px'}}>
      <div style={{ marginBottom: 10 }}>Error: {error}</div>
      <button className="action-button button-primary" onClick={loadOperations}>Retry</button>
    </div>
  );

  return (
    <div className="dashboard-container" style={{ paddingTop: 12 }}>
      <SiteHeader title="Drilling Operations Dashboard" />
      <div className="button-panel" style={{ border: '1px solid rgba(255,255,255,0.15)', background: '#0b1630' }}>
        <button
          className="action-button button-pink"
          onClick={() => navigate('/')}
          title="Back to Landing"
          style={{ order: -1 }}
        >
          ← Back
        </button>
        {isAdmin && (
          <button
            className="action-button button-success"
            onClick={() => setShowAddModal(true)}
          >
            + Add New Well
          </button>
        )}
        {isAdmin && (
          <button
            className="action-button button-danger"
            onClick={openDeleteModal}
          >
            Archive Well
          </button>
        )}
        {isAdmin && (
          <button
            className="action-button button-warning"
            onClick={handleFetchPastWells}
            disabled={pastWellsLoading}
          >
            {pastWellsLoading ? 'Loading...' : 'Past Wells'}
          </button>
        )}
        {isAdmin && (
          <button
            className="action-button button-purple"
            onClick={() => navigate('/slideshow')}
          >
            View All Wells Slideshow
          </button>
        )}
        {isAdmin && (
          <button
            className="action-button button-warning"
            onClick={() => setShowRigFyEditor(true)}
            title="Edit F.Y plans rig-wise"
          >
            Rig-wise F.Y Editor
          </button>
        )}
        {isAdmin && (
          <div style={{ position: 'relative' }}>
            <button 
              className="action-button button-primary"
              onClick={() => setDownloadOpen(o => !o)}
              title="Download options"
              aria-haspopup="menu"
              aria-expanded={downloadOpen}
            >
              Download ▾
            </button>
            {downloadOpen && (
              <div role="menu" style={{ position: 'absolute', top: '100%', right: 0, background: '#0b1630', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, minWidth: 190, padding: 6, zIndex: 5, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
                <button
                  role="menuitem"
                  onClick={() => { setDownloadOpen(false); handleDownloadPDF('view'); }}
                  style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#fff', padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  View
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setDownloadOpen(false); handleDownloadPDF('download'); }}
                  style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#fff', padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Download as PDF
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      
      <WellSelector wells={wells} selectedWell={selectedWell} onSelect={handleWellSelect} />

      {/* Show all wells with status if no well is selected */}
      {!selectedWell && operations.length > 0 && (
        <>
          <div className="well-grid">
            {operations.map(op => (
              <div key={op.WellName} style={{ position: 'relative' }}>
                <WellSummaryCard op={op} onSelect={handleWellSelect} />
              </div>
            ))}
          </div>
          {/* Carousel of Pie Charts for all wells - Admin Only */}
          {isAdmin && (
            <div style={{ margin: '48px 0 0 0', width: '100%', textAlign: 'center' }}>
              <Slider
                dots={false}
                infinite={true}
                speed={500}
                slidesToShow={3}
                slidesToScroll={1}
                autoplay={true}
                autoplaySpeed={2000}
                arrows={false}
                pauseOnHover={true}
                responsive={[
                  { breakpoint: 1200, settings: { slidesToShow: 2 } },
                  { breakpoint: 800, settings: { slidesToShow: 1 } }
                ]}
              >
                {operations.map((well) => (
                  <div key={well.DrillingOperationID} style={{ textAlign: 'center' }}>
                    <WellPieChartBox well={well} />
                  </div>
                ))}
              </Slider>
            </div>
          )}

          {/* General Notes Box - Main Dashboard - Admin Only */}
          {isAdmin && (
            <div className="general-notes-box">
              <h3>General Notes</h3>
              <div>
                <div style={{ marginBottom: '8px' }}>Target: 2025-26: 16 Wells (Spudded: 4, Exp: 3, Dev: 0, S/T/R/E: 00, W/O: 8, P&A: 1)</div>
                <div style={{ marginBottom: '8px' }}>Meter Drilled in F.Y 2025-26: Since July 01, 2024 = 21753 M, In march, 2025 = 1906 M.</div>
                <div>Note:- Rig N-1 stacked at location# Rajian-7 & under technical assessment</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Province Image and Well Location Map Side by Side */}
      {selectedOp && (
        <div style={{ display: 'flex', gap: 32, marginBottom: 24, justifyContent: 'center', alignItems: 'center', maxWidth: '1200px', margin: '0 auto 24px auto' }}>
          <div style={{ 
            background: '#0e1b33', 
            borderRadius: 16, 
            padding: 20, 
            boxShadow: '0 8px 24px rgba(35, 35, 76, 0.3)',
            border: '2px solid rgba(0, 150, 136, 0.6)',
            flex: 1,
            transition: 'all 0.3s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 150, 136, 0.4)';
            e.currentTarget.style.borderColor = 'rgba(0, 150, 136, 0.8)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(35, 35, 76, 0.3)';
            e.currentTarget.style.borderColor = 'rgba(0, 150, 136, 0.6)';
          }}
          >
            <div style={{
              background: 'linear-gradient(135deg, rgba(0, 150, 136, 0.3) 0%, rgba(0, 188, 212, 0.2) 100%)',
              borderRadius: 12,
              padding: 16,
              border: '2px solid rgba(0, 150, 136, 0.4)'
            }}>
              <ProvinceImage province={selectedProvince} />
            </div>
          </div>
          <div style={{ 
            background: '#0e1b33', 
            borderRadius: 16, 
            padding: 20, 
            boxShadow: '0 8px 24px rgba(35, 35, 76, 0.3)',
            border: '2px solid rgba(211, 47, 47, 0.6)',
            flex: 1,
            transition: 'all 0.3s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-5px)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(211, 47, 47, 0.4)';
            e.currentTarget.style.borderColor = 'rgba(211, 47, 47, 0.8)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(35, 35, 76, 0.3)';
            e.currentTarget.style.borderColor = 'rgba(211, 47, 47, 0.6)';
          }}
          >
            <div style={{
              background: 'linear-gradient(135deg, rgba(211, 47, 47, 0.3) 0%, rgba(255, 87, 34, 0.2) 100%)',
              borderRadius: 12,
              padding: 16,
              border: '2px solid rgba(211, 47, 47, 0.4)'
            }}>
              <WellMap latitude={selectedOp.Latitude} longitude={selectedOp.Longitude} wellName={selectedOp.WellName} blockName={selectedOp.BlockName} />
            </div>
          </div>
        </div>
      )}

      {selectedOp && (
        <div className="professional-card" style={{ padding: 24, marginBottom: 32, position: 'relative', maxWidth: '1200px', margin: '0 auto 32px auto', background: '#0F1D3B', borderRadius: 16, boxShadow: '0 8px 32px rgba(25, 118, 210, 0.10)', border: '1px solid #2a5bd7' }}>
          {/* Back Button */}
          <div style={{ marginBottom: 16, textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => handleWellSelect("")}
              className="action-button button-danger"
              style={{
                marginBottom: 8,
                transition: 'background 0.2s, color 0.2s',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: 700,
                minWidth: '200px',
                height: '52px'
              }}
            >
              ← Back to All Wells
            </button>
            <button
              onClick={() => navigate(`/well-details?wellId=${selectedOp.WellID}&wellName=${encodeURIComponent(selectedOp.WellName)}`)}
              style={{
                background: 'linear-gradient(140deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#ffffff',
                border: '2px solid #3b82f6',
                padding: '12px 24px',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: '16px',
                cursor: 'pointer',
                marginBottom: 24,
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                minWidth: '200px',
                height: '52px'
              }}
              onMouseEnter={e => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.6)';
              }}
              onMouseLeave={e => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.4)';
              }}
            >
              View Details
            </button>
          </div>

          {/* Header Section with Logo and Well Info */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 24, flexDirection: 'column', textAlign: 'center' }}>
            {/* Company Logo */}
            <div style={{ 
              width: 120, 
              height: 120, 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(25, 118, 210, 0.3)',
              overflow: 'hidden',
              marginBottom: 24
            }}>
              <img 
                src="/images/landing/new%20logo.png" 
                alt="Company Logo" 
                style={{ width: '96%', height: '96%', objectFit: 'contain', display: 'block' }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div style={{ 
                display: 'none', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#1976d2',
                fontSize: 10,
                textAlign: 'center',
                fontWeight: 'bold',
                padding: '8px'
              }}>
                GAS DEVELOPMENT<br />COMPANY ENERGY<br />OIL & GAS
              </div>
            </div>

            {/* Well Identification - Simple Header */}
            <div style={{ 
              width: '100%', 
              textAlign: 'center',
              marginBottom: 32
            }}>
              {/* Main Well Name */}
              <h1 style={{ 
                margin: '0 0 20px 0', 
                fontSize: '42px', 
                fontWeight: 900, 
                color: '#ffffff',
                textDecoration: 'underline',
                textDecorationColor: '#3b82f6',
                textDecorationThickness: '3px',
                textUnderlineOffset: '8px',
                letterSpacing: '1px'
              }}>
                {selectedOp.WellName}
              </h1>
              
              {/* Rig and Block Information */}
              <div style={{ 
                display: 'flex', 
                gap: 32, 
                justifyContent: 'center', 
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: 40
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ 
                    fontSize: '18px', 
                    fontWeight: 700, 
                    color: '#60a5fa',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>RIG:</span>
                  <span style={{ 
                    padding: '8px 16px', 
                    background: 'rgba(59, 130, 246, 0.2)', 
                    borderRadius: 8, 
                    border: '2px solid #3b82f6', 
                    color: '#ffffff', 
                    fontSize: '18px', 
                    fontWeight: 700,
                    textDecoration: 'underline',
                    textDecorationColor: '#60a5fa'
                  }}>
                    {selectedOp.RigNo}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ 
                    fontSize: '18px', 
                    fontWeight: 700, 
                    color: '#34d399',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>BLOCK:</span>
                  <span style={{ 
                    padding: '8px 16px', 
                    background: 'rgba(52, 211, 153, 0.2)', 
                    borderRadius: 8, 
                    border: '2px solid #10b981', 
                    fontSize: '18px', 
                    fontWeight: 700, 
                    color: '#ffffff',
                    textDecoration: 'underline',
                    textDecorationColor: '#34d399'
                  }}>
                    {selectedOp.BlockName}
                  </span>
                </div>
              </div>

              {/* Drilling Progress Data - Modern Grouped Style */}
              {/* Top Row: Spud Date, Stop Cards, Meters Drilled, Weekly */}
              <div style={{ display: 'flex', gap: 24, marginBottom: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
                {/* Spud Date (static field style) */}
                <div style={{ flex: 1, background: '#23234c', color: 'white', borderRadius: 12, padding: '12px', minWidth: 200, minHeight: 90, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(42,91,215,0.4)' }}>
                  <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '6px', color: '#fff' }}>Spud Date</div>
                  <div style={{ background: '#1a4e4a', borderRadius: 8, padding: 8, textAlign: 'center', border: 'none', width: '100%' }}>
                    <div style={{ 
                      background: '#0F1D3B', 
                      borderRadius: 6, 
                      padding: '8px 12px', 
                      border: '2px solid #1a4e4a',
                      fontSize: 18, 
                      fontWeight: 700, 
                      color: 'white',
                      textAlign: 'center'
                    }}>
                      {selectedOp.SpudDate ? selectedOp.SpudDate.split('T')[0] : '—'}
                    </div>
                  </div>
                </div>

        {/* STOP CARDS (editable) */}
                <div style={{ flex: 1, background: '#23234c', color: 'white', borderRadius: 12, padding: '12px', minWidth: 200, minHeight: 90, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(42,91,215,0.4)' }}>
                  <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '6px', color: '#fff' }}>STOP CARDS</div>
                  <div style={{ background: '#4a1a1a', borderRadius: 8, padding: 8, textAlign: 'center', border: 'none', width: '100%' }}>
          {isAdmin ? (
            <EditableField fieldName="StopCard" value={selectedOp.StopCard || 0} dataType="number" borderColor="#d32f2f" style={{ fontSize: 18 }} />
          ) : (
            <div style={{ background: '#0F1D3B', borderRadius: 6, padding: '8px 12px', border: '2px solid #d32f2f', fontSize: 18, fontWeight: 700 }}>{selectedOp.StopCard || 0}</div>
          )}
                  </div>
                </div>

        {/* Meters Drilled (derived from last edited row's Progress) */}
                <div style={{ flex: 1, background: '#23234c', color: 'white', borderRadius: 12, padding: '12px', minWidth: 200, minHeight: 90, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(42,91,215,0.4)' }}>
                  <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '6px', color: '#fff' }}>Meters Drilled</div>
                  <div style={{ background: '#1a4a4a', borderRadius: 8, padding: 8, textAlign: 'center', border: 'none', width: '100%' }}>
                    <div style={{ 
                      background: '#0F1D3B', 
                      borderRadius: 6, 
                      padding: '8px 12px', 
                      border: '2px solid #00acc1',
                      fontSize: 18, 
                      fontWeight: 700, 
                      color: 'white',
                      textAlign: 'center'
                    }}>
          {computedMetersDrilled}
                    </div>
                  </div>
                </div>

        {/* Weekly (sum of Progress since Monday, resets weekly) */}
                <div style={{ flex: 1, background: '#23234c', color: 'white', borderRadius: 12, padding: '12px', minWidth: 200, minHeight: 90, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(42,91,215,0.4)' }}>
                  <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '6px', color: '#fff' }}>Weekly</div>
                  <div style={{ background: '#4a3a1a', borderRadius: 8, padding: 8, textAlign: 'center', border: 'none', width: '100%' }}>
                    <div style={{ 
                      background: '#0F1D3B', 
                      borderRadius: 6, 
                      padding: '8px 12px', 
                      border: '2px solid #795548',
                      fontSize: 18, 
                      fontWeight: 700, 
                      color: 'white',
                      textAlign: 'center'
                    }}>
          {computedWeeklyProgress}
                    </div>
                  </div>
                </div>
              </div>

              {/* Second Row: Target Depth M vs Present Depth M (static) */}
              <div style={{ display: 'flex', gap: 24, marginBottom: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, background: '#23234c', color: '#fff', borderRadius: 12, padding: 20, minHeight: '140px', boxShadow: '0 4px 16px rgba(25, 118, 210, 0.10)', border: '1px solid rgba(42,91,215,0.4)', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', minWidth: 600, textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#fff', background: 'transparent', padding: 0, borderRadius: 0, fontSize: '22px', fontWeight: 800, letterSpacing: 0.5, textAlign: 'center' }}>Target Depth M vs Present Depth M</h4>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <div style={{ flex: 1, background: '#4a1a3a', borderRadius: 8, padding: 12, textAlign: 'center', border: 'none' }}>
                      <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: '#fff' }}>Target Depth M</div>
                      <div style={{ background: '#0F1D3B', borderRadius: 6, padding: '8px 12px', border: '2px solid #e91e63' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, textAlign: 'center', color: 'white' }}>
                          {selectedOp.TDM || 0}
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, background: '#1a3a4a', borderRadius: 8, padding: 12, textAlign: 'center', border: 'none' }}>
                      <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: '#fff' }}>Present Depth M</div>
                      <div style={{ background: '#0F1D3B', borderRadius: 6, padding: '8px 12px', border: '2px solid #00bcd4' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, textAlign: 'center', color: 'white' }}>
                          {computedPresentDepth}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Planned vs Dry and Test vs Test W/O Section */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* Drilling Plan vs Dry */}
            <div style={{ flex: 1, background: '#23234c', color: '#fff', borderRadius: 12, padding: 20, minHeight: '140px', boxShadow: '0 4px 16px rgba(25, 118, 210, 0.10)', border: '1px solid rgba(42,91,215,0.4)', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', minWidth: 300, textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#fff', background: 'transparent', padding: 0, borderRadius: 0, fontSize: '22px', fontWeight: 800, letterSpacing: 0.5, textAlign: 'center' }}>Drlg Plan vs Dry (Days)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <div style={{ background: '#2a4a1a', borderRadius: 8, padding: 12, textAlign: 'center', border: 'none', width: '100%' }}>
                  <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: '#fff' }}>Drlg Plan</div>
                  <div style={{ background: '#0F1D3B', borderRadius: 6, padding: '8px 12px', border: '2px solid #8bc34a' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, textAlign: 'center', color: 'white' }}>
                      {selectedOp.DrlgDays || 0}
                    </div>
                  </div>
                </div>
                <div style={{ background: '#4a2a1a', borderRadius: 8, padding: 12, textAlign: 'center', border: 'none', width: '100%' }}>
          <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: '#fff' }}>Dry</div>
                  <div style={{ background: '#0F1D3B', borderRadius: 6, padding: '8px 12px', border: '2px solid #ff5722' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, textAlign: 'center', color: 'white' }}>
            {computedDryFromLast}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Test vs Test W/O */}
            <div style={{ flex: 1, background: '#23234c', color: '#fff', borderRadius: 12, padding: 20, minHeight: '140px', boxShadow: '0 4px 16px rgba(25, 118, 210, 0.10)', border: '1px solid rgba(42,91,215,0.4)', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', minWidth: 300, textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#fff', background: 'transparent', padding: 0, borderRadius: 0, fontSize: '22px', fontWeight: 800, letterSpacing: 0.5, textAlign: 'center' }}>Test vs Test W/O (Days)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <div style={{ background: '#2a1a4a', borderRadius: 8, padding: 12, textAlign: 'center', border: 'none', width: '100%' }}>
                  <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: '#fff' }}>Test Plan</div>
                  <div style={{ background: '#0F1D3B', borderRadius: 6, padding: '8px 12px', border: '2px solid #673ab7' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, textAlign: 'center', color: 'white' }}>
                      {selectedOp.TestDays || 0}
                    </div>
                  </div>
                </div>
                <div style={{ background: '#3a2a1a', borderRadius: 8, padding: 12, textAlign: 'center', border: 'none', width: '100%' }}>
                  <div style={{ fontWeight: 800, fontSize: '18px', marginBottom: '8px', color: '#fff' }}>Test W/O</div>
                  {isAdmin ? (
                    <EditableField fieldName="TestWODays" value={selectedOp.TestWODays || 0} dataType="number" borderColor="#795548" style={{ fontSize: 18 }} />
                  ) : (
                    <div style={{ background: '#0F1D3B', borderRadius: 6, padding: '8px 12px', border: '2px solid #795548', fontSize: 18, fontWeight: 700 }}>{selectedOp.TestWODays || 0}</div>
                  )}
                </div>
              </div>
            </div>
            {/* Day Insights card */}
            <div style={{ flex: 1, background: '#23234c', color: '#fff', borderRadius: 12, padding: 20, minHeight: '140px', boxShadow: '0 4px 16px rgba(25, 118, 210, 0.10)', border: '1px solid rgba(42,91,215,0.4)', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', minWidth: 300, textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#fff', background: 'transparent', padding: 0, borderRadius: 0, fontSize: '22px', fontWeight: 800, letterSpacing: 0.5, textAlign: 'center' }}>Day Insights</h4>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                <label htmlFor="insight-day" style={{ fontWeight: 800 }}>Day</label>
                <input id="insight-day" type="number" min={1} max={Math.max(depthVsDays.maxDay || 1, 1)} value={insightDay}
                  onChange={e => setInsightDay(Math.max(1, Math.min(Number(e.target.value)||1, Math.max(depthVsDays.maxDay||1,1))))}
                  style={{ width: 90, background: '#0F1D3B', color: '#fff', border: '1px solid #2a5bd7', borderRadius: 8, padding: '6px 10px', textAlign: 'center', fontWeight: 800 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'left' }}>
                <div style={{ background: '#0F1D3B', borderRadius: 8, padding: 10, border: '1px solid rgba(42,91,215,0.3)' }}>
                  <div style={{ fontSize: 12, color: '#9bb1ff' }}>Planned Depth</div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{dayInsights.planned !== null ? `${dayInsights.planned} m` : '—'}</div>
                </div>
                <div style={{ background: '#0F1D3B', borderRadius: 8, padding: 10, border: '1px solid rgba(42,91,215,0.3)' }}>
                  <div style={{ fontSize: 12, color: '#9bb1ff' }}>Actual Depth</div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{dayInsights.actual !== null ? `${dayInsights.actual} m` : '—'}</div>
                </div>
                <div style={{ background: '#0F1D3B', borderRadius: 8, padding: 10, border: '1px solid rgba(42,91,215,0.3)' }}>
                  <div style={{ fontSize: 12, color: '#9bb1ff' }}>Δ Meters (A − P)</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: (dayInsights.deltaMeters ?? 0) >= 0 ? '#43ea7f' : '#ff6b6b' }}>{dayInsights.deltaMeters !== null ? `${dayInsights.deltaMeters}` : '—'}</div>
                </div>
                <div style={{ background: '#0F1D3B', borderRadius: 8, padding: 10, border: '1px solid rgba(42,91,215,0.3)' }}>
                  <div style={{ fontSize: 12, color: '#9bb1ff' }}>Ahead/Behind (days)</div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>
                    {Number.isFinite(dayInsights.deltaDays) ? (
                      dayInsights.deltaDays > 0 ? `Ahead by ${Math.round(dayInsights.deltaDays * 10) / 10}` : (
                        dayInsights.deltaDays < 0 ? `Behind by ${Math.round(Math.abs(dayInsights.deltaDays) * 10) / 10}` : 'On plan'
                      )
                    ) : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Operation Log preview (from last completed Well Details row) */}
          <div style={{ marginBottom: 24, marginTop: 24, textAlign: 'center' }}>
            <div style={{ 
              background: '#23234c', color: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 4px 16px rgba(25, 118, 210, 0.10)', border: '1px solid rgba(42,91,215,0.4)', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#fff', background: 'transparent', padding: 0, borderRadius: 0, fontSize: '24px', fontWeight: 900, letterSpacing: 0.5, textAlign: 'center' }}>Operation Log</h4>
              <button
                onClick={() => navigate(`/well-details?wellId=${selectedOp.WellID}&wellName=${encodeURIComponent(selectedOp.WellName)}`)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: 0
                }}
                title="Open Well Details to view full Operation Log"
              >
                <div style={{
                  lineHeight: 1.6,
                  fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
                  background: 'transparent',
                  padding: 0,
                  borderRadius: 0,
                  border: 'none',
                  minHeight: '140px',
                  textAlign: 'center'
                }}>
                  {opLogPreview.title && (
                    <div style={{ fontWeight: 900, textDecoration: 'underline', fontSize: 20, marginBottom: 6 }}>
                      {opLogPreview.title}
                    </div>
                  )}
                  <div style={{ fontSize: 16, color: '#e8ecff' }}>
                    {opLogPreview.text || 'No operation log available.'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* New Full-Width Depth vs Days Chart below Operation Log */}
      <div style={{ margin: '24px auto 40px auto', maxWidth: '1200px' }}>
            <div style={{ background: '#23234c', borderRadius: 12, padding: 20, boxShadow: '0 4px 16px rgba(25,118,210,0.1)', border: '1px solid rgba(42,91,215,0.4)' }}>
  <h4 style={{ color: '#fff', margin: '0 0 12px 0', fontWeight: 800, fontSize: 20, textAlign: 'center' }}>Planned vs Actual Depth over Days</h4>
              <div style={{ width: '100%', height: 480 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={depthVsDays.data} margin={{ top: 10, right: 20, left: 10, bottom: 80 }}>
                    <CartesianGrid stroke="#314268" strokeDasharray="3 3" />
        <XAxis dataKey="Day" stroke="#fff" tick={{ fill: '#fff', fontSize: 12 }} label={{ value: 'Day', position: 'bottom', offset: 24, fill: '#fff' }} domain={[1, Math.max(depthVsDays.maxDay || 1, 1)]} type="number" allowDecimals={false} />
                    <YAxis stroke="#fff" tick={{ fill: '#fff', fontSize: 12 }} label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', fill: '#fff' }}
                      domain={[0, (selectedOp?.TDM || 0) + 100]}
                      allowDecimals={false}
                      reversed={true}
                      type="number"
                    />
                    <Tooltip content={renderLineDepthTooltip} />
          <Line type="monotone" dataKey="PlannedDepth" name="Planned Depth" stroke="#64b5f6" strokeWidth={3} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="ActualDepth" name="Actual Depth" stroke="#ff8a80" strokeWidth={3} dot={{ r: 3 }} connectNulls />
                    <Brush dataKey="Day" height={28} stroke="#64b5f6" travellerWidth={12} fill="rgba(100,181,246,0.18)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Bottom legend for line colors to match delta chart style */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, height: 4, background: '#ff8a80', borderRadius: 2, display: 'inline-block' }}></span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>Actual Depth</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 18, height: 4, background: '#64b5f6', borderRadius: 2, display: 'inline-block' }}></span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>Planned Depth</span>
                </div>
              </div>
              
            </div>
          </div>

          {/* Daily Delta Bar Chart: (Actual - Planned) per Day */}
          <div style={{ margin: '0 auto 40px auto', maxWidth: '1200px' }}>
            <div style={{ background: '#23234c', borderRadius: 12, padding: 20, boxShadow: '0 4px 16px rgba(25,118,210,0.1)', border: '1px solid rgba(42,91,215,0.4)' }}>
              <h4 style={{ color: '#fff', margin: '0 0 12px 0', fontWeight: 800, fontSize: 20, textAlign: 'center' }}>Daily Delta (Actual − Planned)</h4>
              <div style={{ width: '100%', height: 480 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyDelta.data} margin={{ top: 10, right: 20, left: 20, bottom: 80 }}>
                    <CartesianGrid stroke="#314268" strokeDasharray="3 3" />
                    <XAxis dataKey="Day" type="number" stroke="#fff" tick={{ fill: '#fff', fontSize: 12 }} allowDecimals={false} domain={[1, Math.max(depthVsDays.maxDay || 1, 1)]} label={{ value: 'Day', position: 'bottom', offset: 24, fill: '#fff' }} />
                    <YAxis type="number" stroke="#fff" tick={{ fill: '#fff', fontSize: 12 }} label={{ value: 'Meters (Δ Actual − Planned)', angle: -90, position: 'insideLeft', fill: '#fff' }} domain={[-(dailyDelta.maxAbs + 10), dailyDelta.maxAbs + 10]} />
                    <Tooltip content={renderDeltaTooltip} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar dataKey="delta" name="Δ (Actual − Planned)" radius={[4,4,0,0]}>
                      {
                        dailyDelta.data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.delta >= 0 ? '#43ea7f' : '#ff6b6b'} />
                        ))
                      }
                    </Bar>
                    <Brush dataKey="Day" height={28} stroke="#64b5f6" travellerWidth={12} fill="rgba(100,181,246,0.18)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Bottom legend for color meaning */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, background: '#43ea7f', borderRadius: 2, display: 'inline-block', border: '1px solid rgba(255,255,255,0.2)' }}></span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>Above Plan (+)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, background: '#ff6b6b', borderRadius: 2, display: 'inline-block', border: '1px solid rgba(255,255,255,0.2)' }}></span>
                  <span style={{ color: '#fff', fontWeight: 700 }}>Below Plan (−)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Visualization Section (Frontend-only, using recharts) */}
          <div style={{ margin: '40px 0', display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
            <WellCharts
              pieChartData={pieChartData}
              barChartData={barChartData}
              testBarChartData={testBarChartData}
            />
          </div>

          {/* Fiscal Year Planning removed here; use Rig-wise F.Y Editor from the top button */}

          {/* General Notes and JUV Shares (editable in Edit mode) */}
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <div style={{ background: '#23234c', color: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 4px 16px rgba(25, 118, 210, 0.10)', border: '1px solid rgba(42,91,215,0.4)', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', textAlign: 'left', maxWidth: '1200px', margin: '0 auto' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: 20, fontWeight: 800 }}>General Notes</h4>
              {editMode ? (
                <textarea
                  value={editData.GeneralNotes || ''}
                  onChange={(e) => setEditData(prev => ({ ...prev, GeneralNotes: e.target.value }))}
                  placeholder="Enter general notes for this well…"
                  style={{ width: '100%', minHeight: 110, resize: 'vertical', background: '#0b1530', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: 12, lineHeight: 1.4, marginBottom: 16 }}
                />
              ) : (
                <div style={{ whiteSpace: 'pre-line', background: '#0b1530', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#e8ecff', minHeight: 60, marginBottom: 16 }}>
                  {selectedOp?.GeneralNotes ? selectedOp.GeneralNotes : '—'}
                </div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: 18, fontWeight: 800 }}>JUV Shares</h4>
                </div>
                {editMode ? (
                  <textarea
                    value={editData.JUVPercent || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, JUVPercent: e.target.value }))}
                    placeholder="Enter JUV shares (one per line: Company: value%)"
                    style={{ width: '100%', minHeight: 100, resize: 'vertical', background: '#0b1530', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: 12, lineHeight: 1.4 }}
                  />
                ) : (
                  <div style={{ whiteSpace: 'pre-line', background: '#0b1530', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#e8ecff', minHeight: 60 }}>
                    {selectedOp?.JUVPercent ? String(selectedOp.JUVPercent) : '—'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Edit Button or Save/Cancel + View History Button */}
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            {editMode ? (
              <>
                <button 
                  className="action-button button-primary"
                  onClick={handleSave} 
                  style={{ marginRight: 16 }}
                >
                  Update
                </button>
                <button 
                  className="action-button button-danger"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                {saveError && <div style={{ color: '#ff8a80', marginTop: 12, textAlign: 'center' }}>{saveError}</div>}
              </>
            ) : (
              <>
                {isAdmin && (
                  <button 
                    className="action-button button-success"
                    onClick={handleEdit}
                  >
                    Edit Well Data
                  </button>
                )}
                {/* History feature removed */}
              </>
            )}
          </div>
        </div>
      )}
      {/* Add New Well Modal */}
      {showAddModal && (
        <AddWellModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddNewWell}
        />
      )}
      {/* Rig-wise Fiscal Year Editor Modal */}
      {showRigFyEditor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0F1D3B', color: '#fff', padding: 24, borderRadius: 16, minWidth: 900, maxWidth: '95vw', maxHeight: '90vh', boxShadow: '0 8px 32px rgba(25, 118, 210, 0.25)', border: '1px solid #2a5bd7', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, color: '#ffd54f' }}>Rig-wise F.Y 2025-26 Editor</h2>
              <button onClick={() => setShowRigFyEditor(false)} className="action-button button-danger">Close</button>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <label style={{ color: '#9bb1ff', fontWeight: 800 }}>Rig</label>
              <select value={rigFilter} onChange={e => setRigFilter(e.target.value)} style={{ background: '#0b1530', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 10px' }}>
                <option value="">Select a Rig</option>
                {rigOptions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            {rigFilter && (
              <div style={{ display: 'grid', gap: 16 }}>
                {(wellsByRig.get(rigFilter) || []).map((op) => (
                  <div key={op.DrillingOperationID} style={{ background: '#23234c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontWeight: 800 }}>{op.WellName}</div>
                      <div style={{ color: '#9bb1ff' }}>{op.BlockName}</div>
                    </div>
                    <FiscalYearEditorInline wellId={op.WellID} wellName={op.WellName} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Delete Well Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0F1D3B', color: '#fff', padding: 24, borderRadius: 16, minWidth: 520, maxWidth: '80vw', boxShadow: '0 8px 32px rgba(25, 118, 210, 0.25)', border: '1px solid #2a5bd7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, color: '#ff5252', letterSpacing: 0.2 }}>Archive Well(s)</h2>
              <button 
                onClick={closeDeleteModal} 
                style={{ background: 'transparent', border: '2px solid #ff5252', color: '#ff5252', borderRadius: 10, padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#ff5252'; e.currentTarget.style.color = '#ffffff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ff5252'; }}
              >
                Close
              </button>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <input
                type="text"
                placeholder="Search well or block..."
                value={deleteSearch}
                onChange={(e) => setDeleteSearch(e.target.value)}
                style={{ flex: 1, background: '#0b1530', color: '#fff', border: '1px solid #2a5bd7', borderRadius: 8, padding: '8px 12px' }}
              />
              <button
                onClick={() => {
                  if (selectedWellsToDelete.length === operations.length) {
                    setSelectedWellsToDelete([]);
                  } else {
                    setSelectedWellsToDelete(operations.map(o => o.DrillingOperationID));
                  }
                }}
                style={{ background: 'transparent', border: '2px solid #ffd54f', color: '#ffd54f', borderRadius: 10, padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#ffd54f'; e.currentTarget.style.color = '#000000'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ffd54f'; }}
              >
                {selectedWellsToDelete.length === operations.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 12, paddingRight: 4 }}>
              {operations
                .filter(op => {
                  const q = deleteSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (op.WellName || '').toLowerCase().includes(q) ||
                    (op.BlockName || '').toLowerCase().includes(q) ||
                    (op.RigNo || '').toLowerCase().includes(q)
                  );
                })
                .map(op => (
                  <label key={op.DrillingOperationID} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, background: '#0b1530', border: '1px solid rgba(42,91,215,0.4)', borderRadius: 10, padding: '8px 10px' }}>
                    <input
                      type="checkbox"
                      checked={selectedWellsToDelete.includes(op.DrillingOperationID)}
                      onChange={e => {
                        setSelectedWellsToDelete(prev =>
                          e.target.checked
                            ? [...prev, op.DrillingOperationID]
                            : prev.filter(id => id !== op.DrillingOperationID)
                        );
                      }}
                      style={{ transform: 'scale(1.2)', margin: 0 }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, color: '#fff' }}>{op.WellName || '—'}</span>
                      <span style={{ color: '#9bb1ff', fontSize: 12 }}>{op.RigNo ? `${op.RigNo} • ` : ''}{op.BlockName || ''}</span>
                    </div>
                  </label>
                ))}
              {operations.length === 0 && (
                <div style={{ color: '#9bb1ff', textAlign: 'center', padding: 20 }}>No wells found.</div>
              )}
            </div>
            {deleteError && <div style={{ color: '#ff8a80', marginBottom: 8 }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button 
                onClick={closeDeleteModal} 
                style={{ background: 'transparent', color: '#ffd54f', border: '2px solid #ffd54f', borderRadius: 10, padding: '8px 18px', fontWeight: 700 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#ffd54f'; e.currentTarget.style.color = '#000000'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ffd54f'; }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleteLoading(true);
                  setDeleteError(null);
                  try {
                    for (const id of selectedWellsToDelete) {
                      const res = await doFetch(`${API_BASE}/drilling-operations/${id}`, { method: 'DELETE' });
                      if (!res.ok) throw new Error('Failed to delete well');
                    }
                    closeDeleteModal();
                    setSaving(s => !s); // refresh
                  } catch (err) {
                    setDeleteError(err.message);
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
                disabled={deleteLoading || selectedWellsToDelete.length === 0}
                style={{ background: '#ff5252', color: '#0F1D3B', border: '2px solid #ff5252', borderRadius: 10, padding: '8px 18px', fontWeight: 800, opacity: selectedWellsToDelete.length === 0 ? 0.6 : 1, cursor: selectedWellsToDelete.length === 0 ? 'not-allowed' : 'pointer' }}
                onMouseEnter={(e) => { if (!(deleteLoading || selectedWellsToDelete.length === 0)) { e.currentTarget.style.color = '#ffffff'; } }}
                onMouseLeave={(e) => { if (!(deleteLoading || selectedWellsToDelete.length === 0)) { e.currentTarget.style.color = '#0F1D3B'; } }}
              >
                {deleteLoading ? 'Archiving...' : 'Confirm Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Past Wells Modal */}
      {showPastWellsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#0F1D3B', color: '#fff', padding: 24, borderRadius: 16, minWidth: 900, maxWidth: '92vw', maxHeight: '90vh', boxShadow: '0 8px 32px rgba(25, 118, 210, 0.25)', border: '1px solid #2a5bd7', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, color: '#ffb74d', letterSpacing: 0.2 }}>Past Wells (Archived Wells)</h2>
              <button 
                onClick={() => setShowPastWellsModal(false)} 
                style={{ background: 'transparent', border: '2px solid #ffb74d', color: '#ffb74d', borderRadius: 10, padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#ffb74d'; e.currentTarget.style.color = '#000000'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ffb74d'; }}
              >
                Close
              </button>
            </div>
            {pastWells.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9bb1ff', background: '#0b1530', borderRadius: 12, border: '1px solid rgba(42,91,215,0.4)' }}>
                No past wells found. Deleted wells will appear here.
              </div>
            ) : (
              <div style={{ overflow: 'auto', borderRadius: 12, border: '1px solid rgba(42,91,215,0.4)' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#162345', color: '#e3f2fd' }}>
                      <th style={{ position: 'sticky', top: 0, background: '#162345', padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid rgba(100,149,237,0.3)', fontWeight: 800 }}>Well Name</th>
                      <th style={{ position: 'sticky', top: 0, background: '#162345', padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid rgba(100,149,237,0.3)', fontWeight: 800 }}>Rig</th>
                      <th style={{ position: 'sticky', top: 0, background: '#162345', padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid rgba(100,149,237,0.3)', fontWeight: 800 }}>Block</th>
                      <th style={{ position: 'sticky', top: 0, background: '#162345', padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid rgba(100,149,237,0.3)', fontWeight: 800 }}>Spud Date</th>
                      <th style={{ position: 'sticky', top: 0, background: '#162345', padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid rgba(100,149,237,0.3)', fontWeight: 800 }}>Present Depth</th>
                      <th style={{ position: 'sticky', top: 0, background: '#162345', padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid rgba(100,149,237,0.3)', fontWeight: 800 }}>Target Depth</th>
                      <th style={{ position: 'sticky', top: 0, background: '#162345', padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid rgba(100,149,237,0.3)', fontWeight: 800 }}>Operation Log</th>
                      <th style={{ position: 'sticky', top: 0, background: '#162345', padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid rgba(100,149,237,0.3)', fontWeight: 800 }}>Deleted At</th>
                      <th style={{ position: 'sticky', top: 0, background: '#162345', padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid rgba(100,149,237,0.3)', fontWeight: 800 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastWells.map((well, index) => {
                      const id = well.PastWellID || well.WellID;
                      return (
                      <tr
                        key={well.PastWellID || `${well.WellID}-${well.DeletedAt || index}`}
                        style={{ borderBottom: '1px solid rgba(100,149,237,0.2)', background: '#0b1530', color: '#e3f2fd' }}
                      >
                        <td style={{ padding: '12px 10px', fontWeight: 700 }}>{well.WellName}</td>
                        <td style={{ padding: '12px 10px', color: '#9bb1ff' }}>{well.RigNo || '-'}</td>
                        <td style={{ padding: '12px 10px', color: '#9bb1ff' }}>{well.BlockName || '-'}</td>
                        <td style={{ padding: '12px 10px' }}>{well.SpudDate ? new Date(well.SpudDate).toLocaleDateString() : '-'}</td>
                        <td style={{ padding: '12px 10px' }}>{well.PresentDepthM ?? '-'}</td>
                        <td style={{ padding: '12px 10px' }}>{well.TDM ?? '-'}</td>
                        <td style={{ padding: '12px 10px', maxWidth: '380px' }}>
                          {well.OperationLog ? (
                            <div style={{ maxHeight: '120px', overflow: 'auto', fontSize: '12px', lineHeight: '1.5', background: '#08102a', borderRadius: 8, border: '1px solid rgba(42,91,215,0.3)', padding: '8px 10px' }}>
                              {well.OperationLog}
                            </div>
                          ) : (
                            <span style={{ color: '#9bb1ff' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 10px' }}>{well.DeletedAt ? new Date(well.DeletedAt).toLocaleString() : '-'}</td>
                        <td style={{ padding: '12px 10px', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => navigate(`/removed-well?wellId=${id}&wellName=${encodeURIComponent(well.WellName || '')}`)}
                            style={{ background: 'transparent', border: '2px solid #9bb1ff', color: '#9bb1ff', borderRadius: 8, padding: '4px 8px', fontWeight: 700, marginRight: 8, cursor: 'pointer', transition: 'all .15s ease' }}
                            title="Open"
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#9bb1ff'; e.currentTarget.style.color = '#000000'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9bb1ff'; }}
                          >
                            Open
                          </button>
                          {isAdmin && (
                          <button
                            onClick={async () => {
                              try {
                                setReactivatingId(id);
                                const res = await doFetch(`${API_BASE}/wells/${id}/activate`, { method: 'PATCH' });
                                if (!res.ok) throw new Error('Failed to activate well');
                                // Remove from local list and refresh active wells
                                setPastWells(list => list.filter(w => (w.PastWellID || w.WellID) !== id));
                                setSaving(s => !s);
                              } catch (e) {
                                alert(e.message);
                              } finally {
                                setReactivatingId(null);
                              }
                            }}
                            disabled={reactivatingId === id}
                            style={{ background: 'transparent', border: '2px solid #43ea7f', color: reactivatingId === id ? '#2e7d32' : '#43ea7f', borderRadius: 8, padding: '4px 8px', fontWeight: 700, cursor: reactivatingId === id ? 'not-allowed' : 'pointer', opacity: reactivatingId === id ? 0.7 : 1, transition: 'all .15s ease' }}
                            title="Make Active"
                            onMouseEnter={(e) => { if (reactivatingId !== id) { e.currentTarget.style.background = '#43ea7f'; e.currentTarget.style.color = '#000000'; } }}
                            onMouseLeave={(e) => { if (reactivatingId !== id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#43ea7f'; } }}
                          >
                            {reactivatingId === id ? 'Activating…' : 'Make Active'}
                          </button>)}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Inline FY editor used inside Rig-wise modal
function FiscalYearEditorInline({ wellId, wellName }) {
  const { authFetch } = useAuth() || {};
  const doAuthFetch = React.useCallback((url, options) => (authFetch ? authFetch(url, options) : fetch(url, options)), [authFetch]);
  const [plans, setPlans] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const quarters = ['1st QTR','2nd QTR','3rd QTR','4th QTR'];
  const [drafts, setDrafts] = React.useState(() => (
    quarters.reduce((acc, q) => { acc[q] = { QTR: q, WellDepth: '', PlanDetails: '' }; return acc; }, {})
  ));

  const fy = '2025-26';
  const load = React.useCallback(() => {
    setLoading(true);
    setErr('');
  doAuthFetch(`${API_BASE}/fiscal-year-plans?wellId=${Number(wellId)}&fy=${fy}`)
      .then(r => { if (!r.ok) throw new Error('Load failed'); return r.json(); })
      .then(data => { setPlans(Array.isArray(data) ? data : []); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [wellId]);

  React.useEffect(() => { load(); }, [load]);

  const updateField = (idx, field, value) => {
    setPlans(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const saveRow = async (idx) => {
    const p = plans[idx];
    try {
  const res = await doAuthFetch(`${API_BASE}/fiscal-year-plans/${p.FiscalYearPlanID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ WellName: p.WellName, WellDepth: p.WellDepth, PlanDetails: p.PlanDetails })
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (e) { alert(e.message); }
  };

  const deleteRow = async (planId) => {
    if (!window.confirm('Delete this plan?')) return;
    try {
  const res = await doAuthFetch(`${API_BASE}/fiscal-year-plans/${planId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setPlans(prev => prev.filter(p => p.FiscalYearPlanID !== planId));
    } catch (e) { alert(e.message); }
  };

  const editDraft = (q, field, value) => {
    setDrafts(prev => ({ ...prev, [q]: { ...prev[q], [field]: value } }));
  };
  const addPlan = async (q) => {
    const d = drafts[q];
    try {
      const payload = { FY: fy, QTR: d.QTR, WellName: wellName, WellDepth: d.WellDepth, PlanDetails: d.PlanDetails, WellID: wellId };
  const res = await doAuthFetch(`${API_BASE}/add-fiscal-year-plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`Add failed: ${res.status}`);
      const data = await res.json();
      setPlans(prev => [...prev, data]);
      setDrafts(prev => ({ ...prev, [q]: { QTR: q, WellDepth: '', PlanDetails: '' } }));
    } catch (e) { alert(e.message); }
  };

  if (loading) return <div style={{ color: '#9bb1ff' }}>Loading…</div>;
  if (err) return <div style={{ color: '#ff8a80' }}>Error: {err}</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {quarters.map(q => (
        <div key={q} style={{ background: '#0b1530', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{q}</div>
          {(plans.filter(p => p.QTR === q)).map((p, idx) => {
            const i = plans.findIndex(x => x.FiscalYearPlanID === p.FiscalYearPlanID);
            return (
              <div key={p.FiscalYearPlanID} style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
                <input value={plans[i].WellName || ''} onChange={e => updateField(i,'WellName', e.target.value)} placeholder="Well Name" style={{ padding: 6, borderRadius: 6, border: '1px solid #334' }} />
                <input value={plans[i].WellDepth || ''} onChange={e => updateField(i,'WellDepth', e.target.value)} placeholder="Well Depth" style={{ padding: 6, borderRadius: 6, border: '1px solid #334' }} />
                <input value={plans[i].PlanDetails || ''} onChange={e => updateField(i,'PlanDetails', e.target.value)} placeholder="Plan Details" style={{ padding: 6, borderRadius: 6, border: '1px solid #334' }} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="action-button button-success" onClick={() => saveRow(i)}>Save</button>
                  <button className="action-button button-danger" onClick={() => deleteRow(p.FiscalYearPlanID)}>Delete</button>
                </div>
              </div>
            )
          })}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', marginTop: 6, paddingTop: 6 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: '#9bb1ff' }}>Add New</div>
            <select value={drafts[q].QTR} onChange={e => editDraft(q,'QTR', e.target.value)} style={{ marginBottom: 6, padding: 6, borderRadius: 6, border: '1px solid #334', background: '#09122a', color: '#fff' }}>
              {quarters.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <input value={drafts[q].WellDepth} onChange={e => editDraft(q,'WellDepth', e.target.value)} placeholder="Well Depth" style={{ padding: 6, borderRadius: 6, border: '1px solid #334', display: 'block', width: '100%', marginBottom: 6 }} />
            <input value={drafts[q].PlanDetails} onChange={e => editDraft(q,'PlanDetails', e.target.value)} placeholder="Plan Details" style={{ padding: 6, borderRadius: 6, border: '1px solid #334', display: 'block', width: '100%', marginBottom: 6 }} />
            <div style={{ textAlign: 'right' }}>
              <button className="action-button button-primary" onClick={() => addPlan(q)}>Add Plan</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default DrillingDashboard;
