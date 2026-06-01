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

const DISTRICT_SERIES_COLORS = [
  '#9b6c2f',
  '#16865a',
  '#c85d3d',
  '#4776a6',
  '#8b5da7',
  '#d38b25',
  '#2f8d92',
  '#b14f72',
  '#6e7d37',
  '#7c5c48',
  '#5474c2',
  '#b8672e',
];

function formatChartDate(
  dateValue,
  options = { month: 'short', day: 'numeric', hour: 'numeric' },
) {
  const [datePart, timePart = '00:00:00'] = dateValue.split(/[ T]/);
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);

  return new Date(year, month - 1, day, hour, minute, second).toLocaleDateString('en-US', options);
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
    <div className="rounded-lg border border-[var(--resident-border)] bg-[var(--resident-surface)]/95 px-3 py-2 text-xs shadow-xl">
      <p className="mb-2 font-semibold text-[var(--resident-fg)]">{label}</p>
      <div className="space-y-1">
        {topValues.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <span style={{ color: item.color }}>{item.name}</span>
            <span className="font-semibold text-[var(--resident-fg)]">{Math.round(item.value)}</span>
          </div>
        ))}
      </div>
      {remainingCount > 0 && (
        <p className="mt-2 text-[var(--resident-muted)]">... +{remainingCount} more</p>
      )}
    </div>
  );
};

const HistoryChart = ({ cityId, locationName, source, sourceLabel, onClose }) => {
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
        let url = `/api/history/${cityId}`;
        const params = new URLSearchParams();
        params.append('source', source);
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
  }, [activeTab, cityId, source, startDate, endDate]);

  useEffect(() => {
    if (activeTab !== 'district' || districtLoaded) return;

    const fetchDistrictHistory = async () => {
      setDistrictLoading(true);
      try {
        const response = await axios.get('/api/kecamatan/history?days=30');
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
      .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
      .map(([name], index) => ({
        name,
        color: DISTRICT_SERIES_COLORS[index % DISTRICT_SERIES_COLORS.length],
      }));
  }, [districtRows]);

  const districtChartData = useMemo(() => {
    const rowsByDate = new Map();

    for (const row of districtRows) {
      if (!rowsByDate.has(row.measured_on)) {
        rowsByDate.set(row.measured_on, {
          measured_on: row.measured_on,
          date: formatChartDate(row.measured_on, { month: 'short', day: 'numeric', hour: 'numeric' }),
        });
      }

      rowsByDate.get(row.measured_on)[row.name] = row.us_aqi;
    }

    return Array.from(rowsByDate.values()).sort((a, b) => (
      a.measured_on.localeCompare(b.measured_on)
    ));
  }, [districtRows]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#493b2f]/25 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-[18px] border border-[var(--resident-border)] bg-[var(--resident-surface)] shadow-[var(--resident-shadow)]">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-[var(--resident-border)] p-6 sm:flex-row sm:items-center">
          <div>
            <p className="resident-eyebrow">Air quality trends</p>
            <h2 className="mt-1 text-xl font-bold text-[var(--resident-fg)]">Historical Air Quality</h2>
            <p className="text-sm text-[var(--resident-muted)]">{locationName} - {sourceLabel} trends</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex overflow-hidden rounded-lg border border-[var(--resident-border)] bg-[var(--resident-surface-2)] p-1">
              <button
                type="button"
                onClick={() => setActiveTab('city')}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                  activeTab === 'city'
                    ? 'bg-[var(--resident-accent)] text-[var(--resident-accent-dark)]'
                    : 'text-[var(--resident-muted)] hover:bg-[var(--resident-surface)]'
                }`}
              >
                Surabaya Average
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('district')}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                  activeTab === 'district'
                    ? 'bg-[var(--resident-accent)] text-[var(--resident-accent-dark)]'
                    : 'text-[var(--resident-muted)] hover:bg-[var(--resident-surface)]'
                }`}
              >
                Per District
              </button>
            </div>

            {activeTab === 'city' && (
              <div className="flex items-center rounded-lg border border-[var(--resident-border)] bg-[var(--resident-surface-2)] p-1">
                <Calendar className="ml-2 h-4 w-4 text-[var(--resident-muted)]" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent px-2 py-1.5 text-sm text-[var(--resident-fg)] outline-none"
                  title="Start Date"
                />
                <span className="px-1 text-[var(--resident-muted)]">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent px-2 py-1.5 text-sm text-[var(--resident-fg)] outline-none"
                  title="End Date"
                />
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-full border border-[var(--resident-border)] p-2 text-[var(--resident-muted)] transition-colors hover:border-[var(--resident-border-strong)] hover:text-[var(--resident-fg)]"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 h-[500px] w-full">
          {activeTab === 'city' ? (
            loading ? (
              <div className="flex h-full w-full flex-col items-center justify-center text-[var(--resident-muted)]">
                <Loader2 className="w-8 h-8 animate-spin mb-4" />
                <p>Loading historical data...</p>
              </div>
            ) : data.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center text-[var(--resident-muted)]">
                <p>No historical data available for the selected date range.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e3d8c4" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#8b7962"
                    fontSize={12}
                    tickMargin={10}
                    minTickGap={30}
                  />
                  <YAxis
                    stroke="#8b7962"
                    fontSize={12}
                    tickFormatter={(val) => val}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fffdf8',
                      borderColor: '#d8c9ae',
                      color: '#493b2f',
                      borderRadius: '0.5rem',
                    }}
                    itemStyle={{ color: '#493b2f' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line
                    type="monotone"
                    name="US AQI"
                    dataKey="us_aqi"
                    stroke="#9b6c2f"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#9b6c2f', strokeWidth: 0 }}
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
            <div className="flex h-full w-full flex-col items-center justify-center text-[var(--resident-muted)]">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Loading district data...</p>
            </div>
          ) : districtChartData.length === 0 ? (
            <div className="flex h-full w-full flex-col items-center justify-center text-center text-[var(--resident-muted)]">
              <p className="text-[var(--resident-fg)]">No district-level data yet.</p>
              <p className="text-sm">Add GOOGLE_AQ_API_KEY to enable per-kecamatan tracking.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={districtChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3d8c4" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#8b7962"
                  fontSize={12}
                  tickMargin={10}
                  minTickGap={24}
                />
                <YAxis
                  stroke="#8b7962"
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
