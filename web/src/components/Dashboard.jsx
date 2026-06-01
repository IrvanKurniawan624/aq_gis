import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Activity, Clock3, LineChart as LineChartIcon, Map, Search, Wind } from 'lucide-react';
import MapView from './MapView';
import StatCard from './StatCard';
import HistoryChart from './HistoryChart';
import { getAqiColor, getAqiGuidance } from '../data/aqi';

const DEFAULT_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_SOURCE = {
  name: 'open_meteo_current',
  label: 'Open-Meteo',
};

function formatLatestMeasuredOn(dateValue) {
  if (!dateValue) return 'No hourly update yet';

  return `${new Date(dateValue.replace(' ', 'T')).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })} WIB`;
}

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [readings, setReadings] = useState([]);
  const [readingSources, setReadingSources] = useState([DEFAULT_SOURCE]);
  const [selectedSource, setSelectedSource] = useState(DEFAULT_SOURCE.name);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(DEFAULT_REFRESH_INTERVAL_MS);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState(null);
  const [kecamatanReadings, setKecamatanReadings] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mobileTab, setMobileTab] = useState('overview');

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await axios.get('/api/config');
        const intervalHours = Number(response.data?.fetchIntervalHours);
        const sources = response.data?.cityReadingSources;

        if (Number.isFinite(intervalHours) && intervalHours > 0) {
          setRefreshIntervalMs(intervalHours * 60 * 60 * 1000);
        }

        if (Array.isArray(sources) && sources.length > 0) {
          setReadingSources(sources);
        }
      } catch (error) {
        console.warn('Could not load API configuration.', error.message);
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    const fetchLatestData = async () => {
      try {
        const response = await axios.get('/api/latest', {
          params: { source: selectedSource },
        });
        setReadings(response.data || []);
      } catch (error) {
        console.warn('Could not load current air-quality data.', error.message);
        setReadings([]);
      }
    };

    fetchLatestData();
    const refreshTimer = setInterval(fetchLatestData, refreshIntervalMs);

    return () => clearInterval(refreshTimer);
  }, [refreshIntervalMs, selectedSource]);

  useEffect(() => {
    const fetchKecamatanReadings = async () => {
      try {
        const response = await axios.get('/api/kecamatan/latest');
        setKecamatanReadings(response.data || []);
      } catch (error) {
        console.warn('Could not load kecamatan readings.', error.message);
      }
    };

    fetchKecamatanReadings();
  }, []);

  const kecamatanNames = useMemo(() => {
    return kecamatanReadings
      .map((reading) => reading.name)
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  }, [kecamatanReadings]);

  const selectedSourceLabel = readingSources.find((source) => source.name === selectedSource)?.label
    || DEFAULT_SOURCE.label;
  const latestMeasuredOn = useMemo(() => {
    return readings
      .map((reading) => reading.measured_on)
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left))[0] || null;
  }, [readings]);
  const matchingKecamatanNames = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery || selectedLocation) return [];

    return kecamatanNames
      .filter((name) => name.toLowerCase().includes(normalizedQuery))
      .slice(0, 6);
  }, [kecamatanNames, searchQuery, selectedLocation]);

  const leaderboard = useMemo(() => {
    const validReadings = kecamatanReadings
      .filter((r) => r.us_aqi !== null && r.us_aqi !== undefined)
      .map((r) => ({
        name: r.name,
        aqi: Number(r.us_aqi),
      }));

    if (validReadings.length === 0) return null;

    const sortedCleanest = [...validReadings].sort((a, b) => a.aqi - b.aqi);
    const sortedPolluted = [...validReadings].sort((a, b) => b.aqi - a.aqi);

    return {
      cleanest: sortedCleanest.slice(0, 3),
      polluted: sortedPolluted.slice(0, 3),
    };
  }, [kecamatanReadings]);
  const stats = useMemo(() => {
    if (readings.length === 0) return null;

    const aqiValues = readings
      .map((reading) => reading.us_aqi === null ? Number.NaN : Number(reading.us_aqi))
      .filter(Number.isFinite);
    const pm25Values = readings
      .map((reading) => reading.pm2_5 === null ? Number.NaN : Number(reading.pm2_5))
      .filter(Number.isFinite);
    const pm10Values = readings
      .map((reading) => reading.pm10 === null ? Number.NaN : Number(reading.pm10))
      .filter(Number.isFinite);
    const no2Values = readings
      .map((reading) => reading.nitrogen_dioxide === null ? Number.NaN : Number(reading.nitrogen_dioxide))
      .filter(Number.isFinite);
    const avgAqi = aqiValues.length > 0
      ? Math.round(aqiValues.reduce((sum, value) => sum + value, 0) / aqiValues.length)
      : null;
    const avgPm25 = pm25Values.length > 0
      ? (pm25Values.reduce((sum, value) => sum + value, 0) / pm25Values.length).toFixed(1)
      : 'No data';
    const avgPm10 = pm10Values.length > 0
      ? (pm10Values.reduce((sum, value) => sum + value, 0) / pm10Values.length).toFixed(1)
      : 'No data';
    const avgNo2 = no2Values.length > 0
      ? (no2Values.reduce((sum, value) => sum + value, 0) / no2Values.length).toFixed(1)
      : 'No data';

    return { avgAqi, avgPm25, avgPm10, avgNo2 };
  }, [readings]);

  const selectLocation = (locationName) => {
    setSearchQuery(locationName);
    setSelectedLocation(locationName);
    setMobileTab('map');
  };

  const handleSearch = () => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const exactMatch = kecamatanNames.find((name) => name.toLowerCase() === normalizedQuery);
    const nextLocation = exactMatch || matchingKecamatanNames[0];

    if (nextLocation) selectLocation(nextLocation);
  };

  const handleOpenHistory = () => {
    if (readings.length > 0) {
      setSelectedCityId(readings[0].city_id);
      setShowHistoryModal(true);
    }
  };

  return (
    <div className="h-screen w-full overflow-y-auto bg-[var(--resident-bg)] md:flex md:overflow-hidden">
      <nav className="flex border-b border-[var(--resident-border)] bg-[var(--resident-surface)] p-2 md:hidden">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'map', label: 'Map', icon: Map },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = mobileTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setMobileTab(item.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-[var(--resident-accent)] text-[var(--resident-accent-dark)]'
                  : 'text-[var(--resident-muted)] hover:bg-[var(--resident-surface-2)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <aside className={`${mobileTab === 'overview' ? 'flex' : 'hidden'} resident-rail h-auto w-full flex-col md:flex md:h-full md:w-[392px] lg:w-[420px]`}>
        <header className="resident-brand-row">
          <div className="flex items-center gap-3">
            <div className="resident-brand-mark"><Wind className="h-6 w-6" /></div>
            <div>
              <h1 className="resident-brand-title">Surabaya Air Quality</h1>
              <p className="resident-brand-subtitle">Resident air monitor</p>
            </div>
          </div>
          <span className="resident-live-tag">Live</span>
        </header>

        <div className="relative px-6 pt-5">
          <p className="resident-eyebrow mb-2">City data provider</p>
          <div className="mb-4 flex gap-2">
            {readingSources.map((source) => (
              <button
                key={source.name}
                type="button"
                onClick={() => setSelectedSource(source.name)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  selectedSource === source.name
                    ? 'border-[var(--resident-border-strong)] bg-[var(--resident-accent-soft)] text-[var(--resident-accent-dark)]'
                    : 'border-[var(--resident-border)] bg-[var(--resident-surface)] text-[var(--resident-muted)] hover:border-[var(--resident-border-strong)]'
                }`}
              >
                {source.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--resident-muted)]" />
            <input
              type="text"
              placeholder="Search kecamatan..."
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSelectedLocation(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSearch();
              }}
              className="w-full rounded-xl border border-[var(--resident-border)] bg-[var(--resident-surface)] py-2.5 pl-10 pr-20 text-sm text-[var(--resident-fg)] shadow-sm outline-none transition-all placeholder:text-[var(--resident-muted-2)] focus:border-[var(--resident-border-strong)] focus:ring-2 focus:ring-[var(--resident-accent)]/35"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-[var(--resident-accent-dark)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
            >
              Find area
            </button>
          </div>

          {matchingKecamatanNames.length > 0 && (
            <div className="absolute left-6 right-6 z-[1100] mt-1 overflow-hidden rounded-xl border border-[var(--resident-border)] bg-[var(--resident-surface)] shadow-[var(--resident-shadow)]">
              {matchingKecamatanNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => selectLocation(name)}
                  className="block w-full px-3 py-2 text-left text-sm text-[var(--resident-fg)] hover:bg-[var(--resident-surface-2)]"
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {searchQuery.trim() && !selectedLocation && matchingKecamatanNames.length === 0 && (
            <p className="mt-2 text-xs text-[var(--resident-muted)]">No kecamatan found for this search.</p>
          )}
          {selectedLocation && (
            <p className="mt-2 text-xs text-[var(--resident-accent-dark)]">Focused on Kecamatan {selectedLocation}.</p>
          )}
        </div>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-visible px-6 pb-6 pt-5 md:overflow-y-auto">
          {stats ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="resident-eyebrow">Overview</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--resident-muted)]">
                    <Clock3 className="h-3 w-3 text-[var(--resident-secondary)]" />
                    {selectedSourceLabel}: {formatLatestMeasuredOn(latestMeasuredOn)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenHistory}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--resident-accent-dark)] hover:bg-[var(--resident-accent-soft)]"
                >
                  <LineChartIcon className="h-3.5 w-3.5" />
                  History
                </button>
              </div>

              <StatCard
                title={`${selectedSourceLabel} current AQI`}
                value={stats.avgAqi ?? 'No data'}
                unit="US AQI"
                subtitle={getAqiColor(stats.avgAqi).label}
              />

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-bold">Pollutant detail</h2>
                  <span className="resident-eyebrow">City average</span>
                </div>
                <section className="resident-pollutants" aria-label="Pollutant summary">
                  {[
                    { label: 'PM2.5', value: stats.avgPm25, unit: 'ug/m3' },
                    { label: 'PM10', value: stats.avgPm10, unit: 'ug/m3' },
                    { label: 'NO2', value: stats.avgNo2, unit: selectedSource === 'google_aq_current' ? 'ppb' : 'ug/m3' },
                  ].map((pollutant) => (
                    <div key={pollutant.label} className="resident-pollutant">
                      <span className="resident-pollutant-name">{pollutant.label}</span>
                      <span className="resident-pollutant-value">{pollutant.value}</span>
                      <span className="resident-pollutant-unit">{pollutant.unit}</span>
                    </div>
                  ))}
                </section>
              </div>

              {/* WHO Guidelines Comparison */}
              <div className="rounded-[10px] border border-[var(--resident-border)] bg-[var(--resident-surface)] p-4 shadow-sm">
                <div className="mb-3">
                  <span className="resident-eyebrow mb-1 block">WHO Guidelines</span>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--resident-fg)]">Safety Exposure Limits</h3>
                </div>
                <div className="space-y-3.5">
                  {[
                    {
                      label: 'PM2.5',
                      val: Number(stats.avgPm25),
                      limit: 5,
                      unit: 'ug/m3',
                    },
                    {
                      label: 'PM10',
                      val: Number(stats.avgPm10),
                      limit: 15,
                      unit: 'ug/m3',
                    },
                    {
                      label: 'NO2',
                      val: Number(stats.avgNo2),
                      limit: selectedSource === 'google_aq_current' ? 5.3 : 10,
                      unit: selectedSource === 'google_aq_current' ? 'ppb' : 'ug/m3',
                    },
                  ].map((item) => {
                    const ratio = Number.isFinite(item.val) && item.limit > 0 ? (item.val / item.limit) : 0;
                    const percent = Math.round(ratio * 100);
                    const ratioText = ratio > 1 ? `${ratio.toFixed(1)}x over limit` : 'Within safe range';
                    const colorStyle = ratio > 1 ? 'bg-red-500' : 'bg-emerald-500';
                    const textClass = ratio > 1 ? 'text-red-600 font-bold' : 'text-emerald-600 font-semibold';

                    return (
                      <div key={item.label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--resident-fg)]">{item.label}</span>
                          <span className="text-[10px] text-[var(--resident-muted)]">
                            {Number.isFinite(item.val) ? `${item.val} ${item.unit}` : 'No data'} / Limit: {item.limit} {item.unit}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[var(--resident-surface-2)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${colorStyle}`}
                            style={{ width: `${Math.max(Math.min(ratio * 100 / 4, 100), 5)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className={textClass}>{ratioText}</span>
                          {ratio > 1 && <span className="text-[var(--resident-muted)]">({percent}% of limit)</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* District Leaderboard */}
              {leaderboard && (
                <div className="rounded-[10px] border border-[var(--resident-border)] bg-[var(--resident-surface)] p-4 shadow-sm">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--resident-fg)]">District AQI Extremes</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Cleanest Districts */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Cleanest Areas
                      </h4>
                      <div className="divide-y divide-[var(--resident-border)]">
                        {leaderboard.cleanest.map((item, idx) => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => selectLocation(item.name)}
                            className="flex w-full items-center justify-between py-1.5 text-left transition-colors hover:text-[var(--resident-accent-dark)]"
                          >
                            <span className="truncate text-xs font-medium text-[var(--resident-fg)]">
                              {idx + 1}. {item.name}
                            </span>
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                              {item.aqi}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Most Polluted Districts */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-600 flex items-center gap-1">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                        Most Polluted
                      </h4>
                      <div className="divide-y divide-[var(--resident-border)]">
                        {leaderboard.polluted.map((item, idx) => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => selectLocation(item.name)}
                            className="flex w-full items-center justify-between py-1.5 text-left transition-colors hover:text-[var(--resident-accent-dark)]"
                          >
                            <span className="truncate text-xs font-medium text-[var(--resident-fg)]">
                              {idx + 1}. {item.name}
                            </span>
                            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                              {item.aqi}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <section className="resident-guidance">
                <h3>Health guidance</h3>
                <p className="font-semibold text-[var(--resident-fg)] mb-1">
                  {getAqiGuidance(stats.avgAqi).description}
                </p>
                <p>
                  {getAqiGuidance(stats.avgAqi).guidance}
                </p>
              </section>
            </>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-[var(--resident-muted)]">
              <Search className="mb-3 h-8 w-8 opacity-50" />
              <p>No locations found matching your search.</p>
            </div>
          )}
        </div>

        <footer className="resident-rail-footer">
          <span className="resident-provider">{selectedSourceLabel}</span>
          <span>Refresh: {refreshIntervalMs / 60 / 60 / 1000} hour</span>
        </footer>
      </aside>

      <main className={`${mobileTab === 'map' ? 'block' : 'hidden'} relative h-[calc(100dvh-57px)] min-h-[520px] flex-1 bg-[var(--resident-map-bg)] p-2 md:block md:h-full md:min-h-0 md:p-4`}>
        <MapView
          focusedLocation={selectedLocation}
          onResetLocation={() => {
            setSearchQuery('');
            setSelectedLocation(null);
          }}
          onSelectLocation={selectLocation}
        />
      </main>

      {showHistoryModal && selectedCityId && (
        <HistoryChart
          cityId={selectedCityId}
          locationName={readings.find((reading) => reading.city_id === selectedCityId)?.location_name || 'Selected Area'}
          source={selectedSource}
          sourceLabel={selectedSourceLabel}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;
