import React from 'react';

function WellSelector({ wells, selectedWell, onSelect }) {
  return (
    <div style={{ marginBottom: 24, textAlign: 'center' }}>
      <label htmlFor="well-select" style={{ fontWeight: 600, marginRight: 8, fontSize: 16, color: 'white' }}>Select Well:</label>
      <select
        id="well-select"
        className="professional-select"
        value={selectedWell}
        onChange={e => onSelect(e.target.value)}
      >
        <option value="">-- Choose a well --</option>
        {wells.map(well => (
          <option key={well} value={well}>{well}</option>
        ))}
      </select>
    </div>
  );
}

export default WellSelector; 