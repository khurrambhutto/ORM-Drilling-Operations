import React, { Suspense } from 'react';
const { MapContainer, TileLayer, Marker, Popup } = require('react-leaflet');
require('leaflet/dist/leaflet.css');

function WellMap({ latitude, longitude, wellName, blockName }) {
  if (!latitude || !longitude) return null;
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
        Well Location
      </h3>
      <Suspense fallback={<div>Loading map...</div>}>
        <MapContainer
          center={[latitude, longitude]}
          zoom={8}
          style={{ width: '440px', height: 440, borderRadius: 8 }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          />
          <Marker position={[latitude, longitude]}>
            <Popup>
              {wellName}<br />
              {blockName}
            </Popup>
          </Marker>
        </MapContainer>
      </Suspense>
    </div>
  );
}

export default WellMap; 