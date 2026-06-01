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

export const getAqiGuidance = (aqi) => {
  if (aqi === null || aqi === undefined || aqi === '' || !Number.isFinite(Number(aqi))) {
    return {
      description: 'No active reading is currently selected.',
      guidance: 'Select a city data provider to display real-time air quality metrics and recommendations.',
    };
  }

  const val = Number(aqi);

  if (val <= 50) {
    return {
      description: 'Air quality is satisfactory, and air pollution poses little or no risk.',
      guidance: 'It is a great day to be active outside! Enjoy your outdoor activities.',
    };
  }
  if (val <= 100) {
    return {
      description: 'Air quality is acceptable; however, there may be some concern for a very small number of unusually sensitive people.',
      guidance: 'Extremely sensitive people should consider reducing prolonged or heavy outdoor exertion.',
    };
  }
  if (val <= 150) {
    return {
      description: 'Members of sensitive groups (asthma, children, older adults) may experience health effects.',
      guidance: 'Sensitive groups should reduce prolonged or heavy outdoor exertion. It is OK for others to be active outside.',
    };
  }
  if (val <= 200) {
    return {
      description: 'Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.',
      guidance: 'Everyone should reduce prolonged or heavy exertion. Sensitive groups should avoid outdoor activities.',
    };
  }
  if (val <= 300) {
    return {
      description: 'Health alert: everyone may experience more serious health effects.',
      guidance: 'Everyone should avoid prolonged or heavy outdoor exertion. Sensitive groups should remain indoors.',
    };
  }
  return {
    description: 'Health warning of emergency conditions: everyone is more likely to be affected.',
    guidance: 'Everyone should avoid all outdoor physical activity. Keep windows closed and remain indoors.',
  };
};
