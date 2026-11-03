import * as THREE from 'three';
import { HelioState, Vector } from '../lib/astronomy-2.1.19.js';
import { astronomyTime, sceneVector } from './ephemeris.js';

// Instantaneous ellipse in the same reference frame and scale as the planet.
export function orbitPoints(name, ms) {
    const time = astronomyTime(ms);
    const s = HelioState(name, time);
    const r = new THREE.Vector3().copy(sceneVector(new Vector(s.x, s.y, s.z, time)));
    const v = new THREE.Vector3().copy(sceneVector(new Vector(s.vx, s.vy, s.vz, time)));
    const h = new THREE.Vector3().crossVectors(r, v);
    const mu = 0.0002959122082855911; // solar GM in AU³/day²
    const axis = new THREE.Vector3().crossVectors(v, h).divideScalar(mu).sub(r.clone().normalize());
    const e = axis.length();
    axis.normalize();
    const transverse = new THREE.Vector3().crossVectors(h, axis).normalize();
    const latus = h.lengthSq() / mu;
    const points = [];
    for (let i = 0; i < 192; i++) {
        const t = (i * 2 * Math.PI) / 192;
        const dist = (30 * latus) / (1 + e * Math.cos(t)) + 10;
        points.push(
            axis
                .clone()
                .multiplyScalar(dist * Math.cos(t))
                .addScaledVector(transverse, dist * Math.sin(t))
        );
    }
    return points;
}
