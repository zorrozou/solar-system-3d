import * as THREE from 'three';
import { STATE } from './state.js';
import {
    createSaturnRingTexture,
    createUranusRingTexture,
    addAtmosphere,
    seededRandom,
} from './factories.js';
import { updateSimulation } from './time.js';
import { makeSurface, sceneReady } from './textures.js';
import { registerTarget } from './tracking.js';

const bodyNames = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

export async function fetchCatalog() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch('/solar-system/api/planets.php', { signal: controller.signal });
        if (!response.ok) throw new Error('天体数据暂不可用');
        const rows = await response.json();
        if (
            !Array.isArray(rows) ||
            rows.length !== bodyNames.length ||
            !bodyNames.every((name) =>
                rows.some(
                    (r) =>
                        r?.name === name &&
                        Number.isFinite(r.radius) &&
                        r.radius > 0 &&
                        Number.isFinite(r.distance_from_sun) &&
                        r.distance_from_sun > 0
                )
            )
        )
            throw new Error('天体数据不完整');
        return rows;
    } finally {
        clearTimeout(timeout);
    }
}

export function createBodies(data) {
    for (const d of data) {
        const radius = Math.max(0.45, 1.25 * Math.pow(d.radius / 6371, 0.53));
        const pivot = new THREE.Object3D();
        const mat = new THREE.MeshPhongMaterial({ color: d.color || 0x888888, shininess: 5 });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), mat);
        pivot.add(mesh);
        const surface = makeSurface(mesh, d.name);
        if (d.name === 'Earth') addAtmosphere(mesh, radius, 0x4488ff);
        if (d.name === 'Venus') addAtmosphere(mesh, radius, 0xffcc66);
        if (d.name === 'Mars') addAtmosphere(mesh, radius, 0xff6633);
        // ---- 自转轴指示器 ----
        const axisLength = radius * 1.15;
        const axisGeometry = new THREE.CylinderGeometry(0.003, 0.003, axisLength * 2, 8);
        const axisMaterial = new THREE.MeshBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.4,
        });
        const axisMesh = new THREE.Mesh(axisGeometry, axisMaterial);
        pivot.add(axisMesh);

        const northPole = new THREE.Mesh(
            new THREE.SphereGeometry(0.03, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xaaaaaa })
        );
        northPole.position.y = axisLength;
        axisMesh.add(northPole);

        const southPole = new THREE.Mesh(
            new THREE.SphereGeometry(0.025, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x666666 })
        );
        southPole.position.y = -axisLength;
        axisMesh.add(southPole);

        // ---- 土星环、天王星环 ----
        if (d.name === 'Saturn') {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(radius * 1.3, radius * 2.2, 128),
                new THREE.MeshBasicMaterial({
                    map: createSaturnRingTexture(),
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.9,
                })
            );
            ring.rotation.x = Math.PI / 2;
            mesh.add(ring);
        }
        if (d.name === 'Uranus') {
            const uRing = new THREE.Mesh(
                new THREE.RingGeometry(radius * 1.4, radius * 1.7, 32),
                new THREE.MeshBasicMaterial({
                    map: createUranusRingTexture(),
                    side: 2,
                    transparent: true,
                    opacity: 0.6,
                })
            );
            uRing.rotation.x = Math.PI / 2;
            mesh.add(uRing);
        }

        STATE.scene.add(pivot);
        const line = new THREE.LineLoop(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0x334455, transparent: true, opacity: 0.5 })
        );
        STATE.scene.add(line);
        STATE.orbitLines.push(line);
        const label = registerTarget(pivot, radius, d, line);
        const planet = { pivot, mesh, label, surface, data: d };
        STATE.planets.push(planet);
        if (d.name === 'Earth') STATE.earthPlanet = planet;
    }
    const pivot = new THREE.Object3D();
    const radius = 0.34;
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 48, 32),
        new THREE.MeshPhongMaterial({ color: 0xaaaaaa })
    );
    pivot.add(mesh);
    STATE.scene.add(pivot);
    const dataMoon = {
        name: 'Moon',
        name_cn: '月球',
        radius: 1737.4,
        rotation_period: 27.3217,
        description: '月球是地球的天然卫星。月相由日、地、月三者的相对位置决定。',
    };
    const label = registerTarget(pivot, radius, dataMoon);
    STATE.moon = { pivot, mesh, label, surface: makeSurface(mesh, 'Moon') };
    // ---- 小行星带（4000 颗） ----
    const aPos = [];
    const aColors = [];
    const random = seededRandom(2026);
    const aCount = 4000;
    for (let i = 0; i < aCount; i++) {
        const ar = (2.2 + random() * 1.1) * 30 + 10;
        const at = random() * Math.PI * 2;
        aPos.push(Math.cos(at) * ar, (random() - 0.5) * 3, -Math.sin(at) * ar);
        STATE.asteroidAngles.push(at);
        const auDist = (ar - 10) / 30;
        STATE.asteroidPeriods.push(Math.pow(auDist, 1.5) * 365.25);
        // 颜色：碳质暗黑 / 硅质偏褐 / 金属偏亮
        const aColorRand = random();
        if (aColorRand < 0.5) {
            aColors.push(0.35, 0.33, 0.3);
        } else if (aColorRand < 0.8) {
            aColors.push(0.5, 0.42, 0.35);
        } else {
            aColors.push(0.6, 0.58, 0.55);
        }
        STATE.asteroidDists.push(ar);
    }
    const aGeo = new THREE.BufferGeometry();
    aGeo.setAttribute('position', new THREE.Float32BufferAttribute(aPos, 3));
    aGeo.setAttribute('color', new THREE.Float32BufferAttribute(aColors, 3));
    STATE.asteroidBelt = new THREE.Points(
        aGeo,
        new THREE.PointsMaterial({ size: 0.3, transparent: true, opacity: 0.6, vertexColors: true })
    );
    STATE.scene.add(STATE.asteroidBelt);

    updateSimulation(STATE.simTime);
    sceneReady();
}
