// UI 控件 / 键盘 / 指针 / resize 事件绑定
// 调用 initUI() 后所有 DOM 上的交互都生效

import { STATE, SPEED_LEVELS, SPEED_LABELS } from './state.js';
import { updatePlanetsPosition, updateTimeDisplay } from './time.js';
import { stopTrack, showInfo } from './tracking.js';

// 太阳点击：在 sunMesh 创建好之后绑定（initUI 里处理）
export function initUI() {
    // ---- 太阳标签点击 → 显示太阳信息 ----
    if (STATE.sunLabel && STATE.sunMesh) {
        STATE.sunLabel.addEventListener('click', function (ev) {
            ev.stopPropagation();
            showInfo(STATE.sunMesh.userData);
        });
    }

    // ---- 速率滑块 ----
    const speedSlider = document.getElementById('speed-slider');
    const speedValueEl = document.getElementById('speed-value');

    function updateSpeedDisplay() {
        if (speedValueEl) speedValueEl.textContent = SPEED_LABELS[STATE.currentSpeedIndex];
        if (speedSlider) speedSlider.value = STATE.currentSpeedIndex;
    }

    if (speedSlider) {
        speedSlider.addEventListener('input', function () {
            STATE.currentSpeedIndex = parseInt(this.value);
            STATE.speedMultiplier = SPEED_LEVELS[STATE.currentSpeedIndex];
            updateSpeedDisplay();
        });
        updateSpeedDisplay();
    }

    // ---- 暂停按钮 ----
    const pb = document.getElementById('pause-btn');
    if (pb) {
        pb.addEventListener('click', function () {
            STATE.paused = !STATE.paused;
            pb.textContent = STATE.paused ? '▶ 继续' : '⏸ 暂停';
            STATE.lastRealTime = Date.now();
        });
    }

    // ---- 调整时间按钮 ----
    const adjustBtn = document.getElementById('adjust-btn');
    const timeAdjust = document.getElementById('time-adjust');
    const applyBtn = document.getElementById('apply-time');

    if (adjustBtn && timeAdjust) {
        adjustBtn.addEventListener('click', function () {
            timeAdjust.classList.toggle('show');
            if (timeAdjust.classList.contains('show')) {
                const d = new Date(STATE.simTime);
                document.getElementById('year-input').value = d.getFullYear();
                document.getElementById('month-input').value = d.getMonth() + 1;
                document.getElementById('day-input').value = d.getDate();
                document.getElementById('hour-input').value = d.getHours();
                document.getElementById('minute-input').value = d.getMinutes();
                document.getElementById('second-input').value = d.getSeconds();
            }
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', function () {
            const year = parseInt(document.getElementById('year-input').value);
            const month = parseInt(document.getElementById('month-input').value) - 1;
            const day = parseInt(document.getElementById('day-input').value);
            const hour = parseInt(document.getElementById('hour-input').value);
            const minute = parseInt(document.getElementById('minute-input').value);
            const second = parseInt(document.getElementById('second-input').value);

            STATE.simTime = Date.UTC(year, month, day, hour, minute, second);
            STATE.lastRealTime = Date.now();
            updatePlanetsPosition(STATE.simTime);
            updateTimeDisplay();
            timeAdjust.classList.remove('show');
        });
    }

    // ---- 重置到当前时间 ----
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            STATE.simTime = Date.now();
            STATE.lastRealTime = Date.now();
            updatePlanetsPosition(STATE.simTime);
            updateTimeDisplay();
        });
    }

    // ---- 键盘 ----
    document.addEventListener('keydown', function (ev) {
        if (ev.code === 'Space') {
            ev.preventDefault();
            STATE.paused = !STATE.paused;
            if (pb) pb.textContent = STATE.paused ? '▶ 继续' : '⏸ 暂停';
            STATE.lastRealTime = Date.now();
        }
        if (ev.code === 'Equal' || ev.code === 'NumpadAdd' || ev.code === 'ArrowRight') {
            STATE.currentSpeedIndex = Math.min(STATE.currentSpeedIndex + 1, SPEED_LEVELS.length - 1);
            STATE.speedMultiplier = SPEED_LEVELS[STATE.currentSpeedIndex];
            updateSpeedDisplay();
        }
        if (ev.code === 'Minus' || ev.code === 'NumpadSubtract' || ev.code === 'ArrowLeft') {
            STATE.currentSpeedIndex = Math.max(STATE.currentSpeedIndex - 1, 0);
            STATE.speedMultiplier = SPEED_LEVELS[STATE.currentSpeedIndex];
            updateSpeedDisplay();
        }
        if (ev.code === 'KeyR') {
            STATE.simTime = Date.now();
            STATE.lastRealTime = Date.now();
            updatePlanetsPosition(STATE.simTime);
            updateTimeDisplay();
        }
        if (ev.code === 'Escape') {
            stopTrack();
            if (timeAdjust) timeAdjust.classList.remove('show');
        }
    });

    // ---- 点击/拖动检测（Pointer Events 统一鼠标和触摸）----
    let downPos = null;
    let isDrag = false;
    const DRAG_THRESHOLD = 5;

    STATE.renderer.domElement.addEventListener('pointerdown', function (ev) {
        downPos = { x: ev.clientX, y: ev.clientY };
        isDrag = false;
    });

    STATE.renderer.domElement.addEventListener('pointermove', function (ev) {
        if (downPos) {
            const dx = ev.clientX - downPos.x;
            const dy = ev.clientY - downPos.y;
            if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
                isDrag = true;
            }
        }
    });

    STATE.renderer.domElement.addEventListener('pointerup', function () {
        if (!isDrag && STATE.trackTarget) {
            stopTrack();
        }
        downPos = null;
        isDrag = false;
    });

    // ---- resize 防抖 ----
    let resizeTimer = null;
    window.addEventListener('resize', function () {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            STATE.camera.aspect = window.innerWidth / window.innerHeight;
            STATE.camera.updateProjectionMatrix();
            STATE.renderer.setSize(window.innerWidth, window.innerHeight);
        }, 150);
    });
}
