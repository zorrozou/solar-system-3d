// Astronomy Engine 2.1.19. Physics uses AU in the fixed J2000 ecliptic frame.
// Three.js uses Y up, with positive ecliptic longitude pointing towards -Z.
import {
    AstroTime,
    GeoMoon,
    HelioVector,
    RotateVector,
    Rotation_EQJ_ECL,
    SunPosition,
} from '../lib/astronomy-2.1.19.js';

const rotation = Rotation_EQJ_ECL();
export const DAY = 86400000;
const terms = [
    '春分',
    '清明',
    '谷雨',
    '立夏',
    '小满',
    '芒种',
    '夏至',
    '小暑',
    '大暑',
    '立秋',
    '处暑',
    '白露',
    '秋分',
    '寒露',
    '霜降',
    '立冬',
    '小雪',
    '大雪',
    '冬至',
    '小寒',
    '大寒',
    '立春',
    '雨水',
    '惊蛰',
];

export function astronomyTime(ms) {
    return new AstroTime(new Date(ms));
}

export function sceneVector(eqj) {
    const v = RotateVector(rotation, eqj);
    return { x: v.x, y: v.z, z: -v.y };
}

export function planetPosition(name, time) {
    const v = sceneVector(HelioVector(name, time));
    const au = Math.hypot(v.x, v.y, v.z);
    const scale = 30 + 10 / au;
    return { x: v.x * scale, y: v.y * scale, z: v.z * scale, au };
}

export function moonOffset(time) {
    const v = sceneVector(GeoMoon(time));
    const scale = 4 / 0.00257; // average Earth–Moon separation maps to 4 scene units
    return { x: v.x * scale, y: v.y * scale, z: v.z * scale };
}

export function solarTerm(time) {
    const longitude = SunPosition(time).elon;
    const i = Math.floor(longitude / 15) % 24;
    return terms[i] + ' · 北半球' + ['春', '夏', '秋', '冬'][Math.floor(i / 6)] + '季';
}
