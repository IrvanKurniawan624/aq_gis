import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getAqiColor } from '../data/aqi';
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
const BASEMAP_OPTIONS = [
  {
    id: 'dark',
    label: 'Dark',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  },
  {
    id: 'street',
    label: 'Street',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  {
    id: 'satellite',
    label: 'Satellite',
    attribution: 'Tiles &copy; Esri',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  },
  {
    id: 'topographic',
    label: 'Topographic',
    attribution: 'Tiles &copy; Esri',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  },
];
const DEFAULT_REFRESH_INTERVAL_HOURS = 1;

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

function getFeatureBounds(feature) {
  const points = [];

  const collectPoints = (coordinates) => {
    if (!Array.isArray(coordinates)) return;

    if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      points.push([coordinates[1], coordinates[0]]);
      return;
    }

    coordinates.forEach(collectPoints);
  };

  collectPoints(feature?.geometry?.coordinates);
  return points;
}

const MapController = ({ centerMapTrigger, focusedFeature }) => {
  const map = useMap();
  
  useEffect(() => {
    if (focusedFeature) {
      const bounds = getFeatureBounds(focusedFeature);

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
        return;
      }
    }

    map.flyTo(SURABAYA_CENTER, 12);
  }, [centerMapTrigger, focusedFeature, map]);

  return null;
};

const MapView = ({ focusedLocation, onResetLocation }) => {
  const [centerMapTrigger, setCenterMapTrigger] = useState(0);
  const [districtGeoJson, setDistrictGeoJson] = useState(null);
  const [hasGoogleAQ, setHasGoogleAQ] = useState(false);
  const [mapMode, setMapMode] = useState('clean');
  const [selectedBasemapId, setSelectedBasemapId] = useState('dark');
  const [selectedLayerType, setSelectedLayerType] = useState('UAQI_INDIGO_PERSIAN');
  const [kecamatanReadings, setKecamatanReadings] = useState([]);
  const [refreshIntervalHours, setRefreshIntervalHours] = useState(DEFAULT_REFRESH_INTERVAL_HOURS);

  const kecamatanByName = useMemo(() => {
    return new Map(kecamatanReadings.map((reading) => [reading.name, reading]));
  }, [kecamatanReadings]);

  const districtLayerKey = useMemo(() => {
    return kecamatanReadings
      .map((reading) => `${reading.name}:${reading.measured_on}:${reading.us_aqi}`)
      .join('|');
  }, [kecamatanReadings]);

  const focusedFeature = useMemo(() => {
    return districtGeoJson?.features?.find(
      (feature) => feature.properties?.name === focusedLocation,
    ) || null;
  }, [districtGeoJson, focusedLocation]);

  const selectedBasemap = BASEMAP_OPTIONS.find((option) => option.id === selectedBasemapId)
    || BASEMAP_OPTIONS[0];

  const modeOptions = useMemo(() => {
    const options = [
      { mode: 'clean', icon: MapPin, label: 'No AQ Overlay' },
      { mode: 'choropleth', icon: BarChart2, label: 'Google AQ Districts' },
    ];

    if (hasGoogleAQ) {
      options.splice(1, 0, { mode: 'heatmap', icon: Layers, label: 'Google AQ Heatmap' });
    }

    return options;
  }, [hasGoogleAQ]);

  const handleReset = () => {
    setCenterMapTrigger(prev => prev + 1);
    onResetLocation();
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
        const intervalHours = Number(config.fetchIntervalHours);
        setHasGoogleAQ(googleEnabled);
        setRefreshIntervalHours(
          Number.isFinite(intervalHours) && intervalHours > 0
            ? intervalHours
            : DEFAULT_REFRESH_INTERVAL_HOURS,
        );
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
    const refreshTimer = setInterval(
      loadKecamatanReadings,
      refreshIntervalHours * 60 * 60 * 1000,
    );

    return () => clearInterval(refreshTimer);
  }, [refreshIntervalHours]);

  const getDistrictReading = (feature) => {
    return kecamatanByName.get(feature.properties?.name);
  };

  const getDistrictStyle = (feature) => {
    const reading = getDistrictReading(feature);
    const aqi = reading?.us_aqi ?? null;
    const isFocused = feature.properties?.name === focusedLocation;

    return {
      color: isFocused ? '#60a5fa' : '#e2e8f0',
      weight: isFocused ? 4 : 1,
      opacity: 0.85,
      fillColor: isFocused
        ? '#3b82f6'
        : mapMode === 'choropleth' ? getAqiHexColor(aqi) : 'transparent',
      fillOpacity: isFocused ? 0.35 : mapMode === 'choropleth' ? 0.65 : 0,
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
      `<strong>${name}</strong><br>Provider: Google AQ<br>AQI: ${aqiText} - ${colorInfo.label}<br>PM2.5: ${pm25Text}`,
      { sticky: true },
    );
  };

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl relative z-0">
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <label className="flex w-fit items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/90 px-2.5 py-2 text-xs font-semibold text-slate-300 shadow-lg backdrop-blur-sm">
          Basemap:
          <select
            value={selectedBasemapId}
            onChange={(event) => setSelectedBasemapId(event.target.value)}
            className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {BASEMAP_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex w-fit flex-wrap overflow-hidden rounded-lg border border-slate-600 bg-slate-800/90 shadow-lg backdrop-blur-sm">
          <span className="px-2.5 py-2 text-xs font-semibold text-slate-300">AQ Overlay:</span>
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = mapMode === option.mode;

            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => setMapMode(option.mode)}
                className={`flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-500/90 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {option.label}
              </button>
            );
          })}
        </div>

        {mapMode === 'heatmap' && hasGoogleAQ && (
          <div className="flex gap-1 rounded-lg border border-slate-600 bg-slate-800/90 p-1 shadow-lg backdrop-blur-sm">
            <span className="px-2 py-1 text-xs font-semibold text-slate-300">Google AQ Layer:</span>
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
          key={selectedBasemap.id}
          attribution={selectedBasemap.attribution}
          url={selectedBasemap.url}
          zIndex={0}
        />

        {hasGoogleAQ && mapMode === 'heatmap' && (
          <TileLayer
            url={`/api/tiles/${selectedLayerType}/{z}/{x}/{y}`}
            opacity={0.6}
            zIndex={100}
          />
        )}
        
        <MapController centerMapTrigger={centerMapTrigger} focusedFeature={focusedFeature} />

        {/* Kecamatan outlines without solid fill */}
        {districtGeoJson && (
          <GeoJSON 
            key={`districts-${mapMode}-${focusedLocation}-${districtLayerKey}`}
            data={districtGeoJson} 
            style={getDistrictStyle}
            onEachFeature={mapMode === 'choropleth' ? bindDistrictTooltip : undefined}
          />
        )}

      </MapContainer>
      
      <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_50px_rgba(15,23,42,0.8)] z-[400]"></div>
    </div>
  );
};

export default MapView;
