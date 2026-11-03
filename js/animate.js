// 主循环 animate()
// 每帧推进：模拟时间 → 太阳/行星位置和自转 → 月球 → 小行星带 → 飞行/跟踪 → 标签和 LOD → 渲染

import * as THREE from 'three';
import { detailLevel } from './textures.js';
import { orbitPoints } from './orbits.js';
import { DAY } from './ephemeris.js';
import { STATE } from './state.js';
import { updatePlanetsPosition, updateTimeDisplay } from './time.js';

const v = new THREE.Vector3();
let lastPose = NaN;
let orbitEpoch;
const endTime = new Date(2101, 0, 1).getTime() - 1;

// Labels share one overlay. Keep the projected X coordinate and move crowded
// labels vertically, with a leader back to the original projected position.
function placeLabel(label, x, y, occupied) {
    const halfWidth = 7 * label.textContent.length + 7;
    if (x < halfWidth || x + halfWidth > innerWidth) return false;
    for (const offset of [0, -24, 24, -48, 48, -72, 72, -96, 96]) {
        const bottom = y + offset;
        if (bottom < 23 || bottom > innerHeight) continue;
        if (
            occupied.some(
                (box) => Math.abs(box.x - x) < box.halfWidth + halfWidth && Math.abs(box.bottom - bottom) < 24
            )
        )
            continue;
        occupied.push({ x, halfWidth, bottom });
        label.style.left = x + 'px';
        label.style.top = bottom + 'px';
        label.style.setProperty(
            '--leader-height',
            Math.max(0, Math.abs(offset) - (offset > 0 ? 22 : 0)) + 'px'
        );
        label.classList.toggle('below-anchor', offset > 0);
        return true;
    }
    return false;
}

export function animate() {
    requestAnimationFrame(animate);

    // ---- 真实时间流逝 ----
    const realNow = performance.now();
    let realElapsed = realNow - STATE.lastRealTime;
    // delta cap：防止切标签页回来时模拟时间跳变
    if (realElapsed > 2000) realElapsed = 2000;
    STATE.lastRealTime = realNow;

    // ---- 推进模拟时间 ----
    if (!STATE.paused) {
        STATE.simTime += realElapsed * STATE.speedMultiplier;
        if (STATE.simTime >= endTime) {
            STATE.simTime = endTime;
            STATE.paused = true;
            document.getElementById('pause-btn').textContent = '▶ 继续';
        }
        updateTimeDisplay();
    }

    const dt_seconds = STATE.paused ? 0 : (realElapsed * STATE.speedMultiplier) / 1000;
    const dt_days = dt_seconds / 86400;

    // ---- 太阳自转 + 脉动 + 日冕粒子 ----
    if (STATE.sunMesh) {
        const sunRotationPeriod = 25.4;
        STATE.sunMesh.rotation.y += (dt_days / sunRotationPeriod) * 2 * Math.PI;
        STATE.sunPulse += dt_days * 0.5;
        STATE.sunMesh.scale.setScalar(1 + Math.sin(STATE.sunPulse) * 0.02);

        if (STATE.corona && !STATE.paused) {
            const cp = STATE.corona.mesh.geometry.attributes.position.array;
            for (let ci = 0; ci < STATE.corona.count; ci++) {
                const cx = cp[ci * 3];
                const cy = cp[ci * 3 + 1];
                const cz = cp[ci * 3 + 2];
                const cd = Math.sqrt(cx * cx + cy * cy + cz * cz);
                cp[ci * 3] += (cx / cd) * STATE.corona.vels[ci] * realElapsed * 0.06;
                cp[ci * 3 + 1] += (cy / cd) * STATE.corona.vels[ci] * realElapsed * 0.06;
                cp[ci * 3 + 2] += (cz / cd) * STATE.corona.vels[ci] * realElapsed * 0.06;
                if (cd > 12) {
                    const ct = Math.random() * Math.PI * 2;
                    const cpp = Math.acos(2 * Math.random() - 1);
                    cp[ci * 3] = 5.2 * Math.sin(cpp) * Math.cos(ct);
                    cp[ci * 3 + 1] = 5.2 * Math.sin(cpp) * Math.sin(ct);
                    cp[ci * 3 + 2] = 5.2 * Math.cos(cpp);
                }
            }
            STATE.corona.mesh.geometry.attributes.position.needsUpdate = true;
        }
    }

    // Quantize only sub-second motion. Time jumps, including while paused, are exact.
    if (STATE.planets.length && (!Number.isFinite(lastPose) || Math.abs(STATE.simTime - lastPose) >= 300)) {
        updatePlanetsPosition(STATE.simTime);
        lastPose = STATE.simTime;
    }
    if (STATE.planets.length && orbitEpoch === undefined) orbitEpoch = STATE.simTime;
    if (Math.abs(STATE.simTime - orbitEpoch) > 30 * DAY) {
        STATE.planets.forEach((p, i) => {
            const geometry = STATE.orbitLines[i].geometry;
            geometry.setFromPoints(orbitPoints(p.data.name, STATE.simTime));
            geometry.computeBoundingSphere();
        });
        orbitEpoch = STATE.simTime;
    }

    // ---- 小行星带（每 3 帧更新一次） ----
    if (STATE.asteroidBelt && !STATE.paused) {
        STATE.asteroidFrame++;
        if (STATE.asteroidFrame % 3 === 0) {
            const positions = STATE.asteroidBelt.geometry.attributes.position.array;
            const days = (STATE.simTime - Date.UTC(2000, 0, 1, 12)) / DAY;
            for (let i = 0; i < STATE.asteroidAngles.length; i++) {
                const angle = STATE.asteroidAngles[i] + (days / STATE.asteroidPeriods[i]) * 2 * Math.PI;
                positions[i * 3] = Math.cos(angle) * STATE.asteroidDists[i];
                positions[i * 3 + 2] = -Math.sin(angle) * STATE.asteroidDists[i];
            }
            STATE.asteroidBelt.geometry.attributes.position.needsUpdate = true;
        }
    }

    if (STATE.trackTarget && !STATE.isDragging) {
        const pos = STATE.trackTarget.position;
        v.copy(pos).add(STATE.trackOffset);
        if (STATE.isFlying) {
            STATE.flyProgress = Math.min(1, STATE.flyProgress + realElapsed / 700);
            const t = STATE.flyProgress;
            const ease = t * t * (3 - 2 * t);
            STATE.camera.position.lerpVectors(STATE.flyStart.cam, v, ease);
            STATE.controls.target.lerpVectors(STATE.flyStart.target, pos, ease);
            if (t === 1) STATE.isFlying = false;
        } else {
            STATE.camera.position.copy(v);
            STATE.controls.target.copy(pos);
        }
    }
    STATE.controls.update();
    STATE.camera.updateMatrixWorld();
    if (STATE.frameCount % 3 === 0) {
        const occupied = [];
        function labelAt(label, pivot, height, surface) {
            v.copy(pivot.position);
            v.y += height;
            v.project(STATE.camera);
            const visible = Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && Math.abs(v.z) <= 1;
            label.hidden =
                !visible ||
                !placeLabel(label, ((v.x + 1) * innerWidth) / 2, ((1 - v.y) * innerHeight) / 2, occupied);
            if (surface) {
                const dist = STATE.camera.position.distanceTo(pivot.position);
                const threshold = Math.max(4, height * (surface.near ? 18 : 14));
                detailLevel(surface, visible && dist < threshold);
            }
        }
        for (const p of STATE.planets)
            labelAt(p.label, p.pivot, p.mesh.geometry.parameters.radius + 0.35, p.surface);
        if (STATE.sunLabel) labelAt(STATE.sunLabel, STATE.sunMesh, 6);
        if (STATE.moon) labelAt(STATE.moon.label, STATE.moon.pivot, 0.5, STATE.moon.surface);
    }
    STATE.renderer.render(STATE.scene, STATE.camera);
    STATE.frameCount++;
}
