// 入口模块：初始化时间显示 → 创建场景 → 加载行星数据 → 绑定 UI → 启动主循环

import { STATE } from './state.js';
import { updateTimeDisplay } from './time.js';
import { initScene } from './scene-setup.js';
import { loadBodies } from './bodies.js';
import { initUI } from './ui.js';
import { animate } from './animate.js';

async function main() {
    try {
        // 时间显示先刷一遍（在 fetch 完成前用户也能看到当前时间）
        updateTimeDisplay();

        // 场景与渲染器
        const ok = initScene();
        if (!ok) return;

        // UI 事件绑定（依赖 STATE.renderer 和 STATE.sunLabel）
        initUI();

        // 异步加载行星数据 → 创建天体
        // loadBodies 不阻塞 animate 启动，行星 mesh 就位后 animate 自然开始驱动它们
        loadBodies().catch(function (e) {
            const loading = document.getElementById('loading');
            if (loading) {
                loading.textContent = '加载失败: ' + (e && e.message ? e.message : e);
                loading.classList.add('error');
            }
        });

        // 启动主循环
        animate();
    } catch (e) {
        const loading = document.getElementById('loading');
        if (loading) loading.textContent = '错误: ' + e.message;
    }
}

// type=module 默认 defer，DOM 已就绪
main();
