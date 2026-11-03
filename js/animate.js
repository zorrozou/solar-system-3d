// 主循环 animate()
// 每帧推进：模拟时间 → 太阳/行星位置和自转 → 月球 → 小行星带 → 飞行/跟踪 → 标签和 LOD → 渲染

import * as THREE from 'three';
import { detailLevel } from './textures.js';
import { STATE } from './state.js';
import { updateSimulation, updateTimeDisplay } from './time.js';

const v = new THREE.Vector3();
let lastPose = NaN;
let lastCoronaTime;
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

    if (
        STATE.simTime !== lastPose &&
        (!Number.isFinite(lastPose) || STATE.paused || Math.abs(STATE.simTime - lastPose) >= 100)
    ) {
        updateSimulation(STATE.simTime);
        lastPose = STATE.simTime;
    }

    // The corona is decorative, but revisiting a date must also reproduce its appearance.
    if (STATE.corona && lastCoronaTime !== STATE.simTime) {
        lastCoronaTime = STATE.simTime;
        const { mesh, directions, rates, offsets } = STATE.corona;
        const positions = mesh.geometry.attributes.position;
        const seconds = STATE.simTime / 1000;
        for (let i = 0; i < positions.count; i++) {
            const r = 5.2 + ((offsets[i] + seconds * rates[i]) % 6.8);
            positions.setXYZ(i, directions[i * 3] * r, directions[i * 3 + 1] * r, directions[i * 3 + 2] * r);
        }
        positions.needsUpdate = true;
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
