// 时间工具：J2000 偏移、时间显示、节气计算、开普勒求解、行星位置更新

import { STATE, ASTRO } from './state.js';

// 计算从 J2000.0 到指定日期的天数
export function daysSinceJ2000(date) {
    return (date - ASTRO.J2000_MS) / (1000 * 60 * 60 * 24);
}

// 格式化时间显示
export function formatDateTime(timestamp) {
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');
    return {
        date: year + '-' + month + '-' + day,
        time: hour + ':' + minute + ':' + second,
    };
}

// 更新时间显示 + 节气
export function updateTimeDisplay() {
    const formatted = formatDateTime(STATE.simTime);
    const timeEl = document.getElementById('sim-time');
    const dateEl = document.getElementById('sim-date');
    const seasonEl = document.getElementById('season-info');
    if (timeEl) timeEl.textContent = formatted.time;
    if (dateEl) dateEl.textContent = formatted.date;
    if (seasonEl) {
        const d = new Date(STATE.simTime);
        let year = d.getFullYear();
        let spring = new Date(year, 2, 20);
        if (d < spring) {
            year--;
            spring = new Date(year, 2, 20);
        }
        const daysSinceSpring = (d - spring) / 86400000;
        const angle = (daysSinceSpring / 365.25) * 360;
        const terms = ['春分', '清明', '谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰'];
        const idx = Math.floor(((angle % 360 + 360) % 360) / 15);
        const term = terms[Math.min(idx, 23)];
        const season = angle < 90 ? '春' : angle < 180 ? '夏' : angle < 270 ? '秋' : '冬';
        seasonEl.textContent = term + ' · 北半球' + season + '季';
    }
}

// 解开普勒方程（牛顿迭代），返回偏近点角 E
export function solveKepler(M, e) {
    let E = M;
    for (let iter = 0; iter < 10; iter++) {
        const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
        E += dE;
        if (Math.abs(dE) < 1e-8) break;
    }
    return E;
}

// 根据时间重新计算所有行星位置
export function updatePlanetsPosition(date) {
    const daysSinceEpoch = daysSinceJ2000(date);

    STATE.planets.forEach(function (p) {
        const d = p.data;
        const M0 = (d.mean_anomaly_j2000 || 0) * Math.PI / 180;
        const omega = (d.perihelion_longitude || 0) * Math.PI / 180;
        const meanMotion = 2 * Math.PI / d.orbital_period;
        const e = p.e;

        // 平均近点角
        const M = M0 + meanMotion * daysSinceEpoch;

        // 偏近点角
        const E = solveKepler(M, e);

        // 真近点角
        const nu = 2 * Math.atan2(
            Math.sqrt(1 + e) * Math.sin(E / 2),
            Math.sqrt(1 - e) * Math.cos(E / 2)
        );

        // 黄道经度
        p.angle = (omega + nu) % (2 * Math.PI);

        // 更新位置（焦点在原点的椭圆）
        const r = p.a * (1 - e * e) / (1 + e * Math.cos(nu));
        const x = r * Math.cos(p.angle);
        const z = -r * Math.sin(p.angle);
        p.pivot.position.set(x, z * Math.sin(p.inclination), z * Math.cos(p.inclination));

        // 更新地球自转：让北京经度始终指向"该时刻的反太阳方向 + 时区时差偏转"
        if (d.name === 'Earth') {
            const d2 = new Date(date);
            const beijingHour = (d2.getUTCHours() + 8 + d2.getUTCMinutes() / 60 + d2.getUTCSeconds() / 3600) % 24;
            const toSun = Math.atan2(-x, -z);
            const rotationFromNoon = (beijingHour - 12) * Math.PI / 12;
            p.mesh.rotation.y = toSun + rotationFromNoon - ASTRO.BEIJING_LONGITUDE_RAD;
        }
    });

    // 月球：用合朔参考时刻 + 朔望月推算相位
    if (STATE.moon) {
        const daysSinceNew = (date - ASTRO.NEW_MOON_REF_MS) / (1000 * 60 * 60 * 24);
        const moonPhase = (daysSinceNew % ASTRO.SYNODIC_MONTH) / ASTRO.SYNODIC_MONTH;
        const sunLongitude = STATE.earthPlanet ? STATE.earthPlanet.angle + Math.PI : Math.PI;
        STATE.moon.angle = sunLongitude + moonPhase * 2 * Math.PI;
    }
}
