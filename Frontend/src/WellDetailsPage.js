import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import SiteHeader from './SiteHeader';
import { API_BASE } from './config';
import { useAuth } from './auth';

const cellBase = {
  padding: '8px 10px',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#fff',
  fontSize: 14,
  overflow: 'hidden', // keep contents within column
  boxSizing: 'border-box',
};

function EditableCell({ value, onChange, type = 'text' }) {
  const [v, setV] = useState(value !== undefined && value !== null ? value : '');
  useEffect(() => setV(value !== undefined && value !== null ? value : ''), [value]);
  return (
    <input
      type={type}
      value={v !== undefined && v !== null ? v : ''}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onChange(v)}
      style={{
  width: '100%',
  background: 'transparent',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.12)',
  outline: 'none',
  padding: '6px 8px',
  borderRadius: 6,
  height: 36,
  boxSizing: 'border-box', // include padding/border in width
      }}
    />
  );
}

export default function WellDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sp] = useSearchParams();
  const wellId = Number(sp.get('wellId')) || null;
  const wellName = sp.get('wellName') || '';
  const readOnly = sp.get('readOnly') === '1';
  const { authFetch, isAdmin } = useAuth() || {};
  const effectiveReadOnly = readOnly || !authFetch; // if not logged in treat as read-only

  const [rows, setRows] = useState([]);
  // Track manually added row IDs
  const [manualRowIds, setManualRowIds] = useState([]);
  // Import modal state (CSV/Excel) — smart multi-column date-based
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState('upload'); // 'upload' | 'mapping' | 'preview'
  const [fileName, setFileName] = useState('');
  const [importAOA, setImportAOA] = useState([]); // raw array-of-arrays from file
  const [importHeaders, setImportHeaders] = useState([]); // detected column headers for dropdowns
  // mapping: { Date, PlannedDepth, ActualDepth, Progress, OperationLog } → colIdx or null
  const [importMapping, setImportMapping] = useState({ Date: null, PlannedDepth: null, ActualDepth: null, Progress: null, OperationLog: null });
  const [importMatches, setImportMatches] = useState([]); // [{rowId, date, values}]
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  // Legacy simple state (kept for compatibility)
  const [columnName, setColumnName] = useState('');
  const [targetField, setTargetField] = useState('PlannedDepth');
  const [parsedHeaders, setParsedHeaders] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [parsedAOA, setParsedAOA] = useState([]);
  const [candidateCols, setCandidateCols] = useState([]);
  const [selectedColIndex, setSelectedColIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  // JV Shares text (per-well, read-only)
  const [jvShares, setjvShares] = useState('');
  // Row range filtering state (1-based, empty = show all)
  const [startRow, setStartRow] = useState('');
  const [endRow, setEndRow] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  // Operation Log editor modal
  const [showLogEditor, setShowLogEditor] = useState(false);
  const [logEditRowId, setLogEditRowId] = useState(null);
  // Separate title and details for Operation Log editing
  const [logEditTitle, setLogEditTitle] = useState('');
  const [logEditText, setLogEditText] = useState('');
  const editingRow = useMemo(() => rows.find(r => r.WellDailyProgressID === logEditRowId) || null, [rows, logEditRowId]);

  const title = useMemo(() => {
    if (wellName) return `Well Details: ${wellName}`;
    if (wellId) return `Well Details (#${wellId})`;
    return 'Well Details';
  }, [wellName, wellId]);

  async function fetchRows() {
    setLoading(true);
    setError('');
    try {
      const qs = wellId ? `wellId=${wellId}` : `wellName=${encodeURIComponent(wellName)}`;
      const res = await (authFetch || fetch)(`${API_BASE}/well-daily-progress?${qs}`);
      if (!res.ok) throw new Error('Failed to load well details');
      const data = await res.json();
      setRows(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRows(); }, [wellId, wellName]);

  // Load JV Shares from active wells, fall back to past wells
  useEffect(() => {
    let cancelled = false;
    async function loadJv() {
      try {
        // Try active wells first
  const res = await (authFetch || fetch)(`${API_BASE}/drilling-operations`);
        if (res.ok) {
          const arr = await res.json();
          const found = (arr || []).find(op => (
            (wellId && String(op.WellID) === String(wellId)) ||
            (!wellId && (op.WellName || '').toLowerCase() === (wellName || '').toLowerCase())
          ));
          if (!cancelled && found && found.JVPercent) {
            setjvShares(String(found.JVPercent));
            return;
          }
        }
      } catch {}
      try {
        // Fall back to past wells
  const res2 = await (authFetch || fetch)(`${API_BASE}/past-wells`);
        if (res2.ok) {
          const arr2 = await res2.json();
          const found2 = (arr2 || []).find(w => (
            (wellId && String(w.WellID) === String(wellId)) ||
            (!wellId && (w.WellName || '').toLowerCase() === (wellName || '').toLowerCase())
          ));
          if (!cancelled && found2 && found2.JVPercent) {
            setjvShares(String(found2.JVPercent));
            return;
          }
        }
      } catch {}
      if (!cancelled) setjvShares('');
    }
    loadJv();
    return () => { cancelled = true; };
  }, [wellId, wellName]);

  async function refreshRows() {
    setRefreshing(true);
    await fetchRows();
    setRefreshing(false);
  }

  async function updateCell(id, patch) {
    try {
      const res = await (authFetch || fetch)(`${API_BASE}/well-daily-progress/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Save failed');

      // Best-effort: if depth and/or log changed, touch DrillingOperation.LastUpdated
      const hasDepth = Object.prototype.hasOwnProperty.call(patch, 'ActualDepth') && patch.ActualDepth !== null && patch.ActualDepth !== '';
      const hasLog = Object.prototype.hasOwnProperty.call(patch, 'OperationLog') && String(patch.OperationLog || '').trim().length > 0;
      if (hasDepth || hasLog) {
        try {
          const row = rows.find(r => r.WellDailyProgressID === id);
          if (row && row.WellID) {
        const opsRes = await (authFetch || fetch)(`${API_BASE}/drilling-operations`);
            if (opsRes.ok) {
              const ops = await opsRes.json();
              const op = (ops || []).find(o => String(o.WellID) === String(row.WellID));
              if (op && op.DrillingOperationID) {
          await (authFetch || fetch)(`${API_BASE}/drilling-operations/${op.DrillingOperationID}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ GeneralNotes: op.GeneralNotes || null })
                });
              }
            }
          }
        } catch {
          // ignore — non-blocking
        }
      }
    } catch (e) {
      setError(e.message);
    }
  }

  async function addRow() {
  // Confirmation before adding a new row
  const ok = window.confirm('Add a new working-day row?');
  if (!ok) return;

    const base = rows[rows.length - 1] || {};
    const lastDateStr = base.Date ? base.Date.slice(0, 10) : null;
    let next = lastDateStr ? new Date(lastDateStr) : new Date();
    // advance to next working day (Mon-Fri)
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() === 0 || next.getDay() === 6); // 0=Sun,6=Sat

    const payload = {
      WellID: base.WellID || wellId || null,
      WellName: base.WellName || wellName || '',
      Date: next.toISOString().slice(0, 10),
      Day: (typeof base.Day === 'number' ? base.Day : rows.length - 1) + 1,
      PlannedDepth: null,
      ActualDepth: null,
      Progress: null,
      OperationLog: '',
    };
    try {
  const res = await (authFetch || fetch)(`${API_BASE}/well-daily-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Create failed');
      const created = await res.json();
      setManualRowIds((ids) => [...ids, created.WellDailyProgressID]);
      await fetchRows();
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteRow(id) {
    try {
      const res = await (authFetch || fetch)(`${API_BASE}/well-daily-progress/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setRows((r) => r.filter((x) => x.WellDailyProgressID !== id));
      setManualRowIds((ids) => ids.filter((rowId) => rowId !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  function splitOperationLog(val) {
    const raw = String(val || '');
    if (!raw) return { title: '', text: '' };
    const idx = raw.indexOf('\n');
    if (idx === -1) return { title: raw.trim(), text: '' };
    const title = raw.slice(0, idx).trim();
    const rest = raw.slice(idx + 1).trim();
    return { title, text: rest };
  }

  function openLogEditor(row) {
    setLogEditRowId(row.WellDailyProgressID);
    const { title, text } = splitOperationLog(row.OperationLog);
    setLogEditTitle(title);
    setLogEditText(text);
    setShowLogEditor(true);
  }

  async function saveLogEditor() {
    if (!logEditRowId) { setShowLogEditor(false); return; }
    try {
      const combined = [logEditTitle?.trim() || '', logEditText?.trim() || '']
        .filter(Boolean)
        .join('\n\n');
      await updateCell(logEditRowId, { OperationLog: combined });
      await fetchRows();
      setShowLogEditor(false);
      setLogEditRowId(null);
      setLogEditTitle('');
      setLogEditText('');
    } catch (e) {
      // error already handled in updateCell
    }
  }

  // --- Smart Import helpers ---

  // Normalize a header string for fuzzy matching
  function normH(s) {
    return (s || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Convert Excel date serial OR date string → 'YYYY-MM-DD'
  function parseExcelDate(val) {
    if (val === null || val === undefined || val === '') return null;
    const s = String(val).trim();
    // Excel serial number (e.g. 45836)
    const num = Number(s.replace(/,/g, ''));
    if (!isNaN(num) && num > 20000 && num < 80000) {
      // xlsx epoch: Jan 1 1900 = 1, with leap-year bug (day 60 = Feb 29 1900 never existed)
      const epoch = new Date(Date.UTC(1899, 11, 30));
      epoch.setUTCDate(epoch.getUTCDate() + Math.floor(num));
      return epoch.toISOString().slice(0, 10);
    }
    // Try ISO / common formats
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    // Try DD-Mon-YYYY or DD/MM/YYYY
    const parts = s.match(/(\d{1,2})[\-\/](\w{3,9})[\-\/](\d{2,4})/);
    if (parts) {
      const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
      const mKey = parts[2].toLowerCase().slice(0,3);
      if (months[mKey] !== undefined) {
        const yr = parts[3].length === 2 ? 2000 + Number(parts[3]) : Number(parts[3]);
        const d2 = new Date(Date.UTC(yr, months[mKey], Number(parts[1])));
        if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 10);
      }
    }
    return null;
  }

  // Auto-detect which column maps to each app field
  function autoDetectMapping(aoa) {
    // Scan first 15 rows for header candidates
    const scanRows = Math.min(15, aoa.length);
    let colCount = 0;
    for (let r = 0; r < scanRows; r++) colCount = Math.max(colCount, (aoa[r] || []).length);

    // Build per-column best header label
    const colLabels = [];
    for (let c = 0; c < colCount; c++) {
      const texts = [];
      for (let r = 0; r < scanRows; r++) {
        const v = aoa[r] && aoa[r][c] ? String(aoa[r][c]).trim() : '';
        if (v && /[a-zA-Z]/.test(v)) texts.push(v);
      }
      colLabels.push(texts.length ? texts.sort((a,b) => b.length - a.length)[0] : `Col ${c+1}`);
    }

    const synonyms = {
      Date: ['date', 'report date', 'reportdate', 'report_date', 'dt', 'dated'],
      PlannedDepth: ['planned depth', 'planneddepth', 'planned', 'p depth', 'sim', 'planned m', 'planed depth'],
      ActualDepth: ['actual depth', 'actualdepth', 'actual', 'a depth', 'depth m', 'cum depth', 'cumulative', 'gurgalot', 'depth(m)', 'depth m'],
      Progress: ['daily progress', 'progress', 'daily', 'drlg', 'drld today', 'mddrld', 'metres drilled'],
      OperationLog: ['operations during', 'daily operations', 'operation log', 'operationlog', 'operations', 'remarks', 'log', 'daily ops'],
    };

    const mapping = { Date: null, PlannedDepth: null, ActualDepth: null, Progress: null, OperationLog: null };
    const used = new Set();
    // Priority order: Date first, then others
    for (const field of ['Date', 'PlannedDepth', 'ActualDepth', 'Progress', 'OperationLog']) {
      let best = { idx: null, score: 0 };
      for (let c = 0; c < colCount; c++) {
        if (used.has(c)) continue;
        const lbl = normH(colLabels[c]);
        for (const syn of synonyms[field]) {
          const s = normH(syn);
          let score = 0;
          if (lbl === s) score = 100;
          else if (lbl.includes(s) || s.includes(lbl)) score = Math.min(lbl.length, s.length);
          if (score > best.score) best = { idx: c, score };
        }
      }
      if (best.idx !== null && best.score > 0) { mapping[field] = best.idx; used.add(best.idx); }
    }
    return { mapping, colLabels };
  }

  // Build matches: join Excel rows to app rows by date
  function buildImportMatches(aoa, mapping, colLabels) {
    if (mapping.Date === null) return [];
    // Find first data row (skip header rows — first row where Date col parses as a date)
    let dataStart = 0;
    for (let r = 0; r < Math.min(20, aoa.length); r++) {
      const raw = aoa[r] && aoa[r][mapping.Date] !== undefined ? aoa[r][mapping.Date] : '';
      const d = parseExcelDate(raw);
      if (d) { dataStart = r; break; }
    }

    // Build lookup: 'YYYY-MM-DD' → app row
    const appDateMap = {};
    for (const row of rows) {
      const d = row.Date ? String(row.Date).slice(0, 10) : null;
      if (d) appDateMap[d] = row;
    }

    const matches = [];
    for (let r = dataStart; r < aoa.length; r++) {
      const excelRow = aoa[r] || [];
      const rawDate = excelRow[mapping.Date] !== undefined ? excelRow[mapping.Date] : '';
      const isoDate = parseExcelDate(rawDate);
      if (!isoDate) continue;
      const appRow = appDateMap[isoDate];
      if (!appRow) continue;
      const values = {};
      const numFields = new Set(['PlannedDepth', 'ActualDepth', 'Progress']);
      for (const field of ['PlannedDepth', 'ActualDepth', 'Progress', 'OperationLog']) {
        if (mapping[field] === null) continue;
        const raw = excelRow[mapping[field]] !== undefined ? String(excelRow[mapping[field]]).trim() : '';
        if (numFields.has(field)) {
          const n = Number(raw.replace(/[,\s]/g, ''));
          values[field] = raw === '' ? null : Number.isFinite(n) ? n : null;
        } else {
          values[field] = raw === '' ? '' : raw;
        }
      }
      matches.push({ rowId: appRow.WellDailyProgressID, isoDate, excelDateRaw: String(rawDate), values });
    }
    return matches;
  }

  function parseCSV(text) {
    const rows = [];
    let cur = '';
    let row = [];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
        } else { cur += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { row.push(cur); cur = ''; }
        else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else if (ch === '\r') { /* ignore */ }
        else { cur += ch; }
      }
    }
    row.push(cur); rows.push(row);
    while (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();
    return rows;
  }

  // Pick best sheet: prefer 'DTC DATA', else sheet with most columns in first 10 rows
  function pickBestSheet(wb) {
    const dtcIdx = wb.SheetNames.findIndex(n => n.trim().toUpperCase() === 'DTC DATA');
    if (dtcIdx !== -1) return wb.SheetNames[dtcIdx];
    // Fall back to widest sheet
    let best = { name: wb.SheetNames[0], cols: 0 };
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
      let maxCols = 0;
      for (let r = 0; r < Math.min(10, aoa.length); r++) maxCols = Math.max(maxCols, (aoa[r] || []).length);
      if (maxCols > best.cols) best = { name, cols: maxCols };
    }
    return best.name;
  }

  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setImportError('');
    setImportSuccess('');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const processAOA = (aoa) => {
      const normalized = aoa.map(r => (r || []).map(c => (c === undefined || c === null) ? '' : c));
      setImportAOA(normalized);
      const { mapping, colLabels } = autoDetectMapping(normalized);
      setImportMapping(mapping);
      setImportHeaders(colLabels);
      setImportStep('mapping');
      setImportError('');
    };
    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = () => processAOA(parseCSV(String(reader.result || '')));
      reader.onerror = () => setImportError('Failed to read CSV file');
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
          const sheetName = pickBestSheet(wb);
          const ws = wb.Sheets[sheetName];
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
          processAOA(aoa);
        } catch { setImportError('Failed to parse Excel file'); }
      };
      reader.onerror = () => setImportError('Failed to read Excel file');
      reader.readAsArrayBuffer(file);
    } else {
      setImportError('Unsupported file type. Please select CSV or Excel.');
    }
  }

  function handleMappingNext() {
    if (importMapping.Date === null) {
      setImportError('Please map at least the Date column so rows can be matched by date.');
      return;
    }
    const hasAnyData = ['PlannedDepth','ActualDepth','Progress','OperationLog'].some(f => importMapping[f] !== null);
    if (!hasAnyData) {
      setImportError('Please map at least one data column (PlannedDepth, ActualDepth, Progress, or OperationLog).');
      return;
    }
    setImportError('');
    const matches = buildImportMatches(importAOA, importMapping, importHeaders);
    setImportMatches(matches);
    setImportStep('preview');
  }

  async function handleImportConfirm() {
    setImportError('');
    setImportLoading(true);
    try {
      if (!importMatches.length) throw new Error('No matching rows found to import.');
      await Promise.all(
        importMatches.map(({ rowId, values }) => updateCell(rowId, values))
      );
      await fetchRows();
      const fields = Object.keys(importMatches[0]?.values || {}).join(', ');
      setImportSuccess(`✅ Imported ${importMatches.length} row(s) — fields: ${fields}`);
      resetImport();
    } catch (e) {
      setImportError(e.message || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  }

  function resetImport() {
    setShowImport(false);
    setImportStep('upload');
    setFileName('');
    setImportAOA([]);
    setImportHeaders([]);
    setImportMapping({ Date: null, PlannedDepth: null, ActualDepth: null, Progress: null, OperationLog: null });
    setImportMatches([]);
    setImportError('');
    setColumnName('');
    setParsedHeaders([]);
    setParsedRows([]);
    setParsedAOA([]);
    setCandidateCols([]);
    setSelectedColIndex(null);
  }

  function handleImportCancel() {
    resetImport();
  }

  // Legacy helpers kept for reference (unused by new flow)
  function norm(s) {
    return (s || '').toString().toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '').trim();
  }
  function buildColumnCandidates(aoa) {
    const headerScanRows = Math.min(10, aoa.length);
    let colCount = 0;
    for (let r = 0; r < headerScanRows; r++) colCount = Math.max(colCount, (aoa[r] || []).length);
    const cands = [];
    for (let c = 0; c < colCount; c++) {
      const texts = [];
      for (let r = 0; r < headerScanRows; r++) {
        const val = (aoa[r] && aoa[r][c]) ? String(aoa[r][c]).trim() : '';
        if (val && /[a-zA-Z]/.test(val)) texts.push(val);
      }
      const uniq = Array.from(new Set(texts));
      let label = uniq.sort((a, b) => b.length - a.length)[0] || `Column ${c + 1}`;
      cands.push({ index: c, label, synonyms: Array.from(new Set([...uniq, label])) });
    }
    return cands;
  }

  const thStyle = {
    ...cellBase,
    fontWeight: 700,
    background: '#23234c',
    color: '#fff',
  };

  function formatDateDisplay(value) {
    if (!value) return '';
    try {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) return String(value).slice(0, 10);
      // Use en-GB for DD/MM/YYYY to match the date input rendering in many locales
      return d.toLocaleDateString('en-GB');
    } catch {
      return String(value).slice(0, 10);
    }
  }

  // Compute min/max Day for placeholders and validation
  const dayStats = useMemo(() => {
    const vals = (rows || [])
      .map(r => Number(r.Day))
      .filter(v => Number.isFinite(v));
    if (!vals.length) return { min: 1, max: rows.length || 1 };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [rows]);

  // Derive filtered rows based on Day (inclusive); empty inputs => show all
  const filteredRows = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    const hasStart = startRow !== '' && Number.isFinite(parseInt(startRow, 10));
    const hasEnd = endRow !== '' && Number.isFinite(parseInt(endRow, 10));
    if (!hasStart && !hasEnd) return rows;
    let s = hasStart ? parseInt(startRow, 10) : dayStats.min;
    let e = hasEnd ? parseInt(endRow, 10) : dayStats.max;
    if (s > e) [s, e] = [e, s];
    const min = dayStats.min;
    const max = dayStats.max;
    s = Math.max(min, s);
    e = Math.min(max, e);
    return rows.filter(r => {
      const d = Number(r.Day);
      return Number.isFinite(d) && d >= s && d <= e;
    });
  }, [rows, startRow, endRow, dayStats]);

  // Export helpers
  function rowsToPlainObjects(data) {
    return (data || []).map(r => ({
      Date: r.Date ? String(r.Date).slice(0, 10) : '',
      Day: r.Day ?? '',
      PlannedDepth: r.PlannedDepth ?? '',
      ActualDepth: r.ActualDepth ?? '',
      Progress: r.Progress ?? '',
      OperationLog: r.OperationLog ?? ''
    }));
  }

  function downloadCSV() {
    const items = rowsToPlainObjects(filteredRows);
    if (!items.length) return;
    const headers = Object.keys(items[0]);
    const escape = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const csv = [headers.join(',')].concat(items.map(obj => headers.map(h => escape(obj[h])).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const name = (wellName || `well-${wellId || ''}`).toString().replace(/[^a-z0-9_-]+/gi, '_');
    a.href = url;
    a.download = `${name}_WellDetails.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadExcel() {
    const items = rowsToPlainObjects(filteredRows);
    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WellDetails');
    const name = (wellName || `well-${wellId || ''}`).toString().replace(/[^a-z0-9_-]+/gi, '_');
    XLSX.writeFile(wb, `${name}_WellDetails.xlsx`);
  }

  return (
  <div className="dashboard-container" style={{ paddingTop: 12 }}>
  <SiteHeader title={title} />
      <h1 className="dashboard-title" style={{ display: 'none' }}>{title}</h1>
  <div style={{ marginTop: 24, marginBottom: 12, display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
  <button
          className="action-button button-danger"
          onClick={() => {
            if (readOnly) {
              // Navigate back to removed-well view if this page was opened in read-only mode
              navigate(`/removed-well?wellId=${encodeURIComponent(String(wellId || ''))}&wellName=${encodeURIComponent(wellName || '')}`);
            } else {
              navigate('/dashboard', { state: { selectWell: wellName } });
            }
          }}
        >
          ← Back
        </button>
  {!effectiveReadOnly && (<button className="action-button button-success" onClick={addRow}>+ Add Row</button>)}
  {!effectiveReadOnly && (<button className="action-button button-primary" onClick={() => setShowImport(true)}>⇪ Import from CSV/Excel</button>)}
  {!effectiveReadOnly && (
  <button
          onClick={refreshRows}
          title="Refresh Table"
          aria-label="Refresh Table"
          className="action-button button-purple"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <span aria-hidden="true">{refreshing ? '⟳' : '↻'}</span>
          <span>Refresh Table</span>
        </button>
  )}
        {/* Filter and Download controls */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Filter section */}
          <div style={{ position: 'relative', background: '#0b1630', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: '#9bb1ff', fontWeight: 800, marginRight: 4 }}>Filter rows</div>
            <div style={{ color: '#b0b7c3', fontSize: 12 }}>(by Day)</div>
            <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.12)', margin: '0 6px' }} />
            <label style={{ color: '#fff', fontSize: 12 }}>From</label>
            <input
              type="number"
              value={startRow}
              onChange={(e) => setStartRow(e.target.value)}
              placeholder={String(dayStats.min)}
              style={{ width: 90, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff' }}
            />
            <label style={{ color: '#fff', fontSize: 12 }}>To</label>
            <input
              type="number"
              value={endRow}
              onChange={(e) => setEndRow(e.target.value)}
              placeholder={String(dayStats.max)}
              style={{ width: 90, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff' }}
            />
          </div>

          {/* Download dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              className="action-button button-success"
              onClick={() => setExportOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              title="Download filtered table"
            >
              Download ▾
            </button>
            {exportOpen && (
              <div
                role="menu"
                style={{ position: 'absolute', top: '100%', right: 0, background: '#0b1630', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, minWidth: 160, padding: 6, zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}
              >
                <button
                  role="menuitem"
                  onClick={() => { setExportOpen(false); downloadCSV(); }}
                  style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#fff', padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  CSV
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setExportOpen(false); downloadExcel(); }}
                  style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: '#fff', padding: '8px 10px', borderRadius: 6, cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Excel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* JV Shares display (read-only) */}
      {jvShares && jvShares.trim().length > 0 && (
        <div style={{ margin: '12px auto 12px auto', maxWidth: 1200 }}>
          <div style={{ background: '#23234c', color: '#fff', borderRadius: 12, padding: 16, border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ fontWeight: 800, color: '#9bb1ff', marginBottom: 6 }}>JV Shares</div>
            <div style={{ background: '#0b1530', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', whiteSpace: 'pre-line', color: '#e8ecff', fontSize: 14 }}>
              {jvShares}
            </div>
          </div>
        </div>
      )}
      {importSuccess && (
        <div style={{ color: '#43ea7f', textAlign: 'center', marginBottom: 8 }}>{importSuccess}</div>
      )}
      {error && <div style={{ color: '#ff8a80', textAlign: 'center', marginBottom: 8 }}>{error}</div>}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#fff' }}>Loading…</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#0F1D3B', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '46%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={thStyle}>
                  <div>Date</div>
                  <div style={{ fontSize: 11, opacity: 0.9, fontWeight: 500, marginTop: 2 }}>DD/MM/YYYY</div>
                </th>
                <th style={thStyle}>Day</th>
                <th style={thStyle}>Planned Depth</th>
                <th style={thStyle}>Actual Depth</th>
                <th style={thStyle}>Progress</th>
                <th style={thStyle}>Operation Log</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.WellDailyProgressID}>
                  <td style={cellBase}>
                    {readOnly ? (
                      <div style={{
                        width: '100%',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 6,
                        padding: '6px 8px',
                        height: 36,
                        background: 'transparent',
                        boxSizing: 'border-box',
                        textAlign: 'left'
                      }}>{formatDateDisplay(row.Date)}</div>
                    ) : (
                      <EditableCell
                        type="date"
                        value={(row.Date ? row.Date.slice(0, 10) : '') || ''}
                        onChange={(val) => updateCell(row.WellDailyProgressID, { Date: val })}
                      />
                    )}
                  </td>
                  <td style={{ ...cellBase }}>
                    <div style={{
                      width: '100%',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 6,
                      padding: '6px 8px',
                      height: 36,
                      background: 'transparent',
                      boxSizing: 'border-box',
                      textAlign: 'left'
                    }}>{row.Day !== undefined && row.Day !== null ? row.Day : ''}</div>
                  </td>
                  <td style={{ ...cellBase, textAlign: 'center' }}>
                    {readOnly ? (
                      <div style={{
                        width: '100%',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 6,
                        padding: '6px 8px',
                        height: 36,
                        background: 'transparent',
                        boxSizing: 'border-box',
                        textAlign: 'left'
                      }}>{row.PlannedDepth ?? ''}</div>
                    ) : (
                      <EditableCell
                        type="number"
                        value={row.PlannedDepth}
                        onChange={(val) => updateCell(row.WellDailyProgressID, { PlannedDepth: val === '' ? null : Number(val) })}
                      />
                    )}
                  </td>
                  <td style={{ ...cellBase, textAlign: 'center' }}>
                    {readOnly ? (
                      <div style={{
                        width: '100%',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 6,
                        padding: '6px 8px',
                        height: 36,
                        background: 'transparent',
                        boxSizing: 'border-box',
                        textAlign: 'left'
                      }}>{row.ActualDepth ?? ''}</div>
                    ) : (
                      <EditableCell
                        type="number"
                        value={row.ActualDepth}
                        onChange={(val) => updateCell(row.WellDailyProgressID, { ActualDepth: val === '' ? null : Number(val) })}
                      />
                    )}
                  </td>
                  <td style={{ ...cellBase }}>
                    <div style={{
                      width: '100%',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 6,
                      padding: '6px 8px',
                      height: 36,
                      background: 'transparent',
                      boxSizing: 'border-box',
                      textAlign: 'left'
                    }}>{row.Progress !== undefined && row.Progress !== null ? row.Progress : ''}</div>
                  </td>
                  <td
                    style={{
                      ...cellBase,
                      cursor: 'pointer',
            overflow: 'visible',
                    }}
                    onClick={() => !readOnly && openLogEditor(row)}
                    title={readOnly ? 'Read-only' : 'Click to expand and edit'}
                  >
                    {(() => {
                      const { title, text } = splitOperationLog(row.OperationLog);
                      return (
                        <div
                          style={{
                            padding: '6px 8px',
                            minHeight: 36,
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 6,
                            background: 'transparent',
                            width: '100%',
                            maxWidth: '100%',
                            boxSizing: 'border-box',
                            marginRight: 1,
                            overflow: 'hidden',
                          }}
                        >
                          {title && (
                            <div style={{
                              fontWeight: 900,
                              textDecoration: 'underline',
                              fontSize: 16, // +2 from base 14
                              marginBottom: text ? 4 : 0,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>{title}</div>
                          )}
                          {text && (
                            <div style={{
                              fontSize: 14,
                              lineHeight: 1.35,
                              color: '#e8ecff',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>{text}</div>
                          )}
                          {!title && !text && ''}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* CSV Import Modal — Smart Multi-Column Date-Based */}
      {showImport && !effectiveReadOnly && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#0F1D3B', color: '#fff', padding: 24, borderRadius: 14, width: 'min(95vw, 860px)', maxHeight: '88vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}>

            {/* Step indicator */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
              {[['upload','1. Upload'], ['mapping','2. Map Columns'], ['preview','3. Preview & Confirm']].map(([key, label]) => (
                <div key={key} style={{ flex: 1, padding: '8px 0', textAlign: 'center', fontSize: 13, fontWeight: 700, background: importStep === key ? '#1e3a8a' : 'transparent', color: importStep === key ? '#93c5fd' : '#6b7280', borderRight: '1px solid rgba(255,255,255,0.08)' }}>{label}</div>
              ))}
            </div>

            {/* ── STEP 1: Upload ── */}
            {importStep === 'upload' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <h3 style={{ margin: 0, color: '#9bb1ff' }}>Import Values from Excel / CSV</h3>
                <p style={{ margin: 0, color: '#b0b7c3', fontSize: 13 }}>Upload your DTC Data Excel file. The system will automatically detect the Date, Planned Depth, Actual Depth, Progress, and Operation Log columns and match rows by date.</p>
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>File (CSV, XLSX, XLS)</label>
                  <input type="file" accept=".csv,text/csv,.xlsx,.xls" onChange={handleImportFile} style={{ width: '100%' }} />
                  {fileName && <div style={{ fontSize: 12, color: '#bbb', marginTop: 6 }}>📄 {fileName}</div>}
                </div>
                {importError && <div style={{ color: '#ff8a80', fontSize: 13 }}>{importError}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="action-button button-danger" onClick={handleImportCancel}>Cancel</button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Column Mapping ── */}
            {importStep === 'mapping' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <h3 style={{ margin: 0, color: '#9bb1ff' }}>Column Mapping</h3>
                  <p style={{ margin: '6px 0 0', color: '#b0b7c3', fontSize: 13 }}>Auto-detected columns are shown below. Adjust dropdowns if needed. Select <em>— skip —</em> to not import a field.</p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['App Field', 'Detected Excel Column', 'Override'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', background: '#162040', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.12)', color: '#9bb1ff' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[['Date','📅 Date (required)'],['PlannedDepth','📊 Planned Depth'],['ActualDepth','📈 Actual Depth'],['Progress','📉 Daily Progress'],['OperationLog','📝 Operation Log']].map(([field, label]) => (
                        <tr key={field} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700, color: field === 'Date' ? '#fbbf24' : '#fff' }}>{label}</td>
                          <td style={{ padding: '8px 10px', color: importMapping[field] !== null ? '#43ea7f' : '#9ca3af' }}>
                            {importMapping[field] !== null ? (importHeaders[importMapping[field]] || `Col ${importMapping[field]+1}`) : '— not detected —'}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <select
                              value={importMapping[field] === null ? '' : String(importMapping[field])}
                              onChange={e => setImportMapping(prev => ({ ...prev, [field]: e.target.value === '' ? null : Number(e.target.value) }))}
                              style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: '#0b1630', color: '#fff', fontSize: 12 }}
                            >
                              <option value="">— skip —</option>
                              {importHeaders.map((h, i) => (
                                <option key={i} value={String(i)}>{h || `Col ${i+1}`}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importError && <div style={{ color: '#ff8a80', fontSize: 13 }}>{importError}</div>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button className="action-button button-danger" onClick={handleImportCancel}>Cancel</button>
                  <button className="action-button button-primary" onClick={handleMappingNext}>Next: Preview →</button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Preview & Confirm ── */}
            {importStep === 'preview' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <h3 style={{ margin: 0, color: '#9bb1ff' }}>Preview — {importMatches.length} row(s) matched by date</h3>
                  <p style={{ margin: '6px 0 0', color: '#b0b7c3', fontSize: 13 }}>
                    {importMatches.length === 0
                      ? '⚠️ No dates in the Excel file matched any dates in the app table. Check your column mapping or date formats.'
                      : `Showing first ${Math.min(8, importMatches.length)} of ${importMatches.length} matched rows. Existing values will be overwritten.`
                    }
                  </p>
                </div>
                {importMatches.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          {['App Date', 'Excel Date', ...Object.keys(importMatches[0].values)].map(h => (
                            <th key={h} style={{ padding: '7px 8px', background: '#162040', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.12)', color: '#9bb1ff', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importMatches.slice(0, 8).map(({ rowId, isoDate, excelDateRaw, values }) => (
                          <tr key={rowId} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                            <td style={{ padding: '7px 8px', color: '#43ea7f', fontWeight: 700 }}>{isoDate}</td>
                            <td style={{ padding: '7px 8px', color: '#b0b7c3' }}>{excelDateRaw}</td>
                            {Object.values(values).map((v, i) => (
                              <td key={i} style={{ padding: '7px 8px', color: '#e8ecff', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v === null ? <span style={{ color: '#6b7280' }}>null</span> : String(v)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {importError && <div style={{ color: '#ff8a80', fontSize: 13 }}>{importError}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <button className="action-button button-warning" onClick={() => { setImportStep('mapping'); setImportError(''); }}>← Back</button>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="action-button button-danger" onClick={handleImportCancel} disabled={importLoading}>Cancel</button>
                    <button className="action-button button-success" onClick={handleImportConfirm} disabled={importLoading || importMatches.length === 0}>
                      {importLoading ? 'Importing…' : `Confirm Import (${importMatches.length} rows)`}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
      {/* Operation Log Editor Modal */}
  {showLogEditor && !effectiveReadOnly && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: '#0F1D3B', color: '#fff', padding: 24, borderRadius: 12, width: 'min(92vw, 900px)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Operation Log</h3>
              <button className="action-button button-danger" onClick={() => setShowLogEditor(false)}>Close</button>
            </div>
            <div style={{ fontSize: 13, color: '#b0b7c3', marginBottom: 8 }}>
              {editingRow ? (
                <span>Day {editingRow.Day ?? ''} • {editingRow.Date ? String(editingRow.Date).slice(0,10) : ''}</span>
              ) : null}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#9bb1ff', fontWeight: 800, marginBottom: 6 }}>Title (bold, underlined)</label>
                <input
                  type="text"
                  value={logEditTitle}
                  onChange={(e) => setLogEditTitle(e.target.value)}
                  placeholder="e.g., Well under Drilling"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: '#0b1630', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#9bb1ff', fontWeight: 800, marginBottom: 6 }}>Details</label>
                <textarea
                  value={logEditText}
                  onChange={(e) => setLogEditText(e.target.value)}
                  placeholder="Write or paste the detailed operation log here..."
                  style={{ width: '100%', minHeight: 260, resize: 'vertical', background: '#0b1630', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: 12, lineHeight: 1.4 }}
                />
              </div>
              <div style={{ fontSize: 12, color: '#b0b7c3' }}>The first line will be styled as the title in the table. Title is bold, underlined, and slightly larger.</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <button className="action-button button-warning" onClick={() => setShowLogEditor(false)}>Cancel</button>
              <button className="action-button button-success" onClick={saveLogEditor}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
