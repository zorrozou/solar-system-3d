import * as THREE from 'three';
import { Observer, ObserverVector, RotationAxis, Vector, HelioVector } from '../lib/astronomy-2.1.19.js';
import { orbitPoints } from './orbits.js';
import { STATE } from './state.js';
import { astronomyTime, planetPosition, moonOffset, sceneVector, solarTerm, DAY } from './ephemeris.js';

const pad = (n) => String(n).padStart(2, '0');
let lastSecond;
let orbitEpoch;

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
const greenwich = new Observer(0, 0, 0);
function orient(pivot, mesh, name, time) {
    const axis = RotationAxis(name, time);
    north.copy(sceneVector(axis.north)).normalize();
    let spin = 0;
    if (name === 'Earth') {
        // The terrestrial prime meridian is defined even with the pole at the celestial pole.
        prime.copy(sceneVector(ObserverVector(time, greenwich, false))).normalize();
    } else {
        const alpha = (axis.ra * Math.PI) / 12;
        prime.copy(sceneVector(new Vector(-Math.sin(alpha), Math.cos(alpha), 0, time)));
        spin = ((axis.spin % 360) * Math.PI) / 180;
    }
    east.crossVectors(prime, north).normalize();
    basis.makeBasis(prime, north, east);
    pivot.quaternion.setFromRotationMatrix(basis);
    if (pivot === mesh) pivot.rotateY(spin);
    else mesh.rotation.y = spin;
}

export function updateSimulation(ms) {
    const time = astronomyTime(ms);
    const days = (ms - Date.UTC(2000, 0, 1, 12)) / DAY;
    if (STATE.sunMesh) {
        orient(STATE.sunMesh, STATE.sunMesh, 'Sun', time);
        STATE.sunMesh.scale.setScalar(1 + Math.sin(days * 0.5) * 0.02);
    }
    if (STATE.asteroidBelt) {
        const positions = STATE.asteroidBelt.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const angle = STATE.asteroidAngles[i] + (days / STATE.asteroidPeriods[i]) * 2 * Math.PI;
            positions.setX(i, Math.cos(angle) * STATE.asteroidDists[i]);
            positions.setZ(i, -Math.sin(angle) * STATE.asteroidDists[i]);
        }
        positions.needsUpdate = true;
    }
    for (const p of STATE.planets) {
        const pos = planetPosition(p.data.name, time);
        p.pivot.position.copy(pos);
        p.data.currentAU = pos.au;
        p.surface.sunDirection.copy(pos).negate().normalize();
        orient(p.pivot, p.mesh, p.data.name, time);
    }
    if (STATE.moon) {
        const moon = STATE.moon;
        moon.pivot.position.copy(STATE.earthPlanet.pivot.position).add(moonOffset(time));
        orient(moon.pivot, moon.mesh, 'Moon', time);
        moon.surface.sunDirection
            .copy(sceneVector(HelioVector('Moon', time)))
            .negate()
            .normalize();
    }
    // Each UTC month uses one deterministic osculating orbit, even after a seek.
    const date = time.date;
    const epoch = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12);
    if (STATE.planets.length && epoch !== orbitEpoch) {
        STATE.planets.forEach((p, i) => {
            const geometry = STATE.orbitLines[i].geometry;
            geometry.setFromPoints(orbitPoints(p.data.name, epoch));
            geometry.computeBoundingSphere();
        });
        orbitEpoch = epoch;
    }
    const field = document.getElementById('current-distance');
    if (field && STATE.trackTarget?.userData.currentAU != null) {
        const text = STATE.trackTarget.userData.currentAU.toFixed(4) + ' AU';
        if (field.textContent !== text) field.textContent = text;
    }
}
