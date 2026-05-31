import assert from 'node:assert/strict'
import test from 'node:test'
import { toJakartaHour } from './time.js'

test('converts an absolute timestamp into a Jakarta hourly bucket', () => {
  assert.equal(
    toJakartaHour(new Date('2026-05-31T12:45:30Z')),
    '2026-05-31 19:00:00',
  )
})

test('keeps an Open-Meteo Jakarta-local timestamp in its hourly bucket', () => {
  assert.equal(toJakartaHour('2026-05-31T20:45'), '2026-05-31 20:00:00')
})

test('rejects an invalid Jakarta-local timestamp', () => {
  assert.throws(() => toJakartaHour('2026-05-31T99:45'), /Invalid local timestamp/)
})
