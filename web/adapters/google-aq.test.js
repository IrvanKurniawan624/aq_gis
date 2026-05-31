import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGoogleAqRequestBody, getUsAqi } from './google-aq.js'

test('reads the explicitly requested Google US EPA AQI', () => {
  assert.equal(getUsAqi([
    { code: 'uaqi', aqi: 51 },
    { code: 'usa_epa', aqi: 81 },
  ]), 81)
})

test('does not mislabel Google Universal AQI as US AQI', () => {
  assert.equal(getUsAqi([{ code: 'uaqi', aqi: 51 }]), null)
})

test('requests a Google US EPA AQI for Indonesia', () => {
  const location = { latitude: -7.24917, longitude: 112.75083 }

  assert.deepEqual(buildGoogleAqRequestBody(location), {
    location,
    extraComputations: ['LOCAL_AQI', 'POLLUTANT_CONCENTRATION'],
    customLocalAqis: [{
      regionCode: 'ID',
      aqi: 'usa_epa',
    }],
    universalAqi: false,
  })
})
