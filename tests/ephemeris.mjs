import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localFields, localInstants, parseLocal } from '../js/calendar.js';
import { astronomyTime, moonOffset, planetPosition, solarTerm } from '../js/ephemeris.js';

for (const zone of ['Asia/Shanghai', 'UTC', 'America/New_York']) {
    process.env.TZ = zone;
    for (const stamp of ['2026-11-03T02:00Z', '2024-02-29T13:05:20Z', '2000-01-01T20:00Z']) {
        const ms = Date.parse(stamp);
        assert.equal(parseLocal(localFields(ms)), ms, zone);
    }
    for (const input of [
        [2023, 2, 29, 9, 0, 0],
        [2026, 4, 31, 0, 0, 0],
        [2026, 1, '', 0, 0, 0],
        [2101, 1, 1, 0, 0, 0],
    ]) {
        assert.equal(parseLocal(input), null);
    }
}
assert.equal(parseLocal([2026, 3, 8, 2, 30, 0]), null); // skipped hour in New York

// Lord Howe repeats 30 minutes, rather than a full hour.
process.env.TZ = 'Australia/Lord_Howe';
const folded = [2026, 4, 5, 1, 45, 0];
assert.deepEqual(localInstants(folded), [Date.parse('2026-04-04T14:45Z'), Date.parse('2026-04-04T15:15Z')]);
assert.equal(parseLocal(folded, -630), Date.parse('2026-04-04T15:15Z'));

const references = JSON.parse(readFileSync(new URL('./j2000-longitude.json', import.meta.url)));
const epoch = astronomyTime(Date.parse('2000-01-01T12:00:00Z'));
for (const [name, expected] of Object.entries(references)) {
    const p = planetPosition(name, epoch);
    const longitude = (Math.atan2(-p.z, p.x) * 180) / Math.PI;
    const error = Math.abs(((longitude - expected + 540) % 360) - 180);
    assert.ok(error < 0.1, name + ' longitude error ' + error);
}
for (const [date, expected] of [
    ['2000-01-06T18:14Z', 0],
    ['2000-01-14T13:34Z', 90],
    ['2000-01-21T04:40Z', 180],
    ['2000-01-28T07:57Z', 270],
]) {
    const t = astronomyTime(Date.parse(date)),
        earth = planetPosition('Earth', t),
        moon = moonOffset(t);
    const sunAngle = Math.atan2(earth.z, -earth.x),
        moonAngle = Math.atan2(-moon.z, moon.x);
    const difference = ((moonAngle - sunAngle) * 180) / Math.PI;
    assert.ok(Math.abs(((difference - expected + 540) % 360) - 180) < 0.7, date + ' lunar phase');
}
assert.match(solarTerm(astronomyTime(Date.parse('2026-06-21T08:20Z'))), /^芒种/);
assert.match(solarTerm(astronomyTime(Date.parse('2026-06-21T08:30Z'))), /^夏至/);
for (const date of ['1999-12-31T12:00Z', '2101-01-01T10:00Z']) {
    const t = astronomyTime(Date.parse(date));
    for (const name of Object.keys(references)) assert.ok(Number.isFinite(planetPosition(name, t).au));
}
console.log('Passed local-date, nine JPL longitude, four lunar phase, solstice and date-range checks.');
