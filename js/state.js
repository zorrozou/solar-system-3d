// ---- 速率档位 ----
export const SPEED_LEVELS = [1, 60, 600, 3600, 21600, 86400, 604800, 2592000, 7776000, 31536000];
export const SPEED_LABELS = ['1秒=1秒', '1秒=1分', '1秒=10分', '1秒=1时', '1秒=6时', '1秒=1天', '1秒=1周', '1秒=1月', '1秒=1季', '1秒=1年'];

// ---- 可变运行时状态 ----
// 注意：导出的是同一个对象引用，模块间共享读写。
export const STATE = {
    // Three.js 核心对象
    scene: null,
    camera: null,
    renderer: null,
    controls: null,

    // 太阳
    sunMesh: null,
    sunLabel: null,
    corona: null,            // { mesh, vels, count } —— 替代原 window._corona

    // 行星 / 月球 / 小行星
    planets: [],
    moon: null,
    earthPlanet: null,       // 缓存地球引用，避免每帧 O(n) 扫描
    orbitLines: [],
    asteroidBelt: null,
    asteroidAngles: [],
    asteroidPeriods: [],
    asteroidDists: [],

    // 时间
    simTime: Date.now(),
    lastRealTime: performance.now(),
    paused: false,

    // 速率
    speedMultiplier: 1,
    currentSpeedIndex: 0,

    // 视角跟踪
    trackTarget: null,
    trackOffset: null,
    isFlying: false,
    isDragging: false,
    flyStart: null,
    flyProgress: 0,

    // 帧计数
    frameCount: 0,
};
