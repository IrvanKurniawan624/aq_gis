import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getAqiColor } from '../data/mockApiData';
import { BarChart2, Layers, MapPin } from 'lucide-react';

const SURABAYA_CENTER = [-7.2504, 112.7688];

// Surabaya bounding box approximately
const SURABAYA_BOUNDS = [
  [-7.4, 112.5], // SouthWest
  [-7.1, 112.9]  // NorthEast
];
const HEATMAP_LAYER_TYPES = [
  { label: 'AQI', value: 'UAQI_INDIGO_PERSIAN' },
  { label: 'US AQI', value: 'US_AQI' },
  { label: 'PM2.5', value: 'PM25_INDIGO_PERSIAN' },
];

function getAqiHexColor(aqi) {
  if (aqi === null || aqi === undefined) return '#334155';
  if (aqi <= 50) return '#10b981';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#a855f7';
  return '#881337';
}

function formatMetric(value, decimals = 1) {
  if (value === null || value === undefined) return 'No data';
  return Number(value).toFixed(decimals);
}

const MapController = ({ readings, centerMapTrigger }) => {
  const map = useMap();
  
  useEffect(() => {
    map.flyTo(SURABAYA_CENTER, 12);
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
  const [centerMapTrigger, setCenterMapTrigger] = useState(0);
  const [districtGeoJson, setDistrictGeoJson] = useState(null);
  const [hasGoogleAQ, setHasGoogleAQ] = useState(false);
  const [mapMode, setMapMode] = useState('clean');
  const [selectedLayerType, setSelectedLayerType] = useState('UAQI_INDIGO_PERSIAN');
  const [kecamatanReadings, setKecamatanReadings] = useState([]);

  const kecamatanByName = useMemo(() => {
    return new Map(kecamatanReadings.map((reading) => [reading.name, reading]));
  }, [kecamatanReadings]);

  const districtLayerKey = useMemo(() => {
    return kecamatanReadings
      .map((reading) => `${reading.name}:${reading.measured_on}:${reading.us_aqi}`)
      .join('|');
  }, [kecamatanReadings]);

  const modeOptions = useMemo(() => {
    const options = [
      { mode: 'clean', icon: MapPin, title: 'Clean map' },
      { mode: 'choropleth', icon: BarChart2, title: 'District choropleth' },
    ];

    if (hasGoogleAQ) {
      options.splice(1, 0, { mode: 'heatmap', icon: Layers, title: 'Google AQ heatmap' });
    }

    return options;
  }, [hasGoogleAQ]);

  const handleReset = () => {
    setCenterMapTrigger(prev => prev + 1);
  };

  useEffect(() => {
    const loadDistrictBoundaries = async () => {
      try {
        const response = await fetch('/data/surabaya_kecamatan.json');

        if (response.ok) {
          setDistrictGeoJson(await response.json());
        }
      } catch (error) {
        console.warn('Could not load Surabaya district boundaries.', error.message);
      }
    };

    loadDistrictBoundaries();
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/config');

        if (!response.ok) {
          setHasGoogleAQ(false);
          setMapMode('clean');
          return;
        }

        const config = await response.json();
        const googleEnabled = Boolean(config.hasGoogleAQ);
        setHasGoogleAQ(googleEnabled);
        setMapMode(currentMode => {
          if (currentMode === 'heatmap' && !googleEnabled) return 'clean';
          if (currentMode === 'clean' && googleEnabled) return 'heatmap';
          return currentMode;
        });
      } catch (error) {
        console.warn('Could not load map configuration.', error.message);
        setHasGoogleAQ(false);
        setMapMode('clean');
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    const loadKecamatanReadings = async () => {
      try {
        const response = await fetch('/api/kecamatan/latest');

        if (response.ok) {
          setKecamatanReadings(await response.json());
        }
      } catch (error) {
        console.warn('Could not load kecamatan air quality data.', error.message);
      }
    };

    loadKecamatanReadings();
  }, []);

  const getDistrictReading = (feature) => {
    return kecamatanByName.get(feature.properties?.name);
  };

  const getDistrictStyle = (feature) => {
    const reading = getDistrictReading(feature);
    const aqi = reading?.us_aqi ?? null;

    return {
      color: '#e2e8f0',
      weight: 1,
      opacity: 0.85,
      fillColor: mapMode === 'choropleth' ? getAqiHexColor(aqi) : 'transparent',
      fillOpacity: mapMode === 'choropleth' ? 0.65 : 0,
    };
  };

  const bindDistrictTooltip = (feature, layer) => {
    const name = feature.properties?.name || 'Kecamatan';
    const reading = getDistrictReading(feature);
    const aqi = reading?.us_aqi ?? null;
    const colorInfo = aqi === null ? { label: 'No data' } : getAqiColor(Number(aqi));
    const aqiText = aqi === null ? 'No data' : Math.round(Number(aqi));
    const pm25Text = reading?.pm2_5 === null || reading?.pm2_5 === undefined
      ? 'No data'
      : `${formatMetric(reading.pm2_5)} µg/m³`;

    layer.bindTooltip(
      `<strong>${name}</strong><br>AQI: ${aqiText} - ${colorInfo.label}<br>PM2.5: ${pm25Text}`,
      { sticky: true },
    );
  };

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl relative z-0">
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <div className="flex overflow-hidden rounded-lg border border-slate-600 bg-slate-800/90 shadow-lg backdrop-blur-sm">
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = mapMode === option.mode;

            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => setMapMode(option.mode)}
                title={option.title}
                className={`p-2 transition-all ${
                  isActive
                    ? 'bg-blue-500/90 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>

        {mapMode === 'heatmap' && hasGoogleAQ && (
          <div className="flex gap-1 rounded-lg border border-slate-600 bg-slate-800/90 p-1 shadow-lg backdrop-blur-sm">
            {HEATMAP_LAYER_TYPES.map((layerType) => (
              <button
                key={layerType.value}
                type="button"
                onClick={() => setSelectedLayerType(layerType.value)}
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                  selectedLayerType === layerType.value
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {layerType.label}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Reset Position Button */}
      <button 
        type="button"
        onClick={handleReset}
        className="absolute top-4 right-4 z-[1000] bg-slate-800/90 hover:bg-slate-700 text-white p-2 rounded-lg shadow-lg border border-slate-600 backdrop-blur-sm transition-all flex items-center gap-2 text-sm font-medium"
      >
        <MapPin className="w-4 h-4 text-blue-400" />
        Reset Position
      </button>

      <MapContainer 
        center={SURABAYA_CENTER} 
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

        {hasGoogleAQ && mapMode === 'heatmap' && (
          <TileLayer
            url={`/api/tiles/${selectedLayerType}/{z}/{x}/{y}`}
            opacity={0.6}
          />
        )}
        
        <MapController readings={readings} centerMapTrigger={centerMapTrigger} />

        {/* Kecamatan outlines without solid fill */}
        {districtGeoJson && (
          <GeoJSON 
            key={`districts-${mapMode}-${districtLayerKey}`}
            data={districtGeoJson} 
            style={getDistrictStyle}
            onEachFeature={mapMode === 'choropleth' ? bindDistrictTooltip : undefined}
          />
        )}

        {/* Individual Station Markers */}
        {readings && readings.map((reading, idx) => {
          const aqi = Number(reading.us_aqi) || 0;
          const colorInfo = getAqiColor(aqi);
          const hexColor = getAqiHexColor(aqi);

          return (
            <CircleMarker
              key={reading.reading_id || reading.id || idx}
              center={[reading.latitude, reading.longitude]}
              radius={14}
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
                      AQI: {Math.round(aqi)}
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
                    <div className="flex justify-between">
                      <span className="text-slate-400">SO2</span>
                      <span className="font-medium">{Number(reading.sulphur_dioxide || 0).toFixed(1)} µg/m³</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">CO</span>
                      <span className="font-medium">{Number(reading.carbon_monoxide || 0).toFixed(1)} µg/m³</span>
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
