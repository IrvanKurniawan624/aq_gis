import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { X, Loader2, Calendar } from 'lucide-react';

function getAqiHexColor(aqi) {
  if (aqi === null || aqi === undefined) return '#475569';
  if (aqi <= 50) return '#10b981';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#a855f7';
  return '#881337';
}

function formatChartDate(
  dateValue,
  options = { month: 'short', day: 'numeric', year: 'numeric' },
) {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', options);
}

const DistrictTooltip = ({ active, label, payload }) => {
  if (!active || !payload || payload.length === 0) return null;

  const rankedValues = payload
    .filter((item) => Number.isFinite(Number(item.value)))
    .map((item) => ({
      name: item.name,
      value: Number(item.value),
      color: item.color,
    }))
    .sort((a, b) => b.value - a.value);
  const topValues = rankedValues.slice(0, 3);
  const remainingCount = Math.max(rankedValues.length - topValues.length, 0);

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-2 font-semibold text-slate-100">{label}</p>
      <div className="space-y-1">
        {topValues.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <span style={{ color: item.color }}>{item.name}</span>
            <span className="font-semibold text-slate-100">{Math.round(item.value)}</span>
          </div>
        ))}
      </div>
      {remainingCount > 0 && (
        <p className="mt-2 text-slate-400">... +{remainingCount} more</p>
      )}
    </div>
  );
};

const HistoryChart = ({ cityId, locationName, onClose }) => {
  const [activeTab, setActiveTab] = useState('city');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [districtRows, setDistrictRows] = useState([]);
  const [districtLoading, setDistrictLoading] = useState(false);
  const [districtLoaded, setDistrictLoaded] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
    if (diffDays > 30) {
      const newEnd = new Date(start);
      newEnd.setDate(newEnd.getDate() + 30);
      setEndDate(newEnd.toISOString().split('T')[0]);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (activeTab !== 'city' || !cityId) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        let url = `http://localhost:3001/api/history/${cityId}`;
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        const response = await axios.get(url);
        const formatted = response.data.map((item) => ({
          ...item,
          date: formatChartDate(item.measured_on),
        }));
        setData(formatted);
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [activeTab, cityId, startDate, endDate]);

  useEffect(() => {
    if (activeTab !== 'district' || districtLoaded) return;

    const fetchDistrictHistory = async () => {
      setDistrictLoading(true);
      try {
        const response = await axios.get('http://localhost:3001/api/kecamatan/history?days=30');
        setDistrictRows(response.data || []);
        setDistrictLoaded(true);
      } catch (error) {
        console.error('Error fetching district history:', error);
        setDistrictRows([]);
        setDistrictLoaded(true);
      } finally {
        setDistrictLoading(false);
      }
    };

    fetchDistrictHistory();
  }, [activeTab, districtLoaded]);

  const districtSeries = useMemo(() => {
    const latestByName = new Map();

    for (const row of districtRows) {
      latestByName.set(row.name, row);
    }

    return Array.from(latestByName.entries())
      .map(([name, row]) => ({
        name,
        color: getAqiHexColor(row.us_aqi),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [districtRows]);

  const districtChartData = useMemo(() => {
    const rowsByDate = new Map();

    for (const row of districtRows) {
      if (!rowsByDate.has(row.measured_on)) {
        rowsByDate.set(row.measured_on, {
          measured_on: row.measured_on,
          date: formatChartDate(row.measured_on, { month: 'short', day: 'numeric' }),
        });
      }

      rowsByDate.get(row.measured_on)[row.name] = row.us_aqi;
    }

    return Array.from(rowsByDate.values()).sort((a, b) => (
      a.measured_on.localeCompare(b.measured_on)
    ));
  }, [districtRows]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-slate-700/50 gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Historical Air Quality</h2>
            <p className="text-sm text-slate-400">{locationName} - Daily Trends</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex overflow-hidden rounded-lg border border-slate-700/50 bg-slate-900/50 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('city')}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                  activeTab === 'city'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                Surabaya Average
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('district')}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                  activeTab === 'district'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                Per District
              </button>
            </div>

            {activeTab === 'city' && (
              <div className="flex items-center bg-slate-900/50 rounded-lg border border-slate-700/50 p-1">
                <Calendar className="w-4 h-4 text-slate-500 ml-2" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-sm text-slate-200 focus:outline-none px-2 py-1.5 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  title="Start Date"
                />
                <span className="text-slate-500 px-1">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-sm text-slate-200 focus:outline-none px-2 py-1.5 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
                  title="End Date"
                />
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 ml-auto hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 h-[500px] w-full">
          {activeTab === 'city' ? (
            loading ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Loading historical data...</p>
              </div>
            ) : data.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-slate-500">
                <p>No historical data available for the selected date range.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickMargin={10}
                    minTickGap={30}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    tickFormatter={(val) => val}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderColor: '#334155',
                      color: '#f8fafc',
                      borderRadius: '0.5rem',
                    }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line
                    type="monotone"
                    name="US AQI"
                    dataKey="us_aqi"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    name="PM2.5 (ug/m3)"
                    dataKey="pm2_5"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    name="PM10 (ug/m3)"
                    dataKey="pm10"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )
          ) : districtLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Loading district data...</p>
            </div>
          ) : districtChartData.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-center">
              <p className="text-slate-300">No district-level data yet.</p>
              <p className="text-sm">Add GOOGLE_AQ_API_KEY to enable per-kecamatan tracking.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={districtChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickMargin={10}
                  minTickGap={24}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(val) => val}
                />
                <Tooltip content={<DistrictTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px' }} />
                {districtSeries.map((series) => (
                  <Line
                    key={series.name}
                    type="monotone"
                    name={series.name}
                    dataKey={series.name}
                    stroke={series.color}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryChart;
