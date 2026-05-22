// 共享运行时状态 + 天文常量
// 所有跨模块需要读写的变量集中在这里，避免模块间循环依赖。
// 其他模块统一通过 `import { STATE, ASTRO } from './state.js'` 访问。

// ---- 天文常量 ----
export const ASTRO = {
    J2000_MS: Date.UTC(2000, 0, 1, 12, 0, 0),
    NEW_MOON_REF_MS: Date.UTC(2000, 0, 6, 18, 14, 0),
    SYNODIC_MONTH: 29.530588,
    MOON_INCLINATION: 5.14 * Math.PI / 180,
    // 北京经度（206.397°）：用于把地球自转锚定到北京时间为午夜/正午时面向反/朝太阳
    BEIJING_LONGITUDE_RAD: 206.397 * Math.PI / 180,
    // 视觉缩放因子：真实偏心率（如冥王星 0.2488）和倾角在演示场景中过于不明显，
    // 统一缩到 30% 后视觉上既能看出椭圆/倾斜，又不会破坏空间结构
    ECCENTRICITY_VISUAL_SCALE: 0.3,
    INCLINATION_VISUAL_SCALE: 0.3,
};

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
    sunPulse: 0,
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
    asteroidFrame: 0,        // 替代原 window._asteroidFrame

    // 时间
    simTime: Date.now(),
    lastRealTime: Date.now(),
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
    flyEnd: null,
    flyProgress: 0,

    // 帧计数 / 双击防抖
    frameCount: 0,
    lastTrackTime: 0,
};
