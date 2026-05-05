import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { mockCities, getAqiColor } from '../data/mockApiData';
import surabayaGeoJson from '../data/surabaya.json';
import { MapPin } from 'lucide-react';

// Surabaya bounding box approximately
const SURABAYA_BOUNDS = [
  [-7.4, 112.5], // SouthWest
  [-7.1, 112.9]  // NorthEast
];

const MapController = ({ readings, centerMapTrigger }) => {
  const map = useMap();
  
  useEffect(() => {
    map.flyTo([mockCities[0].latitude, mockCities[0].longitude], 12);
  }, [centerMapTrigger, map]);

  useEffect(() => {
    if (readings && readings.length === 1) {
       // Only 1 reading, just fly to it
       map.flyTo([readings[0].latitude, readings[0].longitude], 12);
    }
  }, [readings, map]);

  return null;
};

const MapView = ({ readings }) => {
  const surabaya = mockCities[0];
  const [centerMapTrigger, setCenterMapTrigger] = useState(0);

  const handleReset = () => {
    setCenterMapTrigger(prev => prev + 1);
  };

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl relative z-0">
      
      {/* Reset Position Button */}
      <button 
        onClick={handleReset}
        className="absolute top-4 right-4 z-[1000] bg-slate-800/90 hover:bg-slate-700 text-white p-2 rounded-lg shadow-lg border border-slate-600 backdrop-blur-sm transition-all flex items-center gap-2 text-sm font-medium"
      >
        <MapPin className="w-4 h-4 text-blue-400" />
        Reset Position
      </button>

      <MapContainer 
        center={[surabaya.latitude, surabaya.longitude]} 
        zoom={12} 
        minZoom={11}
        maxBounds={SURABAYA_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapController readings={readings} centerMapTrigger={centerMapTrigger} />

        {/* Outline of Surabaya City without solid fill */}
        {surabayaGeoJson && (
          <GeoJSON 
            data={surabayaGeoJson} 
            style={{
              color: '#334155',
              weight: 2,
              fillColor: 'transparent',
              fillOpacity: 0,
              dashArray: '5, 5'
            }}
          />
        )}

        {/* Individual Station Markers */}
        {readings && readings.map((reading, idx) => {
          const colorInfo = getAqiColor(reading.us_aqi);
          let hexColor = '#3b82f6';
          if (reading.us_aqi <= 50) hexColor = '#10b981';
          else if (reading.us_aqi <= 100) hexColor = '#eab308';
          else if (reading.us_aqi <= 150) hexColor = '#f97316';
          else if (reading.us_aqi <= 200) hexColor = '#ef4444';
          else if (reading.us_aqi <= 300) hexColor = '#a855f7';
          else hexColor = '#881337';

          return (
            <CircleMarker
              key={reading.id || idx}
              center={[reading.latitude, reading.longitude]}
              radius={12}
              pathOptions={{
                color: '#1e293b',
                weight: 2,
                fillColor: hexColor,
                fillOpacity: 0.9,
              }}
            >
              <Popup className="aqi-popup">
                <div className="p-1 min-w-[200px]">
                  <h3 className="font-bold text-lg mb-1">{reading.location_name || 'Surabaya Area'}</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold bg-opacity-20 ${colorInfo.bg} ${colorInfo.text}`}>
                      AQI: {Math.round(Number(reading.us_aqi) || 0)}
                    </span>
                    <span className="text-xs text-slate-400">{colorInfo.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-3 border-t border-slate-600 pt-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">PM2.5</span>
                      <span className="font-medium">{Number(reading.pm2_5 || 0).toFixed(1)} µg/m³</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">PM10</span>
                      <span className="font-medium">{Number(reading.pm10 || 0).toFixed(1)} µg/m³</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">O3</span>
                      <span className="font-medium">{Number(reading.ozone || 0).toFixed(1)} µg/m³</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">NO2</span>
                      <span className="font-medium">{Number(reading.nitrogen_dioxide || 0).toFixed(1)} µg/m³</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-3 text-right">
                    Measured on: {new Date(reading.measured_on).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      
      <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_50px_rgba(15,23,42,0.8)] z-[400]"></div>
    </div>
  );
};

export default MapView;
