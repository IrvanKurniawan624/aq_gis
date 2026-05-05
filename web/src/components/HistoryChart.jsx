import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { X, Loader2, Calendar } from 'lucide-react';

const HistoryChart = ({ cityId, locationName, onClose }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
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
        // Format dates for charting
        const formatted = response.data.map(item => {
          const [y, m, d] = item.measured_on.split('-').map(Number);
          return {
            ...item,
            date: new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          };
        });
        setData(formatted);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };
    if (cityId) fetchHistory();
  }, [cityId, startDate, endDate]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-slate-700/50 gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Historical Air Quality</h2>
            <p className="text-sm text-slate-400">{locationName} - Daily Trends</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
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
            
            <button 
              onClick={onClose}
              className="p-2 ml-auto hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Chart Area */}
        <div className="p-6 h-[500px] w-full">
          {loading ? (
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
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '0.5rem' }}
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
                  name="PM2.5 (µg/m³)" 
                  dataKey="pm2_5" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  name="PM10 (µg/m³)" 
                  dataKey="pm10" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryChart;
