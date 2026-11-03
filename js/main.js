import { initScene } from './scene-setup.js';
import { fetchCatalog, createBodies } from './bodies.js';
import { initUI } from './ui.js';
import { animate } from './animate.js';
import { updateTimeDisplay } from './time.js';

const loading = document.getElementById('loading');
const message = document.getElementById('loading-message');
const retry = document.getElementById('retry-load');
async function load() {
    retry.hidden = true;
    message.textContent = '正在读取天体数据…';
    let rows;
    try {
        rows = await fetchCatalog();
    } catch {
        message.textContent = '暂时无法读取天体数据。请检查网络后重试。';
        retry.hidden = false;
        return;
    }
    try {
        createBodies(rows);
        loading.hidden = true;
    } catch {
        message.textContent = '场景初始化失败。请重新载入页面。';
        retry.onclick = () => location.reload();
        retry.hidden = false;
    }
}
try {
    updateTimeDisplay();
    if (initScene()) {
        initUI();
        animate();
        retry.onclick = load;
        load();
    }
} catch {
    message.textContent = '无法启动 3D 场景。请启用 WebGL 2 或使用支持硬件加速的浏览器。';
}
