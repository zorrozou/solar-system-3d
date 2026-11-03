# 2026-05-22 太阳系演示系统重构文档

> 本文档详细记录 2026-05-22 这一天对 `/var/www/solar-system/` 的全部改动，包括：
> 1. **起始状态**——重构前是什么样
> 2. **本次的四个阶段**——每一阶段做了什么、为什么这样做、踩了哪些坑
> 3. **当前的关键参数**——尤其是肉眼调出来的"魔数"，方便未来回滚或微调
> 4. **后续待办**——这次没做完的优化项，按优先级排好
>
> 阅读建议：要继续优化时，先看 §6「后续待办」找下一步该做什么；要排查 bug 或回滚时，看 §3-§5 找到对应阶段的"决策与考量"；想完整理解架构时按顺序读完。

---

## 目录

- [1. 起始状态（重构前）](#1-起始状态重构前)
- [2. 本次重构概览](#2-本次重构概览)
- [3. 阶段 A：模块化重构（#15）](#3-阶段-a模块化重构15)
- [4. 阶段 B：nginx 安全修复（P0-#1）](#4-阶段-bnginx-安全修复p0-1)
- [5. 阶段 C：Three.js r128 → r170 升级（#8）](#5-阶段-cthreejs-r128--r170-升级8)
- [6. 后续待办（按优先级）](#6-后续待办按优先级)
- [7. 文件结构地图](#7-文件结构地图)
- [8. 回滚预案](#8-回滚预案)

---

## 1. 起始状态（重构前）

| 维度 | 状态 |
|---|---|
| 部署 | `https://zorrozou.online/solar-system/`（Nginx 1.24 + PHP 8.3-FPM + MySQL 8.0） |
| 前端 | 1073 行 IIFE 单文件（`js/solar-system.js`），ES5 风格 |
| 渲染库 | Three.js **r128**（2021-07，本地 `lib/three.min.js` 全局 script） |
| 后端 | `api/planets.php` 直查 `solar_system.planets` 表，9 行行星元数据 |
| 资源 | 30 张行星纹理（含大量重复），含 `db-backup/`、`.git/`、`textures/source/` |
| 已知问题 | 全局污染（`window._corona`、`window._asteroidFrame`）；`var` 横行；魔数无注释；`.git/` 公网可读 |

### 起始版本核心算法（保留至今未变）
- 行星位置：开普勒方程牛顿迭代（最多 10 步），用 J2000.0 历元 + 平近点角 + 近日点经度
- 月相：合朔参考时刻 `Date.UTC(2000, 0, 6, 18, 14, 0)` + 朔望月 29.530588 天
- 地球自转：北京经度 `206.397°` 对齐"该时刻反太阳方向 + 时区时差"
- 偏心率/轨道倾角：视觉上 × 0.3 缩放（真实值过小看不出）
- 小行星带：4000 个 Points，开普勒第三定律 `T = a^1.5` 算周期

---

## 2. 本次重构概览

按阶段顺序执行：

```
A. 模块化重构 (#15)        IIFE → 9 个 ES6 模块 + ESM 引入 Three.js
   └─ commit 33dcc41

B. nginx 安全修复 (P0-#1)   全局拦截 .git / .env / .svn 等隐藏目录
   └─ /etc/nginx/sites-enabled/default 直接修改（无 git 跟踪）

C. Three.js r128 → r170 (#8) 升级渲染库 + colorSpace 修正 + 灯光重平衡
   └─ commit 见本次提交

D. 文档记录                 本文件
   └─ commit 见本次提交
```

整个过程在 `feat/modularize` → `feat/three-r170` 两个 feature 分支上做，每个阶段完成后用户在浏览器肉眼验证再合 main。

---

## 3. 阶段 A：模块化重构（#15）

### 3.1 决策清单

在动手前用户做了三个关键选择，决定了实施风格：

| 决策点 | 备选 | 用户选择 | 影响 |
|---|---|---|---|
| 清理范围 | 纯拆文件 / 拆文件 + 收编全局污染 / 拆文件 + 全面清理 | **全面清理** | `var` → `let/const`、`window._corona` 收进 `STATE`、关键魔数加注释 |
| Three.js 加载 | 保留全局 script / 改成 ESM import | **改成 ESM** | 必须用 import map；下载 `three.module.js` 替换 `three.min.js` |
| 构建工具 | 引入 Vite/esbuild / 用浏览器原生 import map | **import map** | 零构建，部署直接传文件即可 |

### 3.2 模块拆分

```
js/
├── main.js          入口：DOM ready → initScene → loadBodies → initUI → animate
├── state.js         共享状态 + 天文常量（避免循环依赖的关键节点）
├── time.js          时间显示 + 节气计算 + 开普勒求解 + updatePlanetsPosition
├── factories.js     程序化纹理（太阳/土星环/天王星环）+ 大气 shader
├── scene-setup.js   scene/camera/renderer/controls/光照/星空/太阳
├── bodies.js        异步加载行星 + 月球 + 小行星带
├── tracking.js      跟踪/飞行/信息面板
├── ui.js            滑块/暂停/时间调整/键盘/指针/resize
└── animate.js       主循环（每帧推进时间、自转、轨道、标签、LOD、渲染）
```

`state.js` 是单向依赖图的根——只导出 `STATE` 对象和常量，**不 import 任何业务模块**。所有模块都可以 `import { STATE } from './state.js'` 读写共享状态。

### 3.3 import 路径与 import map

`index.html` 通过 import map 把裸标识符 `'three'` 解析到本地：
```html
<script type="importmap">
{
  "imports": {
    "three": "/solar-system/lib/three.module.js"
  }
}
</script>
<script type="module" src="/solar-system/js/main.js?v=7.0.0"></script>
```

业务模块直接 `import * as THREE from 'three';`。OrbitControls 内部也用 `from 'three'`，靠 import map 解析——**这就是 import map 必需的理由**，否则 OrbitControls 的 `from 'three'` 在浏览器里无法解析。

### 3.4 收编的全局污染

| 原全局变量 | 现位置 |
|---|---|
| `window._corona` | `STATE.corona`（在 `state.js` 中声明，`scene-setup.js` 写入，`animate.js` 读取） |
| `window._asteroidFrame` | `STATE.asteroidFrame`（同上） |

### 3.5 提炼到 `state.js` 的"魔数"

```js
export const ASTRO = {
    J2000_MS: Date.UTC(2000, 0, 1, 12, 0, 0),
    NEW_MOON_REF_MS: Date.UTC(2000, 0, 6, 18, 14, 0),
    SYNODIC_MONTH: 29.530588,
    MOON_INCLINATION: 5.14 * Math.PI / 180,
    BEIJING_LONGITUDE_RAD: 206.397 * Math.PI / 180,  // 用于地球自转锚定
    ECCENTRICITY_VISUAL_SCALE: 0.3,                  // 视觉缩放（真实值过小）
    INCLINATION_VISUAL_SCALE: 0.3,
};
```

> **注意**：`ECCENTRICITY_VISUAL_SCALE` 和 `INCLINATION_VISUAL_SCALE` 是**视觉缩放**，不是物理值。如果以后想加一个"真实/示意切换"开关，把这俩从 0.3 切成 1.0 就行。

### 3.6 无变化的部分

行为完全等价。算法、参数、视觉表现逐像素一致。验证手段：
- DevTools Network 看所有文件 200，无 404
- DevTools Console 无报错
- 与 `/var/www/solar-system.bak.20260522` 备份目录加载效果对比

### 3.7 这一阶段的 commit
```
33dcc41 refactor: 模块化重构 — IIFE 拆 9 个 ES6 模块 + ESM 引入 Three.js
```

---

## 4. 阶段 B：nginx 安全修复（P0-#1）

### 4.1 暴露面（修复前）

实测：
```bash
$ curl -sI https://zorrozou.online/solar-system/.git/HEAD
HTTP/2 200
```

意味着**任何爬虫**都能用 `git-dumper` 把整个仓库（含全部 commit 历史）拖回本地，包括：
- 数据库密码 `[已撤销]`（明文写在 `api/planets.php` 兜底字符串）
- GitHub Personal Access Token（明文写在 `.git/config` 的 remote URL）

附带损害：`/earth-sun-seasons/.git/HEAD` 也是 200。

### 4.2 修法：精确正则拦截

`/etc/nginx/sites-enabled/default` 主 server block 里加：

```nginx
# 拒绝访问所有隐藏目录/文件（.git, .env, .svn, .hg, .bzr, .DS_Store 等）
# 例外：.well-known 必须保留给 Let's Encrypt ACME 验证使用
location ~ /\.(?!well-known) {
    deny all;
    return 404;
    access_log off;
    log_not_found off;
}
```

### 4.3 决策考量

- **为什么用 negative lookahead `(?!well-known)` 而不是更宽泛的 `~ /\.git`** ——这条规则把所有 `.X` 都堵了，未来出现 `.env`、`.idea`、`.vscode` 等其他敏感目录都自动覆盖；同时显式放行 `.well-known` 不影响 Let's Encrypt 自动续期。
- **为什么 `access_log off`** ——爬虫每天会试探几十次 `.git`、`.env`、`.aws/credentials` 之类的路径，如果都记日志会让 access.log 噪音过大。这些请求都 deny，记不记没意义。
- **为什么不用 `^~` 优先级** ——nginx 的正则 location（`~`）天然优先于普通前缀 location，已经满足需求。

### 4.4 踩的坑

第一次 reload 失败：
```
[emerg] a duplicate default server for 0.0.0.0:80
```

原因：备份文件 `default.bak.20260522` 留在了 `/etc/nginx/sites-enabled/` 里，被 `include /etc/nginx/sites-enabled/*` 通配进去，里面的 `listen 80 default_server` 跟现配置冲突。

修复：把备份挪到 `/etc/nginx/default.bak.20260522`（脱离 sites-enabled 通配范围）。**未来在 sites-enabled 做备份时，文件名要改后缀（如 `.bak`）或挪出目录**。

### 4.5 验证手段

通过 access log 区分"被 deny"还是"正常 404"——deny 的请求 `access_log off` 不会出现在日志里：

```
日志中【出现】的请求：
  /.well-known/acme-challenge/test → 404  ✓ 走普通 location
  /solar-system/                   → 200  ✓ 正常

日志中【缺席】的请求：
  /solar-system/.git/HEAD          → 被 deny 拦截
```

### 4.6 这一阶段不在 git 跟踪范围

修改的是 `/etc/nginx/sites-enabled/default`，属于服务器系统配置，不在 `/var/www/solar-system/` git 仓库里。备份在 `/etc/nginx/default.bak.20260522`。

---

## 5. 阶段 C：Three.js r128 → r170 升级（#8）

这是今天最复杂的一步，也是文档记录最重要的一段——光照参数完全靠肉眼调出来的，未来想再调或换库版本时，这段历史是唯一的依据。

### 5.1 升级前调研（关键事实）

| 检查项 | 结论 |
|---|---|
| r170 ESM 文件可用 | ✅ `https://unpkg.com/three@0.170.0/build/three.module.js` 200 |
| `useLegacyLights` 是否在 r170 仍可用 | ❌ **已被彻底移除**（r163-165 之间） |
| `outputColorSpace` API 是否就位 | ✅ |
| OrbitControls 外部 API 是否兼容 | ✅（内部继承 `Controls` 基类，但 `new OrbitControls(camera, dom)` + 几个属性都兼容） |

### 5.2 r155+ 三大破坏性改动 vs 我们的代码

| 破坏 | r128 行为 | r170 行为 | 我们的修法 |
|---|---|---|---|
| 颜色空间 | `TextureLoader` 默认输出当线性数据用 | 默认 `NoColorSpace`，渲染管线又默认开 sRGB 输出，导致颜色发白 | 给所有 `map` 用的 diffuse 贴图加 `texture.colorSpace = THREE.SRGBColorSpace` |
| 光强单位 | 无量纲乘数 | 物理单位（candela/lumen），AmbientLight × π、PointLight × 4π 是迁移文档的转换系数 | 见 §5.4，最终肉眼调 |
| `PointLight.decay` | 默认 1（线性衰减） | 默认 2（物理平方反比） | 显式 `decay = 0`（不衰减），见 §5.4 |

### 5.3 颜色空间修正（11 处）

`bodies.js` 顶部加了一个 helper：
```js
function makeColorTextureLoader() {
    const loader = new THREE.TextureLoader();
    return function loadColorTexture(url) {
        const t = loader.load(url);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    };
}
```

然后所有 `texLoader.load(...)` → `loadColorTexture(...)`。覆盖 8 处贴图加载（行星默认、其他行星、Pluto LOD ×3、Earth LOD ×3、月球）。

`factories.js` 三处 CanvasTexture（太阳表面、土星环、天王星环）：
```js
const tex = new THREE.CanvasTexture(canvas);
tex.colorSpace = THREE.SRGBColorSpace;
return tex;
```

`scene-setup.js` 一处（太阳光晕 sprite）：
```js
const glowTex = new THREE.CanvasTexture(gc);
glowTex.colorSpace = THREE.SRGBColorSpace;
```

**不需要改的**（已验证或从原理上无问题）：
- 轨道线 `LineBasicMaterial` 的 hex 颜色 → `THREE.ColorManagement.enabled` 默认 true，自动做 sRGB→linear
- 星空、小行星、日冕的 `vertexColors` → 数据本就是字面线性值
- 大气层 `ShaderMaterial` → 自定义 shader 输出 vec4，glowColor uniform 直接传，渲染管线在最后做 outputColorSpace 转换

### 5.4 光照参数调试（★ 重点）

这一段是肉眼试错出来的，记录下来供未来参考。

#### 关键洞察：`PointLight.decay` 才是真正的问题，不是 4π 因子

我们的场景里行星距太阳在 22～1194 单位之间（`a = AU * 30 + 10`）。在 r170 默认 `decay = 2` 的物理平方反比衰减下：
- 水星 r=22 → 朝阳面光强降到 ≈ 1/484
- 木星 r=166 → 1/27556
- 海王星 r=912 → 1/831744

这就是为什么肉眼看上去"白天效果没了"——朝阳面的 PointLight 漫反射几乎为 0，所有亮度都靠 AmbientLight 均匀打底，整个场景扁平偏暗。

**修法**：`sunLight.decay = 0`，让光在 5000 单位（distance）内完全不衰减，等价 r128 大尺度场景下的视觉行为。

#### 试错历史

| 轮次 | AmbientLight | PointLight | decay | 现象 | 结论 |
|---|---|---|---|---|---|
| 1 | 0.5 × π ≈ 1.57 | 1.8 × 4π ≈ 22.6 | 2（默认）| 太暗，没昼夜效果 | 4π 因子对，但 `decay=2` 把远处行星光强吃光了 |
| 2 | 0.5 × π ≈ 1.57 | 1.8 × 4π ≈ 22.6 | **0** | 朝阳面过曝发白 | `decay=0` 后 4π 因子过强（4π 是为 `decay=2` 设计的） |
| 3 | 0.5 × π ≈ 1.57 | 1.8（无系数） | 0 | 整体偏暗、背面纯黑 | 全去掉物理因子又过头 |
| 4 | 0.5 × **2π** ≈ 3.14 | 1.8 × **π** ≈ 5.65 | 0 | 接近合适，但稍偏暗 | π 倍是合理的"温和补偿" |
| **5（最终）** | **0.5 × 2.5 × π** ≈ 3.93 | **1.8 × 1.25 × π** ≈ 7.07 | 0 | ✅ 视觉等价 r128 | 在第 4 轮基础上各 +25% |

#### 最终落地参数

```js
// scene-setup.js
STATE.scene.add(new THREE.AmbientLight(0x222233, 0.5 * 2.5 * Math.PI));      // ≈ 3.93
const sunLight = new THREE.PointLight(0xfff5e6, 1.8 * 1.25 * Math.PI, 5000); // ≈ 7.07
sunLight.decay = 0;
```

> **如果未来肉眼又觉得不对**：
> - 朝阳过曝 → 把 PointLight 的 `1.25` 降到 `1.0`
> - 背面太黑 → 把 AmbientLight 的 `2.5` 提到 `3.0`
> - 整体过亮 → 两个系数都按比例降
>
> **不要**重新引入 4π 因子，那是为 `decay=2` 物理模型设计的，跟我们的 `decay=0` 不兼容。

### 5.5 没动 ShaderMaterial（大气层光晕）

理论上 r155+ 颜色管理改了，自定义 shader 里如果直接写 `vec4(glowColor, intensity)` 输出可能会被渲染管线再做一次 sRGB 转换导致过亮。但实测下来视觉上没问题——可能是因为 `intensity` 已经把强度压得足够低（地球大气层也就一圈淡蓝），所以颜色失真不明显。

**未来如果发现大气层颜色不对**：在 fragment shader 里把 `glowColor` 转线性：
```glsl
vec3 linearColor = pow(glowColor, vec3(2.2));
gl_FragColor = vec4(linearColor, intensity * 0.8);
```

### 5.6 文件级改动清单

| 文件 | 操作 |
|---|---|
| `lib/three.module.js` | r128 → r170（旧版备份为 `three.module.r128.js`） |
| `lib/OrbitControls.module.js` | r128 → r170（旧版备份为 `OrbitControls.module.r128.js`） |
| `js/scene-setup.js` | 灯光参数 + 太阳光晕 sprite colorSpace |
| `js/factories.js` | 3 处 CanvasTexture 加 colorSpace |
| `js/bodies.js` | 加 `loadColorTexture` helper，8 处贴图加载替换 |
| `index.html` | `?v=6.0.0` → `?v=7.0.0`（破坏浏览器缓存） |

不需要改：`state.js` / `time.js` / `tracking.js` / `ui.js` / `animate.js` / `main.js`（与渲染层无关）。

---

### 5.6 顺手修了一个 IIFE 时代的地球自转化石 bug

升级到 r170 验证完之后，复盘代码时发现 `animate.js` 的主循环里有一段化石代码：

```js
// 修复前
STATE.planets.forEach(function (p) {
    if (p.data.name !== 'Earth') {
        const rotationPeriod = p.data.rotation_period || 1;
        const rotationDir = rotationPeriod < 0 ? -1 : 1;
        p.mesh.rotation.y += rotationDir * dt_days / Math.abs(rotationPeriod) * 2 * Math.PI;
    } else {
        // 地球表面附加自转（叠在精确朝向之上）  ← 这段是化石
        p.mesh.rotation.y += dt_days * 1.0 * 2 * Math.PI;
    }
});
```

**为什么是 bug 而不是无害的死代码**：

执行顺序上，`updatePlanetsPosition()` 用 `=` 把 `earth.rotation.y` 覆盖为精确朝向，然后这个 forEach 又用 `+=` 在精确朝向上叠了 `dt_days * 2π`。同帧渲染时**确实读到了带 += 的值**（不是无效），但这个 += 的量是相对于一帧时间步长的相位偏移：

| 速度档 | 偏移角 | 视觉感知 |
|---|---|---|
| 1 秒 = 1 秒 | 0.00007° | 看不到 |
| 1 秒 = 1 天 | 6° | 隐约能看到 |
| 1 秒 = 1 月 | 180° | 地球反着面对太阳 |
| 1 秒 = 1 年 | 40° | 朝向明显错 |

也就是**速度档越高，地球朝向偏离精确算法越远**——在原 IIFE 时代写的时候大概是先有 += 实现地球自转，后来加 `updatePlanetsPosition` 里的精确算法但忘了删旧的 +=。

**修法**：直接 early return 掉地球分支，让 `updatePlanetsPosition` 唯一负责地球自转：

```js
// 修复后
STATE.planets.forEach(function (p) {
    if (p.data.name === 'Earth') return;
    const rotationPeriod = p.data.rotation_period || 1;
    const rotationDir = rotationPeriod < 0 ? -1 : 1;
    p.mesh.rotation.y += rotationDir * dt_days / Math.abs(rotationPeriod) * 2 * Math.PI;
});
```

**回归验证**：把速度滑块拉到"1 秒 = 1 月"跟踪地球，修复前能看到地球反面对着太阳；修复后白天面与精确算法（北京经度对齐反太阳方向 + 时区时差）一致。

---

## 6. 后续待办（按优先级）

按之前评估时的 P0-P4 分级，这次只做了 P0 的 #1 和 P3 的 #15，其余都还在。下次开工时按这个列表选。

### P0 安全（剩余 2 件）

| 编号 | 内容 | 修复成本 |
|---|---|---|
| ~~P0-#1~~ | ~~`.git/` 目录公网可读~~ | ✅ 已修复（阶段 B） |
| **P0-#2** | `db-backup/solar_system.sql` 公网可读 | nginx 加 `location ~ /db-backup/` deny 或挪出 webroot |
| **P0-#3** | DB 密码硬编码 `[已撤销]` 在 PHP | 改强密码 + 写到 `/etc/environment` 或 fastcgi_param + 删 PHP 兜底字符串 |

> 用户已表态"#3 数据库密码数据不敏感"，但 .git 已经修了，所以暴露面收窄。`#2` 暴露的是同一份 SQL，影响相同。

### P1 性能 / 加载体感

4. **gzip 没生效**——`/etc/nginx/nginx.conf` 里 `gzip_types` 整行被注释掉，只压 text/html。开 `gzip_types` 后 `solar-system.js` 51KB 能压到 ~15KB，`three.module.js` 1.3MB 能压到 ~300KB。
5. **静态资源没 `Cache-Control`**——所有纹理/JS 都靠 ETag 条件请求。加 `expires 30d; add_header Cache-Control "public, immutable"`。
6. **纹理 179 MB，重复一倍**——`Mercury.jpg` 与 `8k_mercury.jpg`、`Mars.jpg` 与 `8k_mars.jpg` 等多个 md5 相同的副本。删冗余 + 砍 `textures/source/` 后能从 179 MB 降到 ~80 MB。
7. **首屏 8K 纹理过重**——Mercury/Moon 各 15 MB、Venus 12 MB。建议默认 2K 起步，相机靠近时 LOD 升 4K/8K（现在只有 Earth/Pluto 做了 LOD）。或者转 WebP / KTX2。

### P2 渲染性能

8. ~~Three.js 升 r170~~ ✅ 已完成
9. **小行星带 4000 Points 每 3 帧全量重写 buffer**——可改 InstancedMesh 或自定义 shader（CPU 0 开销）。
10. **日冕粒子也是每帧 CPU 端写 buffer**——同 9。
11. **土星环纹理每次进页面都画一遍**——这张图是静态的，可一次性烤成 `textures/saturn_ring.png`。
12. **球面分段过高**——地球/木星/土星 96×96，其他 64×64。视觉上 48 段已够圆。

### P3 代码质量

13. **关键魔数已加注释**（这次的 §3.5）。
14. **`stopTrack` 在 `pointerup` 时一帧抖动**——点行星标签切换跟踪时会先 stop 再 start，肉眼不明显但代码逻辑可优化。
15. ~~模块化~~ ✅ 已完成
16. **API 缓存 1 小时太短**——`Cache-Control: max-age=3600` 改成 `86400`，行星元数据基本不变。
17. **行星数据可静态化**——9 行元数据完全不需要走 PHP+MySQL，直接生成 `planets.json`。

### P4 UX 增强

- 真实/示意比例切换（参见 §3.5 的 `*_VISUAL_SCALE`）
- 探测器/航天器轨迹（旅行者、卡西尼、嫦娥）
- 天象事件跳转（日食、月食、行星合）
- 地球昼夜贴图（`8k_earth_nightmap.jpg` mix shader）
- PWA / Service Worker 离线缓存

---

## 7. 文件结构地图

```
/var/www/solar-system/
├── index.html                      入口 HTML（importmap + module script）
├── api/
│   └── planets.php                 行星元数据 API（直查 MySQL，9 行）
├── db-backup/
│   └── solar_system.sql            ⚠️ P0-#2 公网可读
├── js/
│   ├── main.js                     入口模块
│   ├── state.js                    共享状态 + 天文常量
│   ├── time.js                     时间工具 + 开普勒求解 + updatePlanetsPosition
│   ├── factories.js                程序化纹理 + 大气 shader
│   ├── scene-setup.js              ★ 灯光参数在这里（§5.4）
│   ├── bodies.js                   行星/月球/小行星带（含 colorSpace helper）
│   ├── tracking.js                 跟踪/飞行/信息面板
│   ├── ui.js                       UI 控件 + 键盘 + 指针 + resize
│   └── animate.js                  主循环
├── lib/
│   ├── three.module.js             r170 ESM
│   ├── three.module.r128.js        旧版备份（用于回滚 §8）
│   ├── three.min.js                r128 UMD（已不加载，留作历史）
│   ├── OrbitControls.module.js     r170 ESM jsm
│   ├── OrbitControls.module.r128.js 旧版备份
│   └── OrbitControls.js            r128 全局 script（已不加载）
├── textures/
│   ├── planets/                    行星贴图（含大量重复，见 P1-#6）
│   └── source/                     PNG 源图（39 MB，⚠️ 公网可读，见 P1-#6）
└── docs/
    └── refactor-2026-05.md         本文档
```

服务器上的相关备份目录：
- `/var/www/solar-system.bak.20260409` 旧备份（用户保留）
- `/var/www/solar-system.bak.20260410` 旧备份（用户保留）
- 阶段 A/C 期间的 `.bak.20260522` 系列在合并 main 后已清理

服务器系统配置改动：
- `/etc/nginx/sites-enabled/default` 加了 deny location（阶段 B）
- `/etc/nginx/default.bak.20260522` 是阶段 B 的备份，**故意挪出 sites-enabled** 避免被 include 通配

---

## 8. 回滚预案

### 整体回滚到 r128

```bash
# 库文件回切（最快，5 秒）
cd /var/www/solar-system/lib
mv three.module.js three.module.r170.js
mv OrbitControls.module.js OrbitControls.module.r170.js
mv three.module.r128.js three.module.js
mv OrbitControls.module.r128.js OrbitControls.module.js

# 同时还原 3 个 JS 模块到上一个 commit
cd /var/www/solar-system
git checkout 33dcc41 -- js/scene-setup.js js/factories.js js/bodies.js index.html
```

### 整体回滚到模块化前（IIFE 单文件）

```bash
cd /var/www/solar-system
git checkout 6149eb3 -- index.html js/
# 然后 rm -rf js/ 里多出来的模块文件，恢复成单 js/solar-system.js
```

### 整体回滚到 nginx 修复前

```bash
sudo cp /etc/nginx/default.bak.20260522 /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 紧急按钮（一键全回退）

如果 git 状态混乱：
```bash
cd /var/www && sudo rm -rf solar-system
sudo mv solar-system.bak.20260409 solar-system  # 或者 .20260410
```

---

## 附录：本次涉及的 git commit

```
33dcc41 refactor: 模块化重构 — IIFE 拆 9 个 ES6 模块 + ESM 引入 Three.js
<本次> refactor: Three.js r128 → r170 升级 + colorSpace 修正 + 灯光重平衡
<本次> docs: 添加 2026-05-22 重构文档
```

GitHub 仓库：`https://github.com/zorrozou/solar-system-3d` (main 分支)
