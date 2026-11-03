import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const surfaces = [];
let ready = false;
function status() {
    if (!ready) return;
    const previewsPending = surfaces.some((s) => s.previewPending);
    const detailsPending = surfaces.some((s) => s.pending && s.near);
    const missingMap = surfaces.some((s) => s.previewFailed && !s.mesh.material.map);
    const detailFailed = surfaces.some((s) => s.near && s.retryAfter > 0);
    const statusLine = document.getElementById('texture-status');
    if (previewsPending) statusLine.textContent = '场景可操作 · 正在加载预览';
    else if (detailsPending) statusLine.textContent = '场景可操作 · 正在加载高清纹理';
    else if (missingMap) statusLine.textContent = '部分天体没有载入贴图 · 已使用基础颜色';
    else if (detailFailed) statusLine.textContent = '高清纹理暂不可用 · 已保留预览';
    else statusLine.textContent = '场景就绪';
    document.getElementById('retry-textures').hidden =
        !surfaces.some((s) => s.previewFailed) && !detailFailed;
}
export function sceneReady() {
    ready = true;
    document.getElementById('retry-textures').onclick = () => {
        for (const s of surfaces) {
            if (s.previewFailed && !s.previewPending) loadPreview(s);
            if (s.near && s.retryAfter > 0) {
                s.retryAfter = 0;
                detailLevel(s, true);
            }
        }
    };
    status();
}

export function makeSurface(mesh, name) {
    const surface = {
        mesh,
        name,
        preview: null,
        detail: null,
        previewPending: false,
        previewFailed: false,
        pending: false,
        retryAfter: 0,
        near: false,
    };
    // The scene has one solar point light. Keep its Phong shading, but use
    // the body's physical direction to the Sun, independent of display scale.
    surface.sunDirection = new THREE.Vector3();
    mesh.material.onBeforeCompile = (shader) => {
        shader.uniforms.solarDirection = { value: surface.sunDirection };
        const lighting = THREE.ShaderChunk.lights_fragment_begin.replace(
            'getPointLightInfo( pointLight, geometryPosition, directLight );',
            '$&\n directLight.direction = normalize(mat3(viewMatrix) * solarDirection);'
        );
        shader.fragmentShader =
            'uniform vec3 solarDirection;\n' +
            shader.fragmentShader.replace('#include <lights_fragment_begin>', lighting);
    };
    surfaces.push(surface);
    loadPreview(surface);
    return surface;
}
function loadPreview(s) {
    s.previewPending = true;
    s.previewFailed = false;
    status();
    loader.load(
        '/solar-system/textures/preview/' + s.name + '.webp',
        (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            s.preview = tex;
            s.previewPending = false;
            if (!s.near || !s.detail) setMap(s, tex);
            status();
        },
        undefined,
        () => {
            s.previewPending = false;
            s.previewFailed = true;
            status();
        }
    );
}
function setMap(surface, tex) {
    const mat = surface.mesh.material;
    if (mat.map === tex) return;
    mat.map = tex;
    mat.color.set(0xffffff);
    mat.needsUpdate = true;
}
export function detailLevel(s, near) {
    const changed = s.near !== near;
    s.near = near;
    if (!near) {
        if (s.preview) setMap(s, s.preview);
        if (s.detail && s.preview) {
            s.detail.dispose();
            s.detail = null;
        }
        if (changed) status();
        return;
    }
    if (s.detail) {
        setMap(s, s.detail);
        if (changed) status();
        return;
    }
    if (s.pending || performance.now() < s.retryAfter) {
        if (changed) status();
        return;
    }
    s.pending = true;
    s.retryAfter = 0;
    status();
    loader.load(
        '/solar-system/textures/detail/' + s.name + '.webp',
        (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            s.pending = false;
            if (s.near || !s.preview) {
                s.detail = tex;
                setMap(s, tex);
            } else tex.dispose();
            status();
        },
        undefined,
        () => {
            s.pending = false;
            s.retryAfter = performance.now() + 30000;
            status();
        }
    );
}
