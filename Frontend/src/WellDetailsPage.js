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
  // Import modal state (CSV/Excel)
  const [showImport, setShowImport] = useState(false);
  const [fileName, setFileName] = useState('');
  const [columnName, setColumnName] = useState(''); // source column name
  const [targetField, setTargetField] = useState('PlannedDepth'); // destination field
  const [parsedHeaders, setParsedHeaders] = useState([]); // legacy/simple headers
  const [parsedRows, setParsedRows] = useState([]); // legacy/simple data rows
  const [parsedAOA, setParsedAOA] = useState([]); // full AoA for advanced detection
  const [candidateCols, setCandidateCols] = useState([]); // [{index,label,synonyms:string[]}] 
  const [selectedColIndex, setSelectedColIndex] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
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

  // --- Import helpers ---
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

  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setImportError('');
    setImportSuccess('');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        const table = parseCSV(text);
        if (!table.length) { setParsedHeaders([]); setParsedRows([]); setParsedAOA([]); setCandidateCols([]); setSelectedColIndex(null); return; }
        setParsedHeaders((table[0] || []).map(h => (h || '').trim()));
        setParsedRows(table.slice(1));
        setParsedAOA(table);
        const cands = buildColumnCandidates(table);
        setCandidateCols(cands);
        setSelectedColIndex(null);
      };
      reader.onerror = () => setImportError('Failed to read CSV file');
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = new Uint8Array(ev.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
          if (!aoa.length) { setParsedHeaders([]); setParsedRows([]); setParsedAOA([]); setCandidateCols([]); setSelectedColIndex(null); return; }
          setParsedHeaders((aoa[0] || []).map(h => (String(h || '')).trim()));
          const normalizedAOA = aoa.map(r => r.map(c => c === undefined || c === null ? '' : String(c)));
          setParsedRows(normalizedAOA.slice(1));
          setParsedAOA(normalizedAOA);
          const cands = buildColumnCandidates(normalizedAOA);
          setCandidateCols(cands);
          setSelectedColIndex(null);
        } catch (err) {
          setImportError('Failed to parse Excel file');
        }
      };
      reader.onerror = () => setImportError('Failed to read Excel file');
      reader.readAsArrayBuffer(file);
    } else {
      setImportError('Unsupported file type. Please select CSV or Excel.');
    }
  }

  function norm(s) {
    return (s || '')
      .toString()
      .toLowerCase()
      .replace(/\([^)]*\)/g, '') // remove ( ... )
      .replace(/[^a-z0-9]+/g, '') // remove spaces & punctuation
      .trim();
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
      const synonyms = Array.from(new Set([
        ...uniq,
        ...uniq.map(s => s.replace(/\([^)]*\)/g, '').trim()),
        label,
      ]));
      cands.push({ index: c, label, synonyms });
    }
    return cands;
  }

  function pickColumnIndexByName(name) {
    const target = norm(name);
    if (!target) return -1;
    let best = { idx: -1, score: 0 };
    for (const cand of candidateCols) {
      for (const syn of cand.synonyms) {
        const s = norm(syn);
        if (!s) continue;
        if (s === target) { return cand.index; }
        if (s.includes(target) || target.includes(s)) {
          const score = Math.min(s.length, target.length);
          if (score > best.score) best = { idx: cand.index, score };
        }
      }
    }
    return best.idx;
  }

  function guessStartRow(aoa, colIdx, numericPreferred) {
    if (!Array.isArray(aoa) || aoa.length === 0) return 1;
    const searchRows = Math.min(30, aoa.length);
    if (!numericPreferred) return 1;
    for (let r = 0; r < searchRows; r++) {
      const raw = aoa[r] && aoa[r][colIdx] ? String(aoa[r][colIdx]).trim() : '';
      const normalized = raw.replace(/[\s,]/g, '');
      if (normalized && /^-?\d*(\.\d+)?$/.test(normalized)) {
        return r; // first numeric-looking cell in the column
      }
    }
    return 1;
  }

  async function handleImportConfirm() {
    setImportError('');
    setImportSuccess('');
    try {
      if (!parsedAOA.length) throw new Error('Please upload a CSV/Excel file');
      if (!columnName.trim() && selectedColIndex === null) throw new Error('Please enter or select a source column');
      setImportLoading(true);
      let idx = selectedColIndex;
      if (idx === null) {
        // try exact match with simple headers first
        const headers = parsedHeaders.map(h => (h || '').toLowerCase());
        const exactIdx = headers.findIndex(h => h === columnName.trim().toLowerCase());
        if (exactIdx !== -1) idx = exactIdx; else idx = pickColumnIndexByName(columnName);
      }
      if (idx === -1 || idx === null) throw new Error(`Column "${columnName}" not found. Try picking from detected list.`);

      const numericTargets = new Set(['PlannedDepth', 'ActualDepth', 'Progress']);
      const isNumeric = numericTargets.has(targetField);
      // choose start row adaptively for numeric columns
      const startRow = guessStartRow(parsedAOA, idx, isNumeric);
      const values = parsedAOA.slice(startRow).map(r => {
        const val = (r[idx] !== undefined && r[idx] !== null) ? r[idx] : '';
        return String(val).trim();
      });
      const limit = Math.min(rows.length, values.length);
      const updates = [];
      for (let i = 0; i < limit; i++) {
        const id = rows[i].WellDailyProgressID;
        const raw = values[i];
        if (isNumeric) {
          const normalized = raw.replace(/[\,\s]/g, '');
          const num = normalized === '' || normalized.toLowerCase() === 'null' ? null : Number(normalized);
          updates.push(updateCell(id, { [targetField]: Number.isFinite(num) ? num : null }));
        } else {
          // free text (OperationLog)
          const textVal = raw === '' || raw.toLowerCase() === 'null' ? '' : raw;
          updates.push(updateCell(id, { [targetField]: textVal }));
        }
      }
      await Promise.all(updates);
      await fetchRows();
      setImportSuccess(`Imported ${limit} value(s) into ${targetField}`);
      setShowImport(false);
      // reset inputs after closing
      setTimeout(() => {
        setFileName('');
        setColumnName('');
        setParsedHeaders([]);
        setParsedRows([]);
        setParsedAOA([]);
        setTargetField('PlannedDepth');
        setCandidateCols([]);
        setSelectedColIndex(null);
      }, 0);
    } catch (e) {
      setImportError(e.message || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  }

  function handleImportCancel() {
    setShowImport(false);
    setImportError('');
    setImportSuccess('');
    setFileName('');
    setColumnName('');
    setParsedHeaders([]);
    setParsedRows([]);
    setTargetField('PlannedDepth');
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
      {/* CSV Import Modal */}
  {showImport && !effectiveReadOnly && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#0F1D3B', color: '#fff', padding: 24, borderRadius: 12, width: 'min(90vw, 820px)', maxHeight: '85vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.15)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Import Values from CSV/Excel</h3>
            <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6 }}>File (CSV, XLSX, XLS)</label>
                <input type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleImportFile} style={{ width: '100%' }} />
                {fileName && <div style={{ fontSize: 12, color: '#bbb', marginTop: 4, wordBreak: 'break-word' }}>{fileName}</div>}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6 }}>Source Column Name</label>
                <input
                  type="text"
                  value={columnName}
                  onChange={(e) => setColumnName(e.target.value)}
                  placeholder="e.g., PlannedDepth or Depth(mm)"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff' }}
                />
                {(candidateCols.length > 0 || parsedHeaders.length > 0) && (
                  <div style={{ fontSize: 12, color: '#bbb', marginTop: 6, maxHeight: 160, overflowY: 'auto', paddingRight: 6, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    Detected columns: {candidateCols.map(c => c.label).join(', ') || parsedHeaders.join(', ')}
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#bbb', marginTop: 4 }}>Match is case-insensitive; numeric fields will coerce values, text keeps raw values.</div>
              </div>
              {candidateCols.length > 0 && (
                <div>
                  <label style={{ display: 'block', marginBottom: 6 }}>Or pick from detected columns</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 6 }}>
                    {candidateCols.map(c => (
                      <button key={c.index} onClick={() => { setSelectedColIndex(c.index); setColumnName(c.label); }}
                        style={{ padding: '6px 10px', borderRadius: 8, border: selectedColIndex === c.index ? '2px solid #64b5f6' : '1px solid rgba(255,255,255,0.15)', background: '#0b1630', color: '#fff', textAlign: 'left', cursor: 'pointer', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label style={{ display: 'block', marginBottom: 6 }}>Paste into field</label>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {['PlannedDepth','ActualDepth','Progress','OperationLog'].map((f) => (
                    <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="radio" name="targetField" value={f} checked={targetField === f} onChange={() => setTargetField(f)} />
                      <span>{f}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {importError && <div style={{ color: '#ff8a80', marginBottom: 8 }}>{importError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="action-button button-danger" onClick={handleImportCancel} disabled={importLoading}>Cancel</button>
              <button className="action-button button-success" onClick={handleImportConfirm} disabled={importLoading || !parsedHeaders.length || !columnName}>
                {importLoading ? 'Importing…' : 'Confirm Import'}
              </button>
            </div>
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
