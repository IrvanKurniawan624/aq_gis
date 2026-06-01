import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  CircleMarker,
  GeoJSON,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip as LeafletTooltip,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart2, Clock3, ExternalLink, Layers, Loader2, LocateFixed, MapPin, X } from 'lucide-react';

const SURABAYA_CENTER = [-7.2504, 112.7688];

// Surabaya bounding box approximately
const SURABAYA_BOUNDS = [
  [-7.4, 112.5], // SouthWest
  [-7.1, 112.9]  // NorthEast
];
const HEATMAP_LAYER_TYPES = [
  { label: 'US AQI', value: 'US_AQI' },
  { label: 'PM2.5', value: 'PM25_INDIGO_PERSIAN' },
];
const DISTRICT_AQI_LEGEND = [
  { label: 'Good', range: '0-50', colors: ['#6ee7b7', '#059669'] },
  { label: 'Moderate', range: '51-100', colors: ['#fde68a', '#ca8a04'] },
  { label: 'Sensitive groups', range: '101-150', colors: ['#fdba74', '#ea580c'] },
  { label: 'Unhealthy', range: '151-200', colors: ['#fca5a5', '#dc2626'] },
  { label: 'Very unhealthy', range: '201-300', colors: ['#d8b4fe', '#9333ea'] },
  { label: 'Hazardous', range: '301+', colors: ['#be123c', '#4c0519'] },
  { label: 'No data', range: '', colors: ['#334155', '#334155'] },
];
const DEFAULT_REFRESH_INTERVAL_HOURS = 1;

function interpolateHexColor(startColor, endColor, ratio) {
  const clampedRatio = Math.min(Math.max(ratio, 0), 1);
  const start = Number.parseInt(startColor.slice(1), 16);
  const end = Number.parseInt(endColor.slice(1), 16);
  const channels = [16, 8, 0].map((shift) => {
    const startChannel = (start >> shift) & 0xff;
    const endChannel = (end >> shift) & 0xff;
    return Math.round(startChannel + ((endChannel - startChannel) * clampedRatio));
  });

  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function getAqiHexColor(aqi) {
  if (aqi === null || aqi === undefined) return '#334155';
  if (aqi <= 50) return interpolateHexColor('#6ee7b7', '#059669', aqi / 50);
  if (aqi <= 100) return interpolateHexColor('#fde68a', '#ca8a04', (aqi - 51) / 49);
  if (aqi <= 150) return interpolateHexColor('#fdba74', '#ea580c', (aqi - 101) / 49);
  if (aqi <= 200) return interpolateHexColor('#fca5a5', '#dc2626', (aqi - 151) / 49);
  if (aqi <= 300) return interpolateHexColor('#d8b4fe', '#9333ea', (aqi - 201) / 99);
  return interpolateHexColor('#be123c', '#4c0519', (aqi - 301) / 199);
}

function formatMetric(value, decimals = 1) {
  if (value === null || value === undefined) return 'No data';
  return Number(value).toFixed(decimals);
}

function formatMeasuredOn(dateValue, options) {
  if (!dateValue) return 'No data';

  return new Date(dateValue.replace(' ', 'T')).toLocaleString('en-US', options);
}

function isInsideSurabayaBounds(latitude, longitude) {
  return latitude >= SURABAYA_BOUNDS[0][0]
    && latitude <= SURABAYA_BOUNDS[1][0]
    && longitude >= SURABAYA_BOUNDS[0][1]
    && longitude <= SURABAYA_BOUNDS[1][1];
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

function getFeatureCenter(feature) {
  const points = getFeatureBounds(feature);

  if (points.length === 0) return null;

  const latitudes = points.map(([latitude]) => latitude);
  const longitudes = points.map(([, longitude]) => longitude);

  return [
    (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
  ];
}

const DistrictHistoryModal = ({ districtName, onClose }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadRows = async () => {
      try {
        const params = new URLSearchParams({ days: '30', name: districtName });
        const response = await fetch(`/api/kecamatan/history?${params.toString()}`);

        if (response.ok && active) setRows(await response.json());
      } catch (error) {
        console.warn(`Could not load 30-day history for ${districtName}.`, error.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadRows();

    return () => {
      active = false;
    };
  }, [districtName]);

  const chartData = useMemo(() => rows.map((row) => ({
    ...row,
    date: formatMeasuredOn(row.measured_on, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  })), [rows]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-[#493b2f]/25 p-4 backdrop-blur-sm">
      <section className="flex w-full max-w-4xl flex-col overflow-hidden rounded-[18px] border border-[var(--resident-border)] bg-[var(--resident-surface)] shadow-[var(--resident-shadow)]">
        <header className="flex items-center justify-between border-b border-[var(--resident-border)] p-5">
          <div>
            <p className="resident-eyebrow">Kecamatan hourly history</p>
            <h2 className="mt-1 text-xl font-bold">{districtName}</h2>
            <p className="mt-1 text-xs text-[var(--resident-muted)]">Last 30 days of retained hourly Google AQ estimates</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--resident-border)] p-2 text-[var(--resident-muted)] hover:border-[var(--resident-border-strong)] hover:text-[var(--resident-fg)]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="h-[420px] p-5">
          {loading ? (
            <div className="flex h-full items-center justify-center text-[var(--resident-muted)]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading 30-day hourly history...
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-[var(--resident-muted)]">
              No retained hourly history is available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 10, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3d8c4" vertical={false} />
                <XAxis dataKey="date" stroke="#8b7962" fontSize={11} tickMargin={8} minTickGap={32} />
                <YAxis stroke="#8b7962" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fffdf8',
                    borderColor: '#d8c9ae',
                    color: '#493b2f',
                    borderRadius: '0.5rem',
                    fontSize: '11px',
                  }}
                />
                <Line type="monotone" name="US AQI" dataKey="us_aqi" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                <Line type="monotone" name="PM2.5" dataKey="pm2_5" stroke="#15803d" strokeWidth={2} dot={false} />
                <Line type="monotone" name="PM10" dataKey="pm10" stroke="#dc2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
};

const DistrictDetailPopup = ({ reading, refreshIntervalHours, onOpenHistory }) => {
  const [historyRows, setHistoryRows] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState('current');

  useEffect(() => {
    if (activeTab !== 'trend') return undefined;

    let active = true;

    const loadHistory = async () => {
      try {
        const params = new URLSearchParams({
          days: '1',
          name: reading.name,
        });
        const response = await fetch(`/api/kecamatan/history?${params.toString()}`);

        if (response.ok && active) {
          setHistoryRows(await response.json());
        }
      } catch (error) {
        console.warn(`Could not load air quality history for ${reading.name}.`, error.message);
      } finally {
        if (active) setLoadingHistory(false);
      }
    };

    setLoadingHistory(true);
    loadHistory();
    const refreshTimer = setInterval(
      loadHistory,
      refreshIntervalHours * 60 * 60 * 1000,
    );

    return () => {
      active = false;
      clearInterval(refreshTimer);
    };
  }, [activeTab, reading.name, refreshIntervalHours]);

  const chartData = useMemo(() => {
    const latestTimestamp = historyRows.reduce((latest, row) => {
      const timestamp = new Date(row.measured_on.replace(' ', 'T')).getTime();
      return Number.isNaN(timestamp) ? latest : Math.max(latest, timestamp);
    }, 0);
    const cutoff = latestTimestamp - (24 * 60 * 60 * 1000);

    return historyRows
      .filter((row) => {
        const timestamp = new Date(row.measured_on.replace(' ', 'T')).getTime();
        return Number.isNaN(timestamp) || timestamp >= cutoff;
      })
      .map((row) => ({
        ...row,
        date: formatMeasuredOn(row.measured_on, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      }));
  }, [historyRows]);

  const metrics = [
    { label: 'US AQI', value: formatMetric(reading.us_aqi, 0), unit: '', accent: '#d38b25' },
    { label: 'PM2.5', value: formatMetric(reading.pm2_5), unit: 'ug/m3', accent: '#16865a' },
    { label: 'PM10', value: formatMetric(reading.pm10), unit: 'ug/m3', accent: '#c85d3d' },
    { label: 'NO2', value: formatMetric(reading.nitrogen_dioxide), unit: 'ppb', accent: '#4776a6' },
    { label: 'Ozone', value: formatMetric(reading.ozone), unit: 'ppb', accent: '#8b5da7' },
  ];

  return (
    <div className="w-[min(390px,calc(100vw-48px))] bg-[var(--resident-surface)] text-[var(--resident-fg)]">
      <div className="border-b border-[var(--resident-border)] bg-[var(--resident-surface)] py-3 pl-4 pr-14">
        <p className="resident-eyebrow text-[var(--resident-accent-dark)]">
          Kecamatan Detail
        </p>
        <h3 className="mt-1 text-lg font-bold">{reading.name}</h3>
        <p className="mt-1 text-xs text-[var(--resident-muted)]">Google AQ district estimate</p>
      </div>

      <div className="border-b border-[var(--resident-border)] px-4 py-2">
        <div className="flex rounded-lg bg-[var(--resident-surface-2)] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('current')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'current'
                ? 'bg-[var(--resident-accent)] text-[var(--resident-accent-dark)]'
                : 'text-[var(--resident-muted)] hover:bg-[var(--resident-surface)]'
            }`}
          >
            Current Data
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('trend')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'trend'
                ? 'bg-[var(--resident-accent)] text-[var(--resident-accent-dark)]'
                : 'text-[var(--resident-muted)] hover:bg-[var(--resident-surface)]'
            }`}
          >
            Hourly Trend
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        {activeTab === 'current' ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg border border-[var(--resident-border)] bg-[var(--resident-surface-2)] px-2.5 py-2"
                  style={{ boxShadow: `inset 3px 0 0 ${metric.accent}` }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--resident-muted)]">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {metric.value}
                    {metric.unit && <span className="ml-1 text-[10px] font-medium text-[var(--resident-muted)]">{metric.unit}</span>}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-[var(--resident-muted)]">
              Updated {formatMeasuredOn(reading.measured_on)}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-[var(--resident-muted)]">Last 24 hours</p>
              <div className="flex items-center gap-1 text-[10px] text-[var(--resident-accent-dark)]">
                <Clock3 className="h-3 w-3" />
                Latest: {formatMeasuredOn(reading.measured_on, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </div>
            </div>

            <div className="mt-2 h-[140px] w-full rounded-lg border border-[var(--resident-border)] bg-[var(--resident-surface-2)] p-1 sm:h-[170px]">
              {loadingHistory ? (
                <div className="flex h-full items-center justify-center text-[var(--resident-muted)]">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  <span className="text-xs">Loading hourly history...</span>
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-[var(--resident-muted)]">
                  No hourly history is available yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 5, bottom: 0, left: -24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3d8c4" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#8b7962"
                      fontSize={10}
                      tickMargin={6}
                      minTickGap={18}
                    />
                    <YAxis stroke="#8b7962" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fffdf8',
                        borderColor: '#d8c9ae',
                        color: '#493b2f',
                        borderRadius: '0.5rem',
                        fontSize: '11px',
                      }}
                    />
                    <Line type="monotone" name="US AQI" dataKey="us_aqi" stroke="#2563eb" strokeWidth={2.5} dot />
                    <Line type="monotone" name="PM2.5" dataKey="pm2_5" stroke="#15803d" strokeWidth={2} dot />
                    <Line type="monotone" name="PM10" dataKey="pm10" stroke="#dc2626" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenHistory}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--resident-border)] bg-[var(--resident-surface)] px-3 py-2 text-xs font-bold text-[var(--resident-accent-dark)] hover:border-[var(--resident-border-strong)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View 30-day hourly detail
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const MapController = ({
  centerMapTrigger,
  focusedFeature,
  locationFocusTrigger,
  userLocation,
}) => {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });
    const resizeTimer = setTimeout(() => {
      map.invalidateSize({ pan: false });
    }, 0);

    resizeObserver.observe(container);

    return () => {
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
    };
  }, [map]);
  
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

  useEffect(() => {
    if (!userLocation || locationFocusTrigger === 0) return;

    map.flyTo([userLocation.latitude, userLocation.longitude], 15);
  }, [locationFocusTrigger, map, userLocation]);

  return null;
};

const MapView = ({ focusedLocation, onResetLocation, onSelectLocation }) => {
  const [centerMapTrigger, setCenterMapTrigger] = useState(0);
  const [districtGeoJson, setDistrictGeoJson] = useState(null);
  const [hasGoogleAQ, setHasGoogleAQ] = useState(false);
  const [mapMode, setMapMode] = useState('clean');
  const [selectedLayerType, setSelectedLayerType] = useState('US_AQI');
  const [kecamatanReadings, setKecamatanReadings] = useState([]);
  const [refreshIntervalHours, setRefreshIntervalHours] = useState(DEFAULT_REFRESH_INTERVAL_HOURS);
  const [userLocation, setUserLocation] = useState(null);
  const [locationFocusTrigger, setLocationFocusTrigger] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [historyDistrictName, setHistoryDistrictName] = useState(null);
  const focusedLocationRef = useRef(focusedLocation);

  useEffect(() => {
    focusedLocationRef.current = focusedLocation;
  }, [focusedLocation]);

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

  const focusedReading = useMemo(() => {
    return focusedLocation ? kecamatanByName.get(focusedLocation) : null;
  }, [focusedLocation, kecamatanByName]);

  const districtLabels = useMemo(() => {
    return (districtGeoJson?.features || [])
      .map((feature) => ({
        name: feature.properties?.name,
        position: getFeatureCenter(feature),
      }))
      .filter((label) => label.name && label.position);
  }, [districtGeoJson]);

  const modeOptions = useMemo(() => {
    const options = [
      { mode: 'clean', icon: MapPin, label: 'Base Map' },
      { mode: 'choropleth', icon: BarChart2, label: 'Google AQ Districts' },
    ];

    if (hasGoogleAQ) {
      options.splice(1, 0, { mode: 'heatmap', icon: Layers, label: 'Google AQ Heatmap' });
    }

    return options;
  }, [hasGoogleAQ]);

  const handleReset = () => {
    setCenterMapTrigger(prev => prev + 1);
    setLocationError('');
    setUserLocation(null);
    onResetLocation();
  };

  const handleLocateMe = () => {
    if (userLocation) {
      setUserLocation(null);
      return;
    }

    if (!navigator.geolocation) {
      setLocationError('Location access is not supported by this browser.');
      return;
    }

    setIsLocating(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!isInsideSurabayaBounds(coords.latitude, coords.longitude)) {
          setLocationError('Your location is outside the Surabaya map area.');
          setIsLocating(false);
          return;
        }

        setUserLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        });
        setLocationFocusTrigger(prev => prev + 1);
        setIsLocating(false);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied.'
          : 'Your current location could not be determined.';
        setLocationError(message);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
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
    const showDistrictAqiFill = mapMode === 'choropleth';

    return {
      color: isFocused ? '#8b5e2c' : '#b9a78d',
      weight: isFocused ? 5 : 1,
      opacity: 0.85,
      fillColor: isFocused
        ? '#e0b448'
        : showDistrictAqiFill ? getAqiHexColor(aqi) : 'transparent',
      fillOpacity: isFocused
        ? 0.18
        : showDistrictAqiFill ? 0.65 : 0,
    };
  };

  const bindDistrictInteractions = (feature, layer) => {
    const name = feature.properties?.name;

    if (name) {
      layer.on('click', () => {
        focusedLocationRef.current = name;
        onSelectLocation(name);
      });
    }

  };

  return (
    <>
      <div className="relative z-0 h-full w-full overflow-hidden rounded-2xl border border-[var(--resident-border)] bg-[var(--resident-map-bg)] shadow-[var(--resident-shadow)]">
      <div className="absolute left-2 right-2 top-2 z-[1000] flex flex-col gap-2 sm:left-4 sm:right-auto sm:top-4">
        <div className="flex max-w-full flex-wrap overflow-hidden rounded-xl border border-[var(--resident-border)] bg-[var(--resident-surface)] p-1 shadow-[var(--resident-shadow)]">
          {modeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = mapMode === option.mode;

            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => setMapMode(option.mode)}
                className={`flex items-center gap-1.5 px-2 py-2 text-[10px] font-semibold transition-all sm:px-2.5 sm:text-xs ${
                  isActive
                    ? 'rounded-lg bg-[var(--resident-accent-soft)] text-[var(--resident-accent-dark)]'
                    : 'text-[var(--resident-muted)] hover:bg-[var(--resident-surface-2)] hover:text-[var(--resident-fg)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {option.label}
              </button>
            );
          })}
        </div>

        {mapMode === 'heatmap' && hasGoogleAQ && (
          <div className="flex max-w-full flex-wrap gap-1 rounded-xl border border-[var(--resident-border)] bg-[var(--resident-surface)] p-1 shadow-[var(--resident-shadow)]">
            <span className="px-2 py-1 text-[10px] font-semibold text-[var(--resident-muted)] sm:text-xs">Google AQ Layer:</span>
            {HEATMAP_LAYER_TYPES.map((layerType) => (
              <button
                key={layerType.value}
                type="button"
                onClick={() => setSelectedLayerType(layerType.value)}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors sm:text-xs ${
                  selectedLayerType === layerType.value
                    ? 'bg-[var(--resident-accent-soft)] text-[var(--resident-accent-dark)]'
                    : 'text-[var(--resident-muted)] hover:bg-[var(--resident-surface-2)] hover:text-[var(--resident-fg)]'
                }`}
              >
                {layerType.label}
              </button>
            ))}
          </div>
        )}
      </div>
      
      <div className="absolute right-2 top-28 z-[1000] flex flex-col items-end gap-2 sm:right-4 sm:top-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            className={`flex items-center gap-1.5 rounded-xl border p-2 text-xs font-semibold shadow-[var(--resident-shadow)] transition-all sm:gap-2 sm:text-sm ${
              userLocation
                ? 'border-[var(--resident-border-strong)] bg-[var(--resident-accent-soft)] text-[var(--resident-accent-dark)]'
                : 'border-[var(--resident-border)] bg-[var(--resident-surface)] text-[var(--resident-fg)] hover:border-[var(--resident-border-strong)]'
            } disabled:cursor-wait disabled:opacity-70`}
          >
            {isLocating
              ? <Loader2 className="h-4 w-4 animate-spin text-[var(--resident-accent-dark)]" />
              : <LocateFixed className="h-4 w-4 text-[var(--resident-accent-dark)]" />}
            My Location
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--resident-border)] bg-[var(--resident-surface)] p-2 text-xs font-semibold text-[var(--resident-fg)] shadow-[var(--resident-shadow)] transition-all hover:border-[var(--resident-border-strong)] sm:gap-2 sm:text-sm"
          >
            <MapPin className="h-4 w-4 text-[var(--resident-accent-dark)]" />
            Reset Position
          </button>
        </div>
        {locationError && (
          <p className="max-w-64 rounded-lg border border-red-300 bg-[var(--resident-surface)] px-3 py-2 text-xs text-red-700 shadow-lg">
            {locationError}
          </p>
        )}
      </div>

      {mapMode === 'choropleth' && (
        <div className="absolute bottom-8 left-4 z-[1000] rounded-xl border border-[var(--resident-border)] bg-[var(--resident-surface)] p-3 shadow-[var(--resident-shadow)]">
          <p className="resident-eyebrow mb-2">
            US AQI District Colors
          </p>
          <p className="mb-2 text-[10px] text-[var(--resident-muted)]">Darker shade = higher AQI within category</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {DISTRICT_AQI_LEGEND.map((category) => (
              <div key={category.label} className="flex items-center gap-2">
                <span
                  className="h-3 w-6 rounded-sm border border-white/20"
                  style={{
                    background: `linear-gradient(to right, ${category.colors[0]}, ${category.colors[1]})`,
                  }}
                />
                <span className="text-[10px] text-[var(--resident-muted)]">
                  {category.label}{category.range && ` (${category.range})`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />

        {hasGoogleAQ && mapMode === 'heatmap' && (
          <TileLayer
            key={selectedLayerType}
            url={`/api/tiles/${selectedLayerType}/{z}/{x}/{y}`}
            opacity={selectedLayerType === 'US_AQI' ? 0.42 : 0.6}
          />
        )}
        
        <MapController
          centerMapTrigger={centerMapTrigger}
          focusedFeature={focusedFeature}
          locationFocusTrigger={locationFocusTrigger}
          userLocation={userLocation}
        />

        {userLocation && (
          <>
            <Circle
              center={[userLocation.latitude, userLocation.longitude]}
              radius={userLocation.accuracy}
              interactive={false}
              pathOptions={{
                color: '#9b6c2f',
                fillColor: '#e0b448',
                fillOpacity: 0.12,
                weight: 1,
              }}
            />
            <CircleMarker
              center={[userLocation.latitude, userLocation.longitude]}
              radius={7}
              interactive={false}
              pathOptions={{
                color: '#fffdf8',
                fillColor: '#9b6c2f',
                fillOpacity: 1,
                weight: 3,
              }}
            />
          </>
        )}

        {/* Kecamatan outlines without solid fill */}
        {districtGeoJson && (
          <GeoJSON 
            key={`districts-${mapMode}-${selectedLayerType}-${focusedLocation}-${districtLayerKey}`}
            data={districtGeoJson} 
            style={getDistrictStyle}
            onEachFeature={bindDistrictInteractions}
          />
        )}

        {districtLabels.map((label) => (
          <CircleMarker
            key={`district-label-${label.name}`}
            center={label.position}
            radius={1}
            pathOptions={{ opacity: 0, fillOpacity: 0 }}
            interactive={false}
          >
            <LeafletTooltip
              permanent
              direction="center"
              className="kecamatan-map-label"
              opacity={1}
            >
              {label.name}
            </LeafletTooltip>
          </CircleMarker>
        ))}

        {focusedReading && (
          <Popup
            key={focusedReading.name}
            position={[Number(focusedReading.centroid_lat), Number(focusedReading.centroid_lon)]}
            minWidth={280}
            maxWidth={440}
            className="kecamatan-detail-popup"
            eventHandlers={{
              remove: () => {
                if (focusedLocationRef.current === focusedReading.name) {
                  onResetLocation();
                }
              },
            }}
          >
            <DistrictDetailPopup
              reading={focusedReading}
              refreshIntervalHours={refreshIntervalHours}
              onOpenHistory={() => setHistoryDistrictName(focusedReading.name)}
            />
          </Popup>
        )}

      </MapContainer>
      
      <div className="pointer-events-none absolute inset-0 z-[400] rounded-2xl shadow-[inset_0_0_42px_rgba(164,126,73,0.12)]"></div>
      </div>
      {historyDistrictName && (
        <DistrictHistoryModal
          districtName={historyDistrictName}
          onClose={() => setHistoryDistrictName(null)}
        />
      )}
    </>
  );
};

export default MapView;
