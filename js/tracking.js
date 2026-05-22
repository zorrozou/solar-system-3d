// 视角跟踪：行星 / 月球 / 飞行动画 / 信息面板
// 飞行动画的 step 在 animate.js 主循环里推进，这里只设置 flyStart/flyEnd

import * as THREE from 'three';
import { STATE } from './state.js';

// 跟踪行星
export function startTrack(targetPivot, targetMesh, radius) {
    // 跟踪时降低其他轨道线透明度，高亮被跟踪行星的轨道
    let targetIdx = -1;
    for (let pi = 0; pi < STATE.planets.length; pi++) {
        if (STATE.planets[pi].pivot === targetPivot) {
            targetIdx = pi;
            break;
        }
    }
    STATE.orbitLines.forEach(function (l, i) {
        if (i === targetIdx) {
            l.material.color.set(0x60a5fa);
            l.material.opacity = 0.8;
        } else {
            l.material.color.set(0x334455);
            l.material.opacity = 0.12;
        }
    });

    const pos = targetPivot.position.clone();
    const r = radius || 1;
    const viewDist = r * 5;
    const targetCamPos = new THREE.Vector3(pos.x + viewDist, pos.y + viewDist * 0.4, pos.z + viewDist);

    STATE.trackTarget = targetPivot;
    STATE.trackOffset = targetCamPos.clone().sub(pos);

    STATE.isFlying = true;
    STATE.flyProgress = 0;
    STATE.flyStart = { cam: STATE.camera.position.clone(), target: STATE.controls.target.clone() };
    STATE.flyEnd = { cam: targetCamPos, target: pos };
    STATE.controls.minDistance = r * 2;

    showInfo(targetMesh.userData);
}

// 跟踪月球
export function startTrackMoon(moonMesh) {
    const pos = moonMesh.position.clone();
    const r = moonMesh.userData.radius || 0.27;
    const viewDist = r * 8;
    const targetCamPos = new THREE.Vector3(pos.x + viewDist, pos.y + viewDist * 0.5, pos.z + viewDist);

    STATE.trackTarget = moonMesh;
    STATE.trackOffset = targetCamPos.clone().sub(pos);

    STATE.isFlying = true;
    STATE.flyProgress = 0;
    STATE.flyStart = { cam: STATE.camera.position.clone(), target: STATE.controls.target.clone() };
    STATE.flyEnd = { cam: targetCamPos, target: pos };
    STATE.controls.minDistance = r * 3;

    showInfo(moonMesh.userData);
}

// 退出跟踪
export function stopTrack() {
    STATE.trackTarget = null;
    STATE.trackOffset = null;
    STATE.isFlying = false;
    STATE.controls.minDistance = 5;
    STATE.orbitLines.forEach(function (l) {
        l.material.color.set(0x334455);
        l.material.opacity = 0.5;
    });
    document.getElementById('info-panel').style.display = 'none';
}

// 显示信息面板
export function showInfo(d) {
    const pa = document.getElementById('info-panel');
    const pn = document.getElementById('planet-name');
    const pi = document.getElementById('planet-info');
    if (!pa || !d) return;
    pa.style.display = 'block';
    if (pn) pn.textContent = (d.name_cn || d.name) + ' (' + d.name + ')';
    let h = '';
    if (d.distance_from_sun) h += '<div class="stat"><span class="stat-label">距太阳</span><span class="stat-value">' + d.distance_from_sun + ' AU</span></div>';
    if (d.orbital_period) h += '<div class="stat"><span class="stat-label">公转周期</span><span class="stat-value">' + d.orbital_period.toFixed(1) + ' 天</span></div>';
    if (d.rotation_period) h += '<div class="stat"><span class="stat-label">自转周期</span><span class="stat-value">' + d.rotation_period.toFixed(2) + ' 天</span></div>';
    if (d.radius) h += '<div class="stat"><span class="stat-label">半径</span><span class="stat-value">' + d.radius.toFixed(0) + ' km</span></div>';
    if (d.moons !== undefined) h += '<div class="stat"><span class="stat-label">卫星</span><span class="stat-value">' + d.moons + ' 颗</span></div>';
    if (d.axial_tilt) h += '<div class="stat"><span class="stat-label">轴倾角</span><span class="stat-value">' + d.axial_tilt.toFixed(1) + '°</span></div>';

    if (d.description) h += '<p class="planet-desc">' + d.description + '</p>';
    h += '<div style="margin-top:10px;color:rgba(255,255,255,0.4);font-size:11px;">跟踪中 · 点击空白退出</div>';
    if (pi) pi.innerHTML = h;
}
