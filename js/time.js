import * as THREE from 'three';
import { RotationAxis, Vector } from '../lib/astronomy-2.1.19.js';
import { STATE } from './state.js';
import { astronomyTime, planetPosition, moonOffset, sceneVector, solarTerm } from './ephemeris.js';

const pad = (n) => String(n).padStart(2, '0');
let lastSecond;

export function updateTimeDisplay() {
    const second = Math.floor(STATE.simTime / 1000);
    if (second === lastSecond) return;
    lastSecond = second;
    const d = new Date(STATE.simTime);
    document.getElementById('sim-time').textContent = [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map(pad)
        .join(':');
    document.getElementById('sim-date').textContent = [
        d.getFullYear(),
        pad(d.getMonth() + 1),
        pad(d.getDate()),
    ].join('-');
    document.getElementById('season-info').textContent = solarTerm(astronomyTime(STATE.simTime));
}

// The central meridian of an equirectangular map lies on local +X.
// Construct its IAU pole and prime meridian before applying the rotation angle W.
const prime = new THREE.Vector3(),
    north = new THREE.Vector3(),
    east = new THREE.Vector3();
const basis = new THREE.Matrix4();
function orient(pivot, mesh, name, time) {
    const axis = RotationAxis(name, time);
    const alpha = (axis.ra * Math.PI) / 12;
    const equatorNode = new Vector(-Math.sin(alpha), Math.cos(alpha), 0, time);
    prime.copy(sceneVector(equatorNode));
    north.copy(sceneVector(axis.north)).normalize();
    east.crossVectors(prime, north).normalize();
    basis.makeBasis(prime, north, east);
    pivot.quaternion.setFromRotationMatrix(basis);
    mesh.rotation.y = ((axis.spin % 360) * Math.PI) / 180;
}

export function updatePlanetsPosition(ms) {
    const time = astronomyTime(ms);
    for (const p of STATE.planets) {
        const pos = planetPosition(p.data.name, time);
        p.pivot.position.copy(pos);
        p.data.currentAU = pos.au;
        orient(p.pivot, p.mesh, p.data.name, time);
    }
    if (STATE.moon) {
        const moon = STATE.moon;
        moon.pivot.position.copy(STATE.earthPlanet.pivot.position).add(moonOffset(time));
        orient(moon.pivot, moon.mesh, 'Moon', time);
    }
    const field = document.getElementById('current-distance');
    if (field && STATE.trackTarget?.userData.currentAU != null) {
        const text = STATE.trackTarget.userData.currentAU.toFixed(4) + ' AU';
        if (field.textContent !== text) field.textContent = text;
    }
}
