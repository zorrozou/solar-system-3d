// 主循环 animate()
// 每帧推进：模拟时间 → 太阳/行星位置和自转 → 月球 → 小行星带 → 飞行/跟踪 → 标签和 LOD → 渲染

import * as THREE from 'three';
import { STATE, ASTRO } from './state.js';
import { updatePlanetsPosition, updateTimeDisplay } from './time.js';

export function animate() {
    requestAnimationFrame(animate);

    // ---- 真实时间流逝 ----
    const realNow = Date.now();
    let realElapsed = realNow - STATE.lastRealTime;
    // delta cap：防止切标签页回来时模拟时间跳变
    if (realElapsed > 2000) realElapsed = 2000;
    STATE.lastRealTime = realNow;

    // ---- 推进模拟时间 ----
    if (!STATE.paused) {
        STATE.simTime += realElapsed * STATE.speedMultiplier;
        updateTimeDisplay();
    }

    const dt_seconds = STATE.paused ? 0 : realElapsed * STATE.speedMultiplier / 1000;
    const dt_days = dt_seconds / 86400;

    // ---- 太阳自转 + 脉动 + 日冕粒子 ----
    if (STATE.sunMesh) {
        const sunRotationPeriod = 25.4;
        STATE.sunMesh.rotation.y += dt_days / sunRotationPeriod * 2 * Math.PI;
        STATE.sunPulse += dt_days * 0.5;
        STATE.sunMesh.scale.setScalar(1 + Math.sin(STATE.sunPulse) * 0.02);

        if (STATE.corona && !STATE.paused) {
            const cp = STATE.corona.mesh.geometry.attributes.position.array;
            for (let ci = 0; ci < STATE.corona.count; ci++) {
                const cx = cp[ci * 3];
                const cy = cp[ci * 3 + 1];
                const cz = cp[ci * 3 + 2];
                const cd = Math.sqrt(cx * cx + cy * cy + cz * cz);
                cp[ci * 3] += (cx / cd) * STATE.corona.vels[ci];
                cp[ci * 3 + 1] += (cy / cd) * STATE.corona.vels[ci];
                cp[ci * 3 + 2] += (cz / cd) * STATE.corona.vels[ci];
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

    // ---- 用开普勒方程更新所有行星位置（含地球自转） ----
    if (!STATE.paused) {
        updatePlanetsPosition(STATE.simTime);

        // 非地球行星自转（地球已在 updatePlanetsPosition 中精确处理）
        STATE.planets.forEach(function (p) {
            if (p.data.name !== 'Earth') {
                const rotationPeriod = p.data.rotation_period || 1;
                const rotationDir = rotationPeriod < 0 ? -1 : 1;
                p.mesh.rotation.y += rotationDir * dt_days / Math.abs(rotationPeriod) * 2 * Math.PI;
            } else {
                // 地球表面附加自转（叠在精确朝向之上）
                p.mesh.rotation.y += dt_days * 1.0 * 2 * Math.PI;
            }
        });
    }

    // ---- 月球（使用 updatePlanetsPosition 中算好的 moon.angle） ----
    if (STATE.moon) {
        STATE.moon.mesh.position.x = STATE.moon.earth.pivot.position.x + Math.cos(STATE.moon.angle) * STATE.moon.dist;
        STATE.moon.mesh.position.y = STATE.moon.earth.pivot.position.y + Math.sin(STATE.moon.angle) * Math.sin(ASTRO.MOON_INCLINATION) * STATE.moon.dist;
        STATE.moon.mesh.position.z = STATE.moon.earth.pivot.position.z + Math.sin(STATE.moon.angle) * Math.cos(ASTRO.MOON_INCLINATION) * STATE.moon.dist;
        STATE.moon.mesh.rotation.y = STATE.moon.angle;
    }

    // ---- 小行星带（每 3 帧更新一次） ----
    if (STATE.asteroidBelt && !STATE.paused) {
        STATE.asteroidFrame++;
        if (STATE.asteroidFrame % 3 === 0) {
            const positions = STATE.asteroidBelt.geometry.attributes.position.array;
            const aDt = dt_days * 3;
            for (let i = 0; i < STATE.asteroidAngles.length; i++) {
                STATE.asteroidAngles[i] += aDt / STATE.asteroidPeriods[i] * 2 * Math.PI;
                positions[i * 3] = Math.cos(STATE.asteroidAngles[i]) * STATE.asteroidDists[i];
                positions[i * 3 + 2] = -Math.sin(STATE.asteroidAngles[i]) * STATE.asteroidDists[i];
            }
            STATE.asteroidBelt.geometry.attributes.position.needsUpdate = true;
        }
    }

    // ---- 飞行动画 ----
    if (STATE.isFlying && STATE.flyStart && STATE.flyEnd && STATE.flyStart.cam && STATE.flyEnd.cam) {
        STATE.flyProgress += 0.02;
        if (STATE.flyProgress >= 1) {
            STATE.flyProgress = 1;
            STATE.isFlying = false;
            STATE.flyStart = null;
            STATE.flyEnd = null;
        } else {
            const t = STATE.flyProgress < 0.5 ? 2 * STATE.flyProgress * STATE.flyProgress : 1 - Math.pow(-2 * STATE.flyProgress + 2, 2) / 2;
            STATE.camera.position.lerpVectors(STATE.flyStart.cam, STATE.flyEnd.cam, t);
            STATE.controls.target.lerpVectors(STATE.flyStart.target, STATE.flyEnd.target, t);
        }
    }

    // ---- 跟踪 ----
    if (STATE.trackTarget && STATE.trackOffset && !STATE.isFlying && !STATE.isDragging) {
        const targetPos = STATE.trackTarget.position.clone();
        STATE.camera.position.copy(targetPos.clone().add(STATE.trackOffset));
        STATE.controls.target.copy(targetPos);
    }

    // ---- 标签投影 + LOD（每 3 帧） ----
    const updateLabels = (STATE.frameCount % 3 === 0);
    if (updateLabels) {
        STATE.planets.forEach(function (p) {
            if (p.label) {
                const v = p.pivot.position.clone();
                v.y += p.mesh.geometry.parameters.radius + 0.5;
                v.project(STATE.camera);
                if (v.z < 1) {
                    const dist = STATE.camera.position.distanceTo(p.pivot.position);
                    const opacity = Math.max(0.3, Math.min(1, 50 / dist));
                    p.label.style.display = 'block';
                    p.label.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
                    p.label.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
                    p.label.style.opacity = opacity;
                    // LOD 纹理切换（地球 / 冥王星）
                    if (p.lodTextures) {
                        const newLOD = dist > 80 ? 'low' : (dist > 20 ? 'mid' : 'high');
                        if (newLOD !== p.currentLOD) {
                            p.mesh.material.map = p.lodTextures[newLOD];
                            p.mesh.material.needsUpdate = true;
                            p.currentLOD = newLOD;
                        }
                    }
                } else {
                    p.label.style.display = 'none';
                }
            }
        });

        // 太阳标签位置
        if (STATE.sunLabel) {
            const sv = new THREE.Vector3(0, 6, 0).project(STATE.camera);
            if (sv.z < 1) {
                STATE.sunLabel.style.display = 'block';
                STATE.sunLabel.style.left = ((sv.x * 0.5 + 0.5) * window.innerWidth) + 'px';
                STATE.sunLabel.style.top = ((-sv.y * 0.5 + 0.5) * window.innerHeight) + 'px';
            } else {
                STATE.sunLabel.style.display = 'none';
            }
        }

        // 月球标签
        if (STATE.moon && STATE.moon.label) {
            const mv = STATE.moon.mesh.position.clone();
            mv.y += 0.5;
            mv.project(STATE.camera);
            if (mv.z < 1) {
                const moonDist = STATE.camera.position.distanceTo(STATE.moon.earth.pivot.position);
                const moonScale = Math.max(0.7, Math.min(1.2, 30 / moonDist));
                STATE.moon.label.style.display = 'block';
                STATE.moon.label.style.left = ((mv.x * 0.5 + 0.5) * window.innerWidth) + 'px';
                STATE.moon.label.style.top = ((-mv.y * 0.5 + 0.5) * window.innerHeight) + 'px';
                STATE.moon.label.style.fontSize = (12 * moonScale) + 'px';
                STATE.moon.label.style.opacity = Math.max(0.3, Math.min(1, 50 / moonDist));
            } else {
                STATE.moon.label.style.display = 'none';
            }
        }
    }

    STATE.controls.update();
    STATE.renderer.render(STATE.scene, STATE.camera);
    STATE.frameCount++;
}
