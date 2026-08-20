import React from 'react';

function WellSummaryCard({ op, onSelect }) {
  let isUpdatedToday = false;
  if (op.LastUpdated) {
    const today = new Date();
    const updated = new Date(op.LastUpdated);
    isUpdatedToday = updated.getFullYear() === today.getFullYear() && updated.getMonth() === today.getMonth() && updated.getDate() === today.getDate();
  }
  return (
    <div 
    className={`well-card ${isUpdatedToday ? 'updated' : ''}`}
      onClick={() => onSelect(op.WellName)} 
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', textAlign: 'center' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, justifyContent: 'center' }}>
        <h3 className="well-title">
          {op.WellName}
      <span className={`status-badge ${isUpdatedToday ? 'updated' : ''}`}>
            {isUpdatedToday ? 'Updated Today' : 'Not Updated'}
          </span>
        </h3>
      </div>
      <div className="well-subtitle">Block: {op.BlockName}</div>
      <div className="well-subtitle">Present Depth: <span style={{ color: '#fff', fontWeight: 700, fontSize: '24px' }}>{op.PresentDepthM}</span></div>
      <div style={{ fontSize: 15, opacity: 0.7, marginTop: 8, fontStyle: 'italic', textAlign: 'center' }}>{op.PlanDetails}</div>
    </div>
  );
}

export default WellSummaryCard; 