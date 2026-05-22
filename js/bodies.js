// 异步加载行星数据 → 创建行星网格 / 月球 / 小行星带
// 通过 STATE.planets / STATE.moon / STATE.earthPlanet / STATE.asteroidBelt 暴露

import * as THREE from 'three';
import { STATE, ASTRO } from './state.js';
import { daysSinceJ2000, solveKepler } from './time.js';
import {
    createSaturnRingTexture,
    createUranusRingTexture,
    addAtmosphere,
} from './factories.js';
import { startTrack, startTrackMoon } from './tracking.js';

// 加载贴图并标记为 sRGB 颜色空间（r155+ 渲染管线要求）
function makeColorTextureLoader() {
    const loader = new THREE.TextureLoader();
    return function loadColorTexture(url) {
        const t = loader.load(url);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    };
}

export async function loadBodies() {
    const loadColorTexture = makeColorTextureLoader();
    const currentDate = new Date(STATE.simTime);
    const daysSinceEpoch = daysSinceJ2000(currentDate);

    let response;
    try {
        response = await fetch('/solar-system/api/planets.php');
    } catch (e) {
        document.getElementById('loading').textContent = '加载失败: ' + e.message;
        throw e;
    }
    const data = await response.json();

    const labelFragment = document.createDocumentFragment();

    data.forEach(function (d) {
        // ---- 轨道参数 ----
        const a = d.distance_from_sun * 30 + 10;
        const e = (d.eccentricity || 0) * ASTRO.ECCENTRICITY_VISUAL_SCALE;
        const inclination = (d.orbital_inclination || 0) * ASTRO.INCLINATION_VISUAL_SCALE * Math.PI / 180;
        const radius = Math.max(d.radius / 6371 * 2, 0.5);

        // ---- 计算初始角度（开普勒方程） ----
        const M0 = (d.mean_anomaly_j2000 || 0) * Math.PI / 180;
        const omega = (d.perihelion_longitude || 0) * Math.PI / 180;
        const meanMotion = 2 * Math.PI / d.orbital_period;
        const M = M0 + meanMotion * daysSinceEpoch;

        const E = solveKepler(M, e);
        const nu = 2 * Math.atan2(
            Math.sqrt(1 + e) * Math.sin(E / 2),
            Math.sqrt(1 - e) * Math.cos(E / 2)
        );

        const angle = (omega + nu) % (2 * Math.PI);
        const r0 = a * (1 - e * e) / (1 + e * Math.cos(nu));
        const x0 = r0 * Math.cos(angle);
        const z0 = -r0 * Math.sin(angle);

        // ---- 纹理 ----
        let texture = null;
        if (d.name === 'Earth') {
            // 地球默认中等分辨率，跟踪近距离时再升级到 high（LOD 在 animate.js 处理）
            texture = loadColorTexture('/solar-system/textures/planets/Earth_mid.jpg');
        } else {
            texture = loadColorTexture('/solar-system/textures/planets/' + d.name + '.jpg?v8k2');
        }

        // 气态行星表面不反光，岩石行星稍反光
        const shininess = (d.name === 'Jupiter' || d.name === 'Saturn' || d.name === 'Uranus' || d.name === 'Neptune') ? 3 : 8;
        const mat = texture
            ? new THREE.MeshPhongMaterial({ map: texture, shininess: shininess })
            : new THREE.MeshPhongMaterial({ color: d.color || 0x888888, shininess: shininess });

        const pivot = new THREE.Object3D();
        const segments = (d.name === 'Earth' || d.name === 'Jupiter' || d.name === 'Saturn') ? 96 : 64;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments), mat);

        // ---- 轴倾角 ----
        const axialTilt = (d.axial_tilt || 0) * Math.PI / 180;
        if (d.name === 'Earth') {
            // 地球北极精确方向（四元数），确保季节方向正确
            pivot.quaternion.set(-0.203129, 0.000000, 0.000000, 0.979152);
        } else if (d.name === 'Uranus') {
            // 天王星几乎侧翻（97.77°）
            pivot.rotation.z = axialTilt;
        } else {
            pivot.rotation.z = axialTilt;
        }
        pivot.add(mesh);

        // ---- 大气层 ----
        if (d.name === 'Earth') addAtmosphere(mesh, radius, 0x4488ff);
        if (d.name === 'Venus') addAtmosphere(mesh, radius, 0xffcc66);
        if (d.name === 'Mars') addAtmosphere(mesh, radius, 0xff6633);

        // ---- 自转轴指示器 ----
        const axisLength = radius * 1.15;
        const axisGeometry = new THREE.CylinderGeometry(0.003, 0.003, axisLength * 2, 8);
        const axisMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.4 });
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

        pivot.position.set(x0, z0 * Math.sin(inclination), z0 * Math.cos(inclination));

        mesh.userData = d;
        STATE.scene.add(pivot);

        // ---- 土星环、天王星环 ----
        if (d.name === 'Saturn') {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(radius * 1.3, radius * 2.2, 128),
                new THREE.MeshBasicMaterial({ map: createSaturnRingTexture(), side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
            );
            ring.rotation.x = Math.PI / 2;
            mesh.add(ring);
        }
        if (d.name === 'Uranus') {
            const uRing = new THREE.Mesh(
                new THREE.RingGeometry(radius * 1.4, radius * 1.7, 32),
                new THREE.MeshBasicMaterial({ map: createUranusRingTexture(), side: 2, transparent: true, opacity: 0.6 })
            );
            uRing.rotation.x = Math.PI / 2;
            mesh.add(uRing);
        }

        // ---- 地球初始自转 ----
        if (d.name === 'Earth') {
            const beijingHour = (currentDate.getUTCHours() + 8 + currentDate.getUTCMinutes() / 60 + currentDate.getUTCSeconds() / 3600) % 24;
            const toSun = Math.atan2(-x0, -z0);
            const rotationFromNoon = (beijingHour - 12) * Math.PI / 12;
            mesh.rotation.y = toSun + rotationFromNoon - ASTRO.BEIJING_LONGITUDE_RAD;
        }

        // ---- 木星初始旋转：让大红斑面向太阳 ----
        if (d.name === 'Jupiter') {
            const jupiterToSun = Math.atan2(-x0, -z0);
            mesh.rotation.y = jupiterToSun;
        }

        // ---- 椭圆轨道线 ----
        const oPts = [];
        for (let i = 0; i <= 256; i++) {
            const theta = i / 256 * Math.PI * 2;
            const rOrbit = a * (1 - e * e) / (1 + e * Math.cos(theta));
            const oAngle = (omega + theta) % (2 * Math.PI);
            const ox = rOrbit * Math.cos(oAngle);
            const oz = -rOrbit * Math.sin(oAngle);
            oPts.push(new THREE.Vector3(ox, oz * Math.sin(inclination), oz * Math.cos(inclination)));
        }
        const orbitLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(oPts),
            new THREE.LineBasicMaterial({ color: 0x334455, transparent: true, opacity: 0.5 })
        );
        STATE.scene.add(orbitLine);
        STATE.orbitLines.push(orbitLine);

        // ---- 标签 ----
        const label = document.createElement('div');
        label.textContent = d.name_cn || d.name;
        label.className = 'planet-label';
        label.style.cssText = 'position:absolute;color:rgba(255,255,255,0.7);font-size:15px;cursor:pointer;text-align:center;white-space:nowrap;padding:2px 6px;border-radius:3px;transition:background 0.2s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transform:translate(-50%,-100%);';
        label.addEventListener('mouseenter', function () {
            this.style.background = 'rgba(255,255,255,0.15)';
            this.style.color = '#fff';
        });
        label.addEventListener('mouseleave', function () {
            this.style.background = 'none';
            this.style.color = 'rgba(255,255,255,0.7)';
        });
        labelFragment.appendChild(label);

        // 闭包捕获 pivot/mesh/radius
        ((pv, ms, r) => {
            label.addEventListener('click', function (ev) {
                if (Date.now() - STATE.lastTrackTime < 250) return;
                STATE.lastTrackTime = Date.now();
                ev.stopPropagation();
                startTrack(pv, ms, r);
            });
            label.addEventListener('touchend', function (ev) {
                if (Date.now() - STATE.lastTrackTime < 250) return;
                STATE.lastTrackTime = Date.now();
                ev.preventDefault();
                ev.stopPropagation();
                startTrack(pv, ms, r);
            });
        })(pivot, mesh, radius);

        const planetObj = {
            pivot: pivot,
            mesh: mesh,
            data: d,
            angle: angle,
            a: a,
            e: e,
            inclination: inclination,
            label: label,
            axialTilt: axialTilt,
        };

        // ---- LOD 纹理（冥王星 / 地球） ----
        if (d.name === 'Pluto') {
            planetObj.lodTextures = {
                low: loadColorTexture('/solar-system/textures/planets/Pluto_low.jpg'),
                mid: loadColorTexture('/solar-system/textures/planets/Pluto_mid.jpg'),
                high: loadColorTexture('/solar-system/textures/planets/Pluto_high.jpg'),
            };
            planetObj.currentLOD = 'mid';
        }
        if (d.name === 'Earth') {
            planetObj.lodTextures = {
                low: loadColorTexture('/solar-system/textures/planets/Earth_low.jpg'),
                mid: loadColorTexture('/solar-system/textures/planets/Earth_mid.jpg'),
                high: loadColorTexture('/solar-system/textures/planets/Earth_high.jpg'),
            };
            planetObj.currentLOD = 'mid';
        }

        STATE.planets.push(planetObj);
        if (d.name === 'Earth') STATE.earthPlanet = planetObj;
    });
    document.getElementById('canvas-container').appendChild(labelFragment);

    // ---- 月球 ----
    if (STATE.earthPlanet) {
        const mMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.27, 64, 64),
            new THREE.MeshPhongMaterial({
                map: loadColorTexture('/solar-system/textures/planets/8k_moon.jpg?v8k3'),
                shininess: 3,
            })
        );
        mMesh.userData = { name: 'Moon', name_cn: '月球', radius: 0.27 };
        STATE.scene.add(mMesh);

        const moonLabel = document.createElement('div');
        moonLabel.textContent = '月球';
        moonLabel.className = 'planet-label';
        moonLabel.style.cssText = 'position:absolute;color:rgba(255,255,255,0.7);font-size:12px;cursor:pointer;text-align:center;white-space:nowrap;padding:2px 6px;border-radius:3px;transition:background 0.2s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transform:translate(-50%,-100%);';
        moonLabel.addEventListener('mouseenter', function () {
            this.style.background = 'rgba(255,255,255,0.15)';
            this.style.color = '#fff';
        });
        moonLabel.addEventListener('mouseleave', function () {
            this.style.background = 'none';
            this.style.color = 'rgba(255,255,255,0.7)';
        });
        moonLabel.addEventListener('click', function (ev) {
            if (Date.now() - STATE.lastTrackTime < 250) return;
            STATE.lastTrackTime = Date.now();
            ev.stopPropagation();
            startTrackMoon(mMesh);
        });
        moonLabel.addEventListener('touchend', function (ev) {
            if (Date.now() - STATE.lastTrackTime < 250) return;
            STATE.lastTrackTime = Date.now();
            ev.preventDefault();
            ev.stopPropagation();
            startTrackMoon(mMesh);
        });
        document.getElementById('canvas-container').appendChild(moonLabel);

        const daysSinceNew = (STATE.simTime - ASTRO.NEW_MOON_REF_MS) / (1000 * 60 * 60 * 24);
        const moonPhase = (daysSinceNew % ASTRO.SYNODIC_MONTH) / ASTRO.SYNODIC_MONTH;
        const sunLongitude = STATE.earthPlanet.angle + Math.PI;
        const moonInitAngle = sunLongitude + moonPhase * 2 * Math.PI;

        STATE.moon = {
            mesh: mMesh,
            earth: STATE.earthPlanet,
            angle: moonInitAngle,
            dist: 4,
            label: moonLabel,
        };
    }

    // ---- 小行星带（4000 颗） ----
    const aPos = [];
    const aColors = [];
    const aCount = 4000;
    for (let i = 0; i < aCount; i++) {
        const ar = (2.2 + Math.random() * 1.1) * 30 + 10;
        const at = Math.random() * Math.PI * 2;
        aPos.push(Math.cos(at) * ar, (Math.random() - 0.5) * 3, -Math.sin(at) * ar);
        STATE.asteroidAngles.push(at);
        const auDist = ar / 30;
        STATE.asteroidPeriods.push(Math.pow(auDist, 1.5) * 365.25);
        // 颜色：碳质暗黑 / 硅质偏褐 / 金属偏亮
        const aColorRand = Math.random();
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

    document.getElementById('loading').style.display = 'none';
}
