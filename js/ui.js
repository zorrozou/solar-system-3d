// UI 控件 / 键盘 / 指针 / resize 事件绑定
// 调用 initUI() 后所有 DOM 上的交互都生效

import { STATE, SPEED_LEVELS, SPEED_LABELS } from './state.js';
import { updateSimulation, updateTimeDisplay } from './time.js';
import { localFields, localInstants, parseLocal } from './calendar.js';
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

    const fold = document.getElementById('time-fold');
    const offsetSelect = document.getElementById('time-offset');
    const inputFields = () => ids.map((id) => document.getElementById(id + '-input').value);
    let preferredOffset;
    function refreshOffsets() {
        const times = localInstants(inputFields());
        fold.hidden = times.length < 2;
        if (fold.hidden) return;
        offsetSelect.replaceChildren();
        for (const ms of times) {
            const date = new Date(ms);
            const zone = new Intl.DateTimeFormat('zh-CN', { timeZoneName: 'longOffset' })
                .formatToParts(date)
                .find((part) => part.type === 'timeZoneName').value;
            offsetSelect.add(new Option(zone, String(date.getTimezoneOffset())));
        }
        const selected = parseLocal(inputFields(), preferredOffset);
        offsetSelect.value = String(new Date(selected).getTimezoneOffset());
    }
    for (const id of ids) document.getElementById(id + '-input').addEventListener('input', refreshOffsets);
    offsetSelect.addEventListener('change', () => {
        preferredOffset = Number(offsetSelect.value);
    });

    if (adjustBtn && timeAdjust) {
        adjustBtn.addEventListener('click', function () {
            timeAdjust.classList.toggle('show');
            if (timeAdjust.classList.contains('show')) {
                localFields(STATE.simTime).forEach(
                    (n, i) => (document.getElementById(ids[i] + '-input').value = n)
                );
                preferredOffset = new Date(STATE.simTime).getTimezoneOffset();
                refreshOffsets();
                document.getElementById('time-error').textContent = '';
            }
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', function () {
            const value = parseLocal(inputFields(), preferredOffset);
            if (value === null) {
                document.getElementById('time-error').textContent =
                    '请输入 2000–2100 年间有效的本地日期和时间。';
                return;
            }
            STATE.simTime = value;
            STATE.lastRealTime = performance.now();
            updateSimulation(STATE.simTime);
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
            updateSimulation(STATE.simTime);
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
            updateSimulation(STATE.simTime);
            updateTimeDisplay();
        }
        if (ev.code === 'Escape') {
            stopTrack();
            if (timeAdjust) timeAdjust.classList.remove('show');
        }
    });

    // ---- 点击/拖动检测（Pointer Events 统一鼠标和触摸）----
    const canvas = STATE.renderer.domElement;
    const active = new Set();
    let tap = null;
    const moved = (ev) => Math.hypot(ev.clientX - tap.x, ev.clientY - tap.y) > 5;
    canvas.addEventListener('pointerdown', (ev) => {
        active.add(ev.pointerId);
        tap =
            active.size === 1 && ev.isPrimary && ev.button === 0
                ? { id: ev.pointerId, x: ev.clientX, y: ev.clientY }
                : null;
    });
    canvas.addEventListener('pointermove', (ev) => {
        if (tap?.id === ev.pointerId && moved(ev)) tap = null;
    });
    canvas.addEventListener('pointerup', (ev) => {
        if (tap?.id === ev.pointerId && !moved(ev) && STATE.trackTarget) stopTrack();
        active.delete(ev.pointerId);
        tap = null;
    });
    function cancel(ev) {
        active.delete(ev.pointerId);
        tap = null;
    }
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('lostpointercapture', cancel);

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
