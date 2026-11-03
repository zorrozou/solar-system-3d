// UI 控件 / 键盘 / 指针 / resize 事件绑定
// 调用 initUI() 后所有 DOM 上的交互都生效

import { STATE, SPEED_LEVELS, SPEED_LABELS } from './state.js';
import { updatePlanetsPosition, updateTimeDisplay } from './time.js';
import { localFields, parseLocal } from './calendar.js';
import { stopTrack, selectBody } from './tracking.js';

// Bind controls once after the renderer exists.
export function initUI() {
    const ids = ['year', 'month', 'day', 'hour', 'minute', 'second'];
    document.getElementById('body-picker').addEventListener('change', (ev) => selectBody(ev.target.value));
    document.getElementById('overview').addEventListener('click', stopTrack);
    document.getElementById('zone').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
            STATE.lastRealTime = performance.now();
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
                localFields(STATE.simTime).forEach(
                    (n, i) => (document.getElementById(ids[i] + '-input').value = n)
                );
                document.getElementById('time-error').textContent = '';
            }
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', function () {
            const value = parseLocal(ids.map((id) => document.getElementById(id + '-input').value));
            if (value === null) {
                document.getElementById('time-error').textContent =
                    '请输入 2000–2100 年间有效的本地日期和时间。';
                return;
            }
            STATE.simTime = value;
            STATE.lastRealTime = performance.now();
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
            STATE.lastRealTime = performance.now();
            updatePlanetsPosition(STATE.simTime);
            updateTimeDisplay();
        });
    }

    // ---- 键盘 ----
    document.addEventListener('keydown', function (ev) {
        if (
            ev.code !== 'Escape' &&
            (ev.altKey ||
                ev.ctrlKey ||
                ev.metaKey ||
                ev.target.closest?.('input,select,textarea,button,a,[contenteditable="true"]'))
        )
            return;
        if (ev.code === 'Space') {
            ev.preventDefault();
            STATE.paused = !STATE.paused;
            if (pb) pb.textContent = STATE.paused ? '▶ 继续' : '⏸ 暂停';
            STATE.lastRealTime = performance.now();
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
            STATE.lastRealTime = performance.now();
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
        if (downPos && !isDrag && STATE.trackTarget) {
            stopTrack();
        }
        downPos = null;
        isDrag = false;
    });

    // ---- resize 防抖 ----
    STATE.renderer.domElement.addEventListener('pointercancel', () => {
        downPos = null;
        isDrag = false;
    });
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
