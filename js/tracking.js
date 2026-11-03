import * as THREE from 'three';
import { STATE } from './state.js';

const targets = new Map();
const byId = (id) => document.getElementById(id);
export function registerTarget(pivot, radius, data, orbit = null) {
    pivot.userData = data;
    targets.set(data.name, { pivot, radius, data, orbit });
    const option = new Option(data.name_cn, data.name);
    byId('body-picker').add(option);
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'planet-label';
    label.textContent = data.name_cn;
    label.tabIndex = -1; // all objects are accessible through the native select
    label.addEventListener('click', () => selectBody(data.name));
    byId('canvas-container').appendChild(label);
    return label;
}
export function selectBody(name) {
    const target = targets.get(name);
    if (!target) {
        stopTrack();
        return;
    }
    const { pivot, radius, data, orbit } = target;
    STATE.trackTarget = pivot;
    STATE.trackOffset = new THREE.Vector3(5, 2.5, 5).multiplyScalar(radius);
    STATE.flyStart = { cam: STATE.camera.position.clone(), target: STATE.controls.target.clone() };
    STATE.flyProgress = 0;
    STATE.isFlying = true;
    STATE.controls.minDistance = radius * 1.5;
    STATE.orbitLines.forEach((line) => {
        line.material.color.set(line === orbit ? 0x60a5fa : 0x334455);
        line.material.opacity = line === orbit ? 0.8 : 0.12;
    });
    byId('body-picker').value = name;
    byId('info-panel').hidden = false;
    byId('planet-name').textContent = data.name_cn + ' (' + name + ')';
    const info = byId('planet-info');
    info.replaceChildren();
    function stat(label, value, id) {
        const row = document.createElement('div');
        row.className = 'stat';
        const key = document.createElement('span'),
            val = document.createElement('span');
        key.className = 'stat-label';
        val.className = 'stat-value';
        key.textContent = label;
        val.textContent = value;
        if (id) val.id = id;
        row.append(key, val);
        info.append(row);
    }
    if (data.distance_from_sun) stat('轨道半长轴（约）', data.distance_from_sun + ' AU');
    if (data.currentAU != null) stat('当前日距', data.currentAU.toFixed(4) + ' AU', 'current-distance');
    if (data.orbital_period) stat('公转周期', data.orbital_period + ' 天');
    if (data.rotation_period) stat('自转周期', Math.abs(data.rotation_period) + ' 天');
    if (data.radius) stat('平均半径', data.radius.toLocaleString() + ' km');
    if (data.moons != null) stat('已确认卫星', data.moons + ' 颗');
    if (data.axial_tilt != null) stat('轴倾角', data.axial_tilt + '°');
    if (data.description) {
        const p = document.createElement('p');
        p.className = 'planet-desc';
        p.textContent = data.description;
        info.append(p);
    }
}
export function stopTrack() {
    STATE.trackTarget = null;
    STATE.trackOffset = null;
    STATE.isFlying = false;
    STATE.controls.minDistance = 5;
    STATE.controls.target.set(0, 0, 0);
    // Fit the outer orbit even on a narrow screen.
    const fov = THREE.MathUtils.degToRad(STATE.camera.fov / 2);
    const dist = 1550 / Math.sin(Math.atan(Math.tan(fov) * Math.min(1, STATE.camera.aspect)));
    STATE.camera.position.set(0, 0.5, 1).normalize().multiplyScalar(dist);
    STATE.controls.update();
    STATE.orbitLines.forEach((line) => {
        line.material.color.set(0x334455);
        line.material.opacity = 0.5;
    });
    byId('body-picker').value = '';
    byId('info-panel').hidden = true;
}
