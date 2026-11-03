import * as THREE from 'three';

const loader = new THREE.TextureLoader();
let previews = 0;
let details = 0;
let previewFailed = false;
let detailFailed = false;
let ready = false;
function status() {
    if (!ready) return;
    const el = document.getElementById('texture-status');
    if (previews) el.textContent = '场景可操作 · 正在加载预览';
    else if (details) el.textContent = '场景可操作 · 正在加载高清纹理';
    else if (detailFailed) el.textContent = '高清纹理暂不可用 · 已保留预览';
    else if (previewFailed) el.textContent = '部分纹理未载入 · 可继续浏览';
    else el.textContent = '场景就绪';
}
export function sceneReady() {
    ready = true;
    status();
}

export function makeSurface(mesh, name) {
    const surface = { mesh, name, preview: null, detail: null, pending: false, retryAfter: 0, near: false };
    previews++;
    loader.load(
        '/solar-system/textures/preview/' + name + '.webp',
        (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            surface.preview = tex;
            if (!surface.near || !surface.detail) setMap(surface, tex);
            previews--;
            status();
        },
        undefined,
        () => {
            previews--;
            previewFailed = true;
            status();
        }
    );
    return surface;
}
function setMap(surface, tex) {
    const mat = surface.mesh.material;
    if (mat.map === tex) return;
    mat.map = tex;
    mat.color.set(0xffffff);
    mat.needsUpdate = true;
}
export function detailLevel(surface, near) {
    surface.near = near;
    if (!near) {
        if (surface.preview) setMap(surface, surface.preview);
        if (surface.detail && surface.preview) {
            surface.detail.dispose();
            surface.detail = null;
        }
        return;
    }
    if (surface.detail) {
        setMap(surface, surface.detail);
        return;
    }
    if (surface.pending || performance.now() < surface.retryAfter) return;
    surface.pending = true;
    details++;
    detailFailed = false;
    status();
    loader.load(
        '/solar-system/textures/detail/' + surface.name + '.webp',
        (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            surface.pending = false;
            details--;
            if (surface.near) {
                surface.detail = tex;
                setMap(surface, tex);
            } else tex.dispose();
            status();
        },
        undefined,
        () => {
            surface.pending = false;
            details--;
            detailFailed = true;
            surface.retryAfter = performance.now() + 30000;
            status();
        }
    );
}
