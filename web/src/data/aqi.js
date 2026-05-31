export const getAqiColor = (aqi) => {
  if (aqi === null || aqi === undefined || aqi === '' || !Number.isFinite(Number(aqi))) {
    return { bg: 'bg-slate-500', text: 'text-slate-400', label: 'No data' };
  }

  if (aqi <= 50) return { bg: 'bg-emerald-500', text: 'text-emerald-500', label: 'Good' };
  if (aqi <= 100) return { bg: 'bg-yellow-500', text: 'text-yellow-500', label: 'Moderate' };
  if (aqi <= 150) return { bg: 'bg-orange-500', text: 'text-orange-500', label: 'Unhealthy for Sensitive Groups' };
  if (aqi <= 200) return { bg: 'bg-red-500', text: 'text-red-500', label: 'Unhealthy' };
  if (aqi <= 300) return { bg: 'bg-purple-500', text: 'text-purple-500', label: 'Very Unhealthy' };
  return { bg: 'bg-rose-900', text: 'text-rose-900', label: 'Hazardous' };
};
