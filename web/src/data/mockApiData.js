export const mockCities = [
  {
    id: 1,
    geoname_id: 1625822,
    city_name: "Surabaya",
    country_code: "ID",
    latitude: -7.2504,
    longitude: 112.7688,
  }
];

export const mockReadings = [
  {
    id: 1,
    city_id: 1,
    source_name: "open_meteo_surabaya_historical_daily",
    measured_on: "2026-04-28",
    pm10: 45.2,
    pm2_5: 22.5,
    carbon_monoxide: 310.4,
    nitrogen_dioxide: 15.2,
    sulphur_dioxide: 5.1,
    ozone: 35.8,
    us_aqi: 72,
    latitude: -7.2600,
    longitude: 112.7400,
    location_name: "Tunjungan",
  },
  {
    id: 2,
    city_id: 1,
    source_name: "open_meteo_surabaya_historical_daily",
    measured_on: "2026-04-28",
    pm10: 65.0,
    pm2_5: 35.1,
    carbon_monoxide: 450.2,
    nitrogen_dioxide: 25.0,
    sulphur_dioxide: 8.5,
    ozone: 42.1,
    us_aqi: 98,
    latitude: -7.3111,
    longitude: 112.7297,
    location_name: "Wonokromo",
  },
  {
    id: 3,
    city_id: 1,
    source_name: "open_meteo_surabaya_historical_daily",
    measured_on: "2026-04-28",
    pm10: 25.4,
    pm2_5: 12.0,
    carbon_monoxide: 210.0,
    nitrogen_dioxide: 10.5,
    sulphur_dioxide: 2.1,
    ozone: 20.0,
    us_aqi: 45,
    latitude: -7.2756,
    longitude: 112.7939,
    location_name: "ITS / Sukolilo",
  },
  {
    id: 4,
    city_id: 1,
    source_name: "open_meteo_surabaya_historical_daily",
    measured_on: "2026-04-28",
    pm10: 85.2,
    pm2_5: 45.8,
    carbon_monoxide: 520.1,
    nitrogen_dioxide: 32.4,
    sulphur_dioxide: 12.0,
    ozone: 55.2,
    us_aqi: 125,
    latitude: -7.2100,
    longitude: 112.7300,
    location_name: "Perak (Port Area)",
  },
  {
    id: 5,
    city_id: 1,
    source_name: "open_meteo_surabaya_historical_daily",
    measured_on: "2026-04-28",
    pm10: 40.1,
    pm2_5: 18.2,
    carbon_monoxide: 280.5,
    nitrogen_dioxide: 14.1,
    sulphur_dioxide: 4.8,
    ozone: 30.2,
    us_aqi: 63,
    latitude: -7.2892,
    longitude: 112.6738,
    location_name: "Wiyung",
  }
];

export const getAqiColor = (aqi) => {
  if (aqi <= 50) return { bg: 'bg-emerald-500', text: 'text-emerald-500', label: 'Good' };
  if (aqi <= 100) return { bg: 'bg-yellow-500', text: 'text-yellow-500', label: 'Moderate' };
  if (aqi <= 150) return { bg: 'bg-orange-500', text: 'text-orange-500', label: 'Unhealthy for Sensitive Groups' };
  if (aqi <= 200) return { bg: 'bg-red-500', text: 'text-red-500', label: 'Unhealthy' };
  if (aqi <= 300) return { bg: 'bg-purple-500', text: 'text-purple-500', label: 'Very Unhealthy' };
  return { bg: 'bg-rose-900', text: 'text-rose-900', label: 'Hazardous' };
};
