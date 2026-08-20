import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SiteHeader from './SiteHeader';
import { API_BASE } from './config';
import { useAuth } from './auth';

function WellHistory() {
  const { wellId } = useParams();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wellInfo, setWellInfo] = useState(null);
  const { authFetch } = useAuth() || {};

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
  const response = await (authFetch || fetch)(`${API_BASE}/well-history/${wellId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch well history');
        }
        const data = await response.json();
        setHistory(data);
        
        // Extract well info from first record
        if (data.length > 0) {
          setWellInfo({
            WellName: data[0].WellName,
            BlockName: data[0].BlockName,
            RigNo: data[0].RigNo
          });
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (wellId) {
      fetchHistory();
    }
  }, [wellId]);

  function getCurrentDateTimeString() {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  }

  const handleDownloadPDF = () => {
    if (history.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape' });
    const dateStr = getCurrentDateTimeString();
    const title = `WELL HISTORY REPORT - ${wellInfo?.WellName || 'Unknown Well'} ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}`;
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 14);

    // Two-row header similar to drilling operations
    const head = [
      [
        'History ID', 'Sr. #', 'Rig #', 'Well\nSpud date\nConcession\nState', 'Present Depth (TD) M',
        { content: 'Planned Rig AFE Days', colSpan: 2, styles: { halign: 'center', fillColor: [180, 198, 231] } },
        'Mtr Drld',
        { content: 'Actual Rig Days', colSpan: 2, styles: { halign: 'center', fillColor: [180, 198, 231] } },
        'Operations During Last 24 Hrs',
        'Stop Cards',
        'History Timestamp'
      ],
      [
        '', '', '', '', '', 'Drlg.', 'Test.', '', 'Dry', 'Test/WO', '', '', ''
      ]
    ];

    // Build rows
    const rows = [];
    history.forEach((record, idx) => {
      const shares = extractShares(record.OperationLog);
      let operationLogCell = (record.OperationLog || '').split('\n').map((line, i) => i === 0 ? `**${line}**` : line).join('\n');
      let sharesLines = [];
      if (shares) {
        sharesLines = shares.split(',').map(s => s.trim()).filter(Boolean);
        operationLogCell += '\n\n' + sharesLines.join('\n');
      }

      const row = [
        record.HistoryID,
        record.SrNo || '',
        record.RigNo || '',
        `${record.WellName || ''}\n${record.BlockName || ''}${record.SpudDate ? '\n(' + record.SpudDate.split('T')[0] + ')' : ''}`,
        record.PresentDepthM ? `${record.PresentDepthM}m${record.PresentDepthFt ? ' ('+record.PresentDepthFt+'ft)' : ''}` : '',
        record.DrlgDays || '',
        record.TestDays || '',
        { content: record.TDM || '', styles: { fontStyle: 'bold' } },
        record.DryDays || '',
        record.TestWODays || '',
        operationLogCell,
        record.StopCard || '',
        record.HistoryTimestamp ? new Date(record.HistoryTimestamp).toLocaleString() : ''
      ];
      rows.push(row);
    });

    autoTable(doc, {
      head: head,
      body: rows,
      startY: 22,
      styles: { fontSize: 8, cellPadding: 2, valign: 'middle', lineColor: [44,62,80], lineWidth: 0.2 },
      headStyles: { fillColor: [135, 206, 235], textColor: 44, fontStyle: 'bold', halign: 'center' },
      columnStyles: {
        1: { fontStyle: 'bold' },
        7: { fontStyle: 'bold' },
        12: { fillColor: [255, 236, 179] }
      },
      didParseCell: function (data) {
        // Italicize only shares lines in Operations During Last 24 Hrs
        if (data.section === 'body' && data.column.index === 10 && data.cell.raw) {
          const lines = data.cell.raw.split('\n');
          // Bold the first line
          if (lines.length > 0) {
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    doc.save(`WellHistory_${wellInfo?.WellName || 'Unknown'}_${dateStr}.pdf`);
  };

  // Helper to extract shares info from OperationLog
  function extractShares(operationLog) {
    if (!operationLog) return '';
  // Look for a line with company shares (e.g., OGDC The Energy 65%, ...)
    const match = operationLog.match(/([A-Z]+\s*\d+%[\s,]*)+/);
    return match ? match[0].trim() : '';
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <div className="loading-spinner"></div>
      <div style={{ marginTop: '16px', color: 'white', fontSize: '18px' }}>Loading well history...</div>
    </div>
  );

  if (error) return (
    <div style={{ color: '#ff6b6b', textAlign: 'center', padding: '20px', background: 'rgba(255,107,107,0.1)', borderRadius: '8px' }}>
      Error: {error}
    </div>
  );

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: 'linear-gradient(135deg, #23234c 0%, #2b5876 100%)', borderRadius: 18, boxShadow: '0 8px 32px rgba(25, 118, 210, 0.10)' }}>
      <SiteHeader title={`Well History: ${wellInfo?.WellName || ''}`} />
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#fff', margin: 0, fontSize: '28px', fontWeight: 'bold' }}>
            Well History: {wellInfo?.WellName || 'Unknown Well'}
          </h1>
          <p style={{ color: '#ccc', margin: '8px 0 0 0', fontSize: '16px' }}>
            {wellInfo?.BlockName} • Rig: {wellInfo?.RigNo}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <button
            onClick={() => navigate(-1)}
            className="action-button button-danger"
          >
            ← Back
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={history.length === 0}
            style={{
              background: history.length === 0 ? '#ccc' : '#1976d2',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              fontWeight: 700,
              fontSize: 16,
              cursor: history.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(25, 118, 210, 0.10)'
            }}
          >
            Download History PDF
          </button>
        </div>
      </div>

      {/* History Summary */}
      <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: '20px' }}>History Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#ccc', fontSize: '14px' }}>Total Records</div>
            <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>{history.length}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#ccc', fontSize: '14px' }}>Latest Update</div>
            <div style={{ color: '#fff', fontSize: '16px' }}>
              {history.length > 0 ? new Date(history[0].HistoryTimestamp).toLocaleString() : 'N/A'}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: 16, borderRadius: 8 }}>
            <div style={{ color: '#ccc', fontSize: '14px' }}>Current Depth</div>
            <div style={{ color: '#fff', fontSize: '16px' }}>
              {history.length > 0 ? `${history[0].PresentDepthM}m` : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* History Table */}
      {history.length > 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, overflowX: 'auto' }}>
          <h3 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: '20px' }}>Historical Records</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#fff' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>History ID</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Sr. #</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Rig</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Spud Date</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Present Depth</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Target Depth</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Stop Cards</th>
                <th style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {history.map((record, index) => (
                <tr key={record.HistoryID} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: index % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                  <td style={{ padding: '12px 8px' }}>{record.HistoryID}</td>
                  <td style={{ padding: '12px 8px' }}>{record.SrNo || '-'}</td>
                  <td style={{ padding: '12px 8px' }}>{record.RigNo || '-'}</td>
                  <td style={{ padding: '12px 8px' }}>{record.SpudDate ? new Date(record.SpudDate).toLocaleDateString() : '-'}</td>
                  <td style={{ padding: '12px 8px' }}>{record.PresentDepthM ? `${record.PresentDepthM}m` : '-'}</td>
                  <td style={{ padding: '12px 8px' }}>{record.TDM ? `${record.TDM}m` : '-'}</td>
                  <td style={{ padding: '12px 8px' }}>{record.StopCard || '-'}</td>
                  <td style={{ padding: '12px 8px' }}>{record.HistoryTimestamp ? new Date(record.HistoryTimestamp).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#ccc', fontSize: '18px' }}>
          No historical records found for this well.
        </div>
      )}
    </div>
  );
}

export default WellHistory; 