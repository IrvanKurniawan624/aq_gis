import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import MapView from './MapView';
import StatCard from './StatCard';
import HistoryChart from './HistoryChart';
import { getAqiColor } from '../data/aqi';
import { Wind, Activity, Clock3, Search, LineChart as LineChartIcon } from 'lucide-react';

const DEFAULT_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_SOURCE = {
  name: 'open_meteo_current',
  label: 'Open-Meteo',
};

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [readings, setReadings] = useState([]);
  const [readingSources, setReadingSources] = useState([DEFAULT_SOURCE]);
  const [selectedSource, setSelectedSource] = useState(DEFAULT_SOURCE.name);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(DEFAULT_REFRESH_INTERVAL_MS);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState(null);

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

  const selectedSourceLabel = readingSources.find((source) => source.name === selectedSource)?.label
    || DEFAULT_SOURCE.label;

  const filteredReadings = useMemo(() => {
    if (!searchQuery) return readings;
    return readings.filter(r => 
      (r.location_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, readings]);

  const stats = useMemo(() => {
    if (filteredReadings.length === 0) return null;
    const aqiValues = filteredReadings
      .map((reading) => reading.us_aqi === null ? Number.NaN : Number(reading.us_aqi))
      .filter(Number.isFinite);
    const pm25Values = filteredReadings
      .map((reading) => reading.pm2_5 === null ? Number.NaN : Number(reading.pm2_5))
      .filter(Number.isFinite);
    const avgAqi = aqiValues.length > 0
      ? Math.round(aqiValues.reduce((sum, value) => sum + value, 0) / aqiValues.length)
      : null;
    const avgPm25 = pm25Values.length > 0
      ? (pm25Values.reduce((sum, value) => sum + value, 0) / pm25Values.length).toFixed(1)
      : 'No data';
    
    return { avgAqi, avgPm25 };
  }, [filteredReadings]);

  const handleOpenHistory = () => {
    // Default to the first city in the filtered list (usually Surabaya city_id = 1)
    if (filteredReadings.length > 0) {
      setSelectedCityId(filteredReadings[0].city_id);
      setShowHistoryModal(true);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-background overflow-hidden selection:bg-primary/30">
      <div className="w-full md:w-[450px] lg:w-[500px] h-full flex flex-col flex-shrink-0 z-10 glass border-r-0 md:border-r border-slate-700/50">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Wind className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Surabaya Air Quality
              </h1>
              <p className="text-sm text-slate-400 font-medium tracking-wide uppercase">GIS Dashboard</p>
            </div>
          </div>
        </div>

        <div className="px-6 mb-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            City Data Provider
          </p>
          <div className="mb-4 flex gap-2">
            {readingSources.map((source) => (
              <button
                key={source.name}
                type="button"
                onClick={() => setSelectedSource(source.name)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  selectedSource === source.name
                    ? 'border-blue-400 bg-blue-500/20 text-blue-200'
                    : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {source.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search locations..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 pr-4 custom-scrollbar">
          {stats ? (
            <>
              <div className="flex items-center justify-between mt-2 mb-2">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overview</h2>
                <button 
                  onClick={handleOpenHistory}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-md transition-colors"
                >
                  <LineChartIcon className="w-3.5 h-3.5" />
                  View History
                </button>
              </div>
              
              <StatCard 
                title={`${selectedSourceLabel} Current AQI`}
                value={stats.avgAqi ?? 'No data'}
                unit="US AQI"
                icon={Activity}
                colorClass={getAqiColor(stats.avgAqi)}
                subtitle={`Overall Status: ${getAqiColor(stats.avgAqi).label}`}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <StatCard 
                  title="Avg PM2.5" 
                  value={stats.avgPm25} 
                  unit="µg/m³"
                  icon={Wind}
                  colorClass={{text: 'text-blue-400', bg: 'bg-blue-500'}}
                />
                <StatCard 
                  title="Update Interval"
                  value={refreshIntervalMs / 60 / 60 / 1000}
                  unit="hour"
                  icon={Clock3}
                  colorClass={{text: 'text-emerald-400', bg: 'bg-emerald-500'}}
                />
              </div>

              <div className="mt-8 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
                <h4 className="text-blue-400 text-sm font-medium mb-1">Health Recommendation</h4>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Based on the current average AQI, sensitive groups should reduce prolonged or heavy exertion. It is OK to be active outside, but take more breaks and do less intense activities.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
              <Search className="w-8 h-8 mb-3 opacity-50" />
              <p>No locations found matching your search.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 h-full p-4 relative bg-slate-900/50">
        <MapView />
      </div>

      {/* History Modal */}
      {showHistoryModal && selectedCityId && (
        <HistoryChart 
          cityId={selectedCityId} 
          locationName={filteredReadings.find(r => r.city_id === selectedCityId)?.location_name || 'Selected Area'}
          source={selectedSource}
          sourceLabel={selectedSourceLabel}
          onClose={() => setShowHistoryModal(false)} 
        />
      )}
    </div>
  );
};

export default Dashboard;
