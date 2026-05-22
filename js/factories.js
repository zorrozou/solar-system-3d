// 程序化纹理生成 + 大气层 shader 工厂
// 这些函数被 scene-setup.js 和 bodies.js 调用

import * as THREE from 'three';

// 太阳表面纹理（带黑子细节）
export function createSunSurfaceTexture() {
    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = 1024;
    sunCanvas.height = 512;
    const sunCtx = sunCanvas.getContext('2d');
    const sunGrad = sunCtx.createLinearGradient(0, 0, 1024, 512);
    sunGrad.addColorStop(0, '#FDB813');
    sunGrad.addColorStop(0.3, '#FDA813');
    sunGrad.addColorStop(0.5, '#FFD700');
    sunGrad.addColorStop(0.7, '#FDB813');
    sunGrad.addColorStop(1, '#E8A317');
    sunCtx.fillStyle = sunGrad;
    sunCtx.fillRect(0, 0, 1024, 512);
    // 太阳黑子和纹理细节
    for (let si = 0; si < 200; si++) {
        const sx = Math.random() * 1024;
        const sy = Math.random() * 512;
        const sr = 2 + Math.random() * 8;
        sunCtx.beginPath();
        sunCtx.arc(sx, sy, sr, 0, Math.PI * 2);
        sunCtx.fillStyle = 'rgba(' + (200 + Math.random() * 55) + ',' + (150 + Math.random() * 55) + ',0,' + (0.1 + Math.random() * 0.2) + ')';
        sunCtx.fill();
    }
    const tex = new THREE.CanvasTexture(sunCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// 土星环纹理：移动端 2048、桌面 4096
export function createSaturnRingTexture() {
    const canvas = document.createElement('canvas');
    const ringRes = window.innerWidth < 768 ? 2048 : 4096;
    canvas.width = ringRes;
    canvas.height = ringRes;
    const ctx = canvas.getContext('2d');

    const centerX = ringRes / 2;
    const centerY = ringRes / 2;
    const scale = ringRes / 4096;

    // F 环（最外层）
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2048 * scale, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, 1800 * scale, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(155,135,100,0.25)';
    ctx.fill();

    // Encke 缝隙
    ctx.beginPath();
    ctx.arc(centerX, centerY, 1800 * scale, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, 1790 * scale, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(20,15,10,0.1)';
    ctx.fill();

    // A 环
    ctx.beginPath();
    ctx.arc(centerX, centerY, 1790 * scale, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, 1240 * scale, 0, Math.PI * 2, true);
    const aGrad = ctx.createRadialGradient(centerX, centerY, 1240 * scale, centerX, centerY, 1790 * scale);
    aGrad.addColorStop(0, 'rgba(175,150,115,0.6)');
    aGrad.addColorStop(0.3, 'rgba(190,165,125,0.8)');
    aGrad.addColorStop(0.7, 'rgba(185,160,120,0.7)');
    aGrad.addColorStop(1, 'rgba(180,155,115,0.5)');
    ctx.fillStyle = aGrad;
    ctx.fill();

    // Cassini 分裂（最明显的缝隙）
    ctx.beginPath();
    ctx.arc(centerX, centerY, 1240 * scale, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, 1130 * scale, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(30,25,20,0.08)';
    ctx.fill();

    // B 环（最亮最宽的主环）
    ctx.beginPath();
    ctx.arc(centerX, centerY, 1130 * scale, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, 410 * scale, 0, Math.PI * 2, true);
    const bGrad = ctx.createRadialGradient(centerX, centerY, 410 * scale, centerX, centerY, 1130 * scale);
    bGrad.addColorStop(0, 'rgba(180,155,120,0.5)');
    bGrad.addColorStop(0.15, 'rgba(200,175,135,0.85)');
    bGrad.addColorStop(0.4, 'rgba(218,195,155,0.95)');
    bGrad.addColorStop(0.6, 'rgba(215,190,150,0.92)');
    bGrad.addColorStop(0.85, 'rgba(205,180,140,0.85)');
    bGrad.addColorStop(1, 'rgba(185,160,125,0.55)');
    ctx.fillStyle = bGrad;
    ctx.fill();

    // C 环（最内层、暗淡）
    ctx.beginPath();
    ctx.arc(centerX, centerY, 410 * scale, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, 0, 0, Math.PI * 2, true);
    const cGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 410 * scale);
    cGrad.addColorStop(0, 'rgba(100,85,70,0.0)');
    cGrad.addColorStop(0.3, 'rgba(120,100,80,0.15)');
    cGrad.addColorStop(0.7, 'rgba(130,105,85,0.22)');
    cGrad.addColorStop(1, 'rgba(125,100,80,0.35)');
    ctx.fillStyle = cGrad;
    ctx.fill();

    // 添加密度波动细节
    for (let i = 0; i < 300; i++) {
        const r = 410 * scale + Math.random() * 1380 * scale;
        const angle = Math.random() * Math.PI * 2;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        ctx.beginPath();
        ctx.arc(x, y, 1 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.02 + Math.random() * 0.05) + ')';
        ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// 天王星环纹理（窄环、淡蓝）
export function createUranusRingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 1024, 0);
    gradient.addColorStop(0, 'rgba(136,170,190,0.1)');
    gradient.addColorStop(0.3, 'rgba(136,180,200,0.4)');
    gradient.addColorStop(0.5, 'rgba(150,190,210,0.5)');
    gradient.addColorStop(0.7, 'rgba(130,175,195,0.3)');
    gradient.addColorStop(1, 'rgba(120,160,180,0.1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// 大气层光晕：在球体外侧加一层 BackSide + Additive 混合的着色器壳
export function addAtmosphere(parentMesh, r, color) {
    const atmosGeo = new THREE.SphereGeometry(r * 1.04, 64, 64);
    const atmosMat = new THREE.ShaderMaterial({
        uniforms: { glowColor: { value: new THREE.Color(color) } },
        vertexShader: [
            'varying vec3 vNormal;',
            'void main() {',
            '  vNormal = normalize(normalMatrix * normal);',
            '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}',
        ].join('\n'),
        fragmentShader: [
            'uniform vec3 glowColor;',
            'varying vec3 vNormal;',
            'void main() {',
            '  float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);',
            '  gl_FragColor = vec4(glowColor, intensity * 0.8);',
            '}',
        ].join('\n'),
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
    });
    parentMesh.add(new THREE.Mesh(atmosGeo, atmosMat));
}
