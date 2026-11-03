// 场景初始化：scene / camera / renderer / controls / 光照 / 星空 / 太阳
// 调用后 STATE 中的核心对象都已创建，但行星和月球还未加载（由 bodies.js 异步加载）

import * as THREE from 'three';
import { OrbitControls } from '../lib/OrbitControls.module.js';
import { registerTarget } from './tracking.js';
import { STATE } from './state.js';
import { createSunSurfaceTexture, seededRandom } from './factories.js';

export function initScene() {
    if (typeof THREE === 'undefined') {
        document.getElementById('loading').textContent = 'THREE 未定义';
        return false;
    }

    // ---- 场景与相机 ----
    STATE.scene = new THREE.Scene();
    STATE.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 30000);
    STATE.camera.position.set(0, 120, 200);

    // ---- 渲染器 ----
    STATE.renderer = new THREE.WebGLRenderer({ antialias: true });
    STATE.renderer.setSize(window.innerWidth, window.innerHeight);
    STATE.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // 阴影系统已关闭（PointLight 阴影开销大且效果不明显）
    STATE.renderer.shadowMap.enabled = false;
    STATE.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('canvas-container').appendChild(STATE.renderer.domElement);

    // ---- 控制器 ----
    STATE.controls = new OrbitControls(STATE.camera, STATE.renderer.domElement);
    STATE.controls.enableDamping = true;
    STATE.controls.dampingFactor = 0.08;
    STATE.controls.rotateSpeed = 0.8;
    STATE.controls.minDistance = 5;
    STATE.controls.maxDistance = 15000;

    STATE.controls.addEventListener('start', function () {
        STATE.isDragging = true;
        STATE.isFlying = false;
    });
    STATE.controls.addEventListener('end', function () {
        STATE.isDragging = false;
        if (STATE.trackTarget) {
            STATE.trackOffset = STATE.camera.position.clone().sub(STATE.trackTarget.position);
        }
    });

    // ---- 光照 ----
    // 在 r170 物理光照模型下，r128 的视觉强度需要根据 decay 模式调试：
    // - PointLight 设 decay = 0（不衰减）→ 等价 r128 大尺度场景下的"远近一致"行为
    // - 下面两个系数（2.5 / 1.25）是肉眼对比 r128 调出来的视觉等价值，不是物理推导值
    STATE.scene.add(new THREE.AmbientLight(0x222233, 0.5 * 2.5 * Math.PI));      // ≈ 3.93
    const sunLight = new THREE.PointLight(0xfff5e6, 1.8 * 1.25 * Math.PI, 5000); // ≈ 7.07
    sunLight.decay = 0;
    sunLight.position.set(0, 0, 0);
    sunLight.castShadow = false;
    STATE.scene.add(sunLight);

    // ---- 星空（10000 颗，多色） ----
    const sGeo = new THREE.BufferGeometry();
    const sPos = [];
    const sColors = [];
    for (let i = 0; i < 10000; i++) {
        const r = 3000 + Math.random() * 5000;
        const t = Math.random() * Math.PI * 2;
        const p = Math.acos(2 * Math.random() - 1);
        sPos.push(r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), r * Math.cos(p));
        const brightness = 0.3 + Math.random() * 0.7;
        const colorRand = Math.random();
        if (colorRand < 0.1) {
            // 蓝星
            sColors.push(0.6 * brightness, 0.7 * brightness, brightness);
        } else if (colorRand < 0.2) {
            // 黄星
            sColors.push(brightness, 0.9 * brightness, 0.6 * brightness);
        } else {
            // 白星
            sColors.push(brightness, brightness, brightness);
        }
    }
    sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
    sGeo.setAttribute('color', new THREE.Float32BufferAttribute(sColors, 3));
    STATE.scene.add(new THREE.Points(sGeo, new THREE.PointsMaterial({ size: 1.2, vertexColors: true })));

    // ---- 太阳本体 ----
    const sunTexture = createSunSurfaceTexture();
    STATE.sunMesh = new THREE.Mesh(
        new THREE.SphereGeometry(5, 128, 128),
        new THREE.MeshBasicMaterial({ map: sunTexture })
    );
    STATE.sunMesh.userData = {
        name: 'Sun',
        name_cn: '太阳',
        description: '太阳是太阳系的中心天体，占太阳系总质量的99.86%',
        radius: 695700,
        rotation_period: 25.4,
    };
    STATE.scene.add(STATE.sunMesh);

    // ---- 太阳标签 ----
    STATE.sunLabel = registerTarget(STATE.sunMesh, 5, STATE.sunMesh.userData);

    // ---- 太阳光晕（Sprite） ----
    const gc = document.createElement('canvas');
    gc.width = gc.height = 256;
    const gx = gc.getContext('2d');
    const gr = gx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,230,130,0.7)');
    gr.addColorStop(0.15, 'rgba(255,200,80,0.5)');
    gr.addColorStop(0.4, 'rgba(255,160,40,0.2)');
    gr.addColorStop(0.7, 'rgba(255,100,20,0.05)');
    gr.addColorStop(1, 'rgba(255,60,0,0)');
    gx.fillStyle = gr;
    gx.fillRect(0, 0, 256, 256);
    const glowTex = new THREE.CanvasTexture(gc);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex,
        transparent: true,
        opacity: 0.85,
    }));
    sp.scale.set(50, 50, 1);
    STATE.sunMesh.add(sp);

    // ---- 日冕粒子 ----
    const coronaCount = 200;
    const coronaGeo = new THREE.BufferGeometry();
    const coronaPos = [];
    const rates = [], offsets = [];
    const random = seededRandom(42);
    for (let ci = 0; ci < coronaCount; ci++) {
        const ct = random() * Math.PI * 2;
        const cp = Math.acos(2 * random() - 1);
        coronaPos.push(Math.sin(cp)*Math.cos(ct), Math.sin(cp)*Math.sin(ct), Math.cos(cp));
        rates.push(1.2 + random()*3);
        offsets.push(random()*6.8);
    }
    coronaGeo.setAttribute('position', new THREE.Float32BufferAttribute(coronaPos, 3));
    coronaGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
    const coronaMat = new THREE.PointsMaterial({
        color: 0xffcc44,
        size: 0.3,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
    });
    const coronaMesh = new THREE.Points(coronaGeo, coronaMat);
    STATE.sunMesh.add(coronaMesh);
    STATE.corona = { mesh: coronaMesh, rates, offsets, directions: coronaPos };

    return true;
}
