import React from 'react';

const provinceImageMap = {
  'Punjab': 'punjab.png',
  'Sindh': 'sindh.png',
  'Khyber Pakhtunkhwa': 'kpk.png',
  'Balochistan': 'balochistan.png',
  'Gilgit-Baltistan': 'gilgit_baltistan.jpg',
  'Azad Jammu and Kashmir': 'ajk.png',
  'Islamabad Capital Territory': 'ict.png',
};

function ProvinceImage({ province }) {
  if (!province || !provinceImageMap[province]) {
    return (
      <div style={{
        width: 480,
        height: 480,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        border: '2px dashed rgba(100,181,246,0.4)',
        borderRadius: 12,
        background: 'rgba(15,29,59,0.6)'
      }}>
        <h3 style={{ marginBottom: 12, fontWeight: 800 }}>Province Map</h3>
        <div style={{ opacity: 0.8, textAlign: 'center', maxWidth: 420 }}>
          No province image available. Using map at right based on coordinates.
        </div>
      </div>
    );
  }
  return (
    <div style={{
      width: 480,
      height: 480,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <h3 style={{
        marginBottom: '16px',
        color: 'white',
        fontSize: '18px',
        fontWeight: 800,
        textAlign: 'center'
      }}>
        {province} Province
      </h3>
      <img
        src={`/maps/${provinceImageMap[province]}`}
        alt={province}
        style={{
          width: 460,
          height: 'auto',
          borderRadius: 8,
          border: '2px solid #e0e0e0',
          boxShadow: '0 4px 16px rgba(25, 118, 210, 0.15)'
        }}
        loading="lazy"
        onError={e => {
          e.target.onerror = null;
          e.target.src = '/maps/ajk.png';
        }}
      />
    </div>
  );
}

export default ProvinceImage; 