(function() {
    var scene, camera, renderer, controls;
    var planets = [];
    var sunMesh = null;
    var sunLabel = null;
    var speedMultiplier = 1;  // 速率倍数（模拟秒/真实秒）
    var moon = null;
    var paused = false;
    var sunPulse = 0;
    var asteroidBelt = null;
    var asteroidAngles = [];
    var asteroidPeriods = [];
    var asteroidDists = [];    // 预计算轨道半径，避免每3帧 sqrt
    var earthPlanet = null;  // 缓存地球引用，避免 O(n) 扫描
    var frameCount = 0;       // 帧计数器，用于间隔优化
    var lastTrackTime = 0;    // 防止移动端 touch+click 双击
    
    // 精确的模拟时间（毫秒级）
    var simTime = Date.now();  // 模拟时间的毫秒时间戳
    var lastRealTime = Date.now();  // 上一次真实时间
    
    // 当前速度档位
    var currentSpeedIndex = 0;
    var speedLevels = [1, 60, 600, 3600, 21600, 86400, 604800, 2592000, 7776000, 31536000];
    var speedLabels = ['1秒=1秒', '1秒=1分', '1秒=10分', '1秒=1时', '1秒=6时', '1秒=1天', '1秒=1周', '1秒=1月', '1秒=1季', '1秒=1年'];
    
    // 视角系统
    var orbitLines = [];
    var trackTarget = null;
    var trackOffset = null;
    var isFlying = false;
    var isDragging = false;
    var flyStart = null;
    var flyEnd = null;
    var flyProgress = 0;

    // 天文学常量
    var J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
    var NEW_MOON_REF_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
    var SYNODIC_MONTH = 29.530588;
    var MOON_INCLINATION = 5.14 * Math.PI / 180;

    // 计算从J2000.0到指定日期的天数
    function daysSinceJ2000(date) {
        return (date - J2000_MS) / (1000 * 60 * 60 * 24);
    }

    // 格式化时间显示
    function formatDateTime(timestamp) {
        var d = new Date(timestamp);
        var year = d.getFullYear();
        var month = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        var hour = String(d.getHours()).padStart(2, '0');
        var minute = String(d.getMinutes()).padStart(2, '0');
        var second = String(d.getSeconds()).padStart(2, '0');
        return {
            date: year + '-' + month + '-' + day,
            time: hour + ':' + minute + ':' + second
        };
    }

    // 更新时间显示
    function updateTimeDisplay() {
        var formatted = formatDateTime(simTime);
        var timeEl = document.getElementById('sim-time');
        var dateEl = document.getElementById('sim-date');
        var seasonEl = document.getElementById('season-info');
        if(timeEl) timeEl.textContent = formatted.time;
        if(dateEl) dateEl.textContent = formatted.date;
        if(seasonEl) {
            var d = new Date(simTime);
            var year = d.getFullYear();
            var spring = new Date(year, 2, 20);
            if(d < spring) { year--; spring = new Date(year, 2, 20); }
            var daysSinceSpring = (d - spring) / 86400000;
            var angle = (daysSinceSpring / 365.25) * 360;
            var terms = ['春分','清明','谷雨','立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒','立春','雨水','惊蛰'];
            var idx = Math.floor(((angle % 360 + 360) % 360) / 15);
            var term = terms[Math.min(idx, 23)];
            var season = angle < 90 ? '春' : angle < 180 ? '夏' : angle < 270 ? '秋' : '冬';
            seasonEl.textContent = term + ' · 北半球' + season + '季';
        }
    }

    // 根据时间重新计算所有行星位置
    function updatePlanetsPosition(date) {
        var daysSinceEpoch = daysSinceJ2000(date);
        
        planets.forEach(function(p) {
            var d = p.data;
            var M0 = (d.mean_anomaly_j2000 || 0) * Math.PI / 180;
            var omega = (d.perihelion_longitude || 0) * Math.PI / 180;
            var meanMotion = 2 * Math.PI / d.orbital_period;
            var e = p.e;
            
            // 计算平均近点角
            var M = M0 + meanMotion * daysSinceEpoch;
            
            // 解开普勒方程
            var E = M;
            for(var iter = 0; iter < 10; iter++){
                var dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
                E += dE;
                if(Math.abs(dE) < 1e-8) break;
            }
            
            // 真近点角
            var nu = 2 * Math.atan2(
                Math.sqrt(1 + e) * Math.sin(E / 2),
                Math.sqrt(1 - e) * Math.cos(E / 2)
            );
            
            // 黄道经度
            p.angle = (omega + nu) % (2 * Math.PI);
            
            // 更新位置
            var r = p.a * (1 - e * e) / (1 + e * Math.cos(nu));
            var x = r * Math.cos(p.angle);
            var z = -r * Math.sin(p.angle);
            p.pivot.position.set(x, z * Math.sin(p.inclination), z * Math.cos(p.inclination));
            
            // 更新地球自转
            if(d.name === 'Earth') {
                var d2 = new Date(date);
                var beijingHour = (d2.getUTCHours() + 8 + d2.getUTCMinutes()/60 + d2.getUTCSeconds()/3600) % 24;
                var toSun = Math.atan2(-x, -z);
                var rotationFromNoon = (beijingHour - 12) * Math.PI / 12;
                var beijingTheta = 206.397 * Math.PI / 180;
                p.mesh.rotation.y = toSun + rotationFromNoon - beijingTheta;
            }
        });
        
        // 更新月球位置
        if(moon) {
            var daysSinceNew = (date - NEW_MOON_REF_MS) / (1000 * 60 * 60 * 24);
            var moonPhase = (daysSinceNew % SYNODIC_MONTH) / SYNODIC_MONTH;
            
            var sunLongitude = earthPlanet ? earthPlanet.angle + Math.PI : Math.PI;
            moon.angle = sunLongitude + moonPhase * 2 * Math.PI;
        }
    }

    function init() {
        try {
        if (typeof THREE === 'undefined') {
            document.getElementById('loading').textContent = 'THREE 未定义'; return;
        }
        
        // 初始化时间显示
        updateTimeDisplay();
        
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 30000);
        camera.position.set(0, 120, 200);
        
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = false;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        document.getElementById('canvas-container').appendChild(renderer.domElement);
        
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.rotateSpeed = 0.8;
        controls.minDistance = 5;
        controls.maxDistance = 2000;
        
        controls.addEventListener('start', function() {
            isDragging = true;
            isFlying = false;
        });
        controls.addEventListener('end', function() {
            isDragging = false;
            if(trackTarget) trackOffset = camera.position.clone().sub(trackTarget.position);
        });
        
        // 光照
        scene.add(new THREE.AmbientLight(0x222233, 0.5));
        var sunLight = new THREE.PointLight(0xfff5e6, 1.8, 5000);
        sunLight.position.set(0, 0, 0);
        // 阴影系统已关闭（PointLight阴影开销大且效果不明显）
        sunLight.castShadow = false;
        scene.add(sunLight);

        // 星空（多层次亮度）
        var sGeo = new THREE.BufferGeometry(), sPos = [], sColors = [];
        for (var i = 0; i < 10000; i++) {
            var r = 3000 + Math.random() * 5000;
            var t = Math.random() * Math.PI * 2;
            var p = Math.acos(2 * Math.random() - 1);
            sPos.push(r*Math.sin(p)*Math.cos(t), r*Math.sin(p)*Math.sin(t), r*Math.cos(p));
            var brightness = 0.3 + Math.random() * 0.7;
            // 随机星星颜色偏移（蓝白/黄白/纯白）
            var colorRand = Math.random();
            if(colorRand < 0.1) { sColors.push(0.6*brightness, 0.7*brightness, brightness); } // 蓝星
            else if(colorRand < 0.2) { sColors.push(brightness, 0.9*brightness, 0.6*brightness); } // 黄星
            else { sColors.push(brightness, brightness, brightness); } // 白星
        }
        sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
        sGeo.setAttribute('color', new THREE.Float32BufferAttribute(sColors, 3));
        scene.add(new THREE.Points(sGeo, new THREE.PointsMaterial({size:1.2, vertexColors:true})));

        // 太阳
        // 太阳表面纹理（程序化生成）
        var sunCanvas = document.createElement('canvas');
        sunCanvas.width = 1024; sunCanvas.height = 512;
        var sunCtx = sunCanvas.getContext('2d');
        var sunGrad = sunCtx.createLinearGradient(0, 0, 1024, 512);
        sunGrad.addColorStop(0, '#FDB813');
        sunGrad.addColorStop(0.3, '#FDA813');
        sunGrad.addColorStop(0.5, '#FFD700');
        sunGrad.addColorStop(0.7, '#FDB813');
        sunGrad.addColorStop(1, '#E8A317');
        sunCtx.fillStyle = sunGrad;
        sunCtx.fillRect(0, 0, 1024, 512);
        // 太阳黑子和纹理细节
        for(var si = 0; si < 200; si++) {
            var sx = Math.random() * 1024;
            var sy = Math.random() * 512;
            var sr = 2 + Math.random() * 8;
            sunCtx.beginPath();
            sunCtx.arc(sx, sy, sr, 0, Math.PI * 2);
            sunCtx.fillStyle = 'rgba(' + (200 + Math.random()*55) + ',' + (150 + Math.random()*55) + ',0,' + (0.1 + Math.random()*0.2) + ')';
            sunCtx.fill();
        }
        var sunTexture = new THREE.CanvasTexture(sunCanvas);
        
        sunMesh = new THREE.Mesh(
            new THREE.SphereGeometry(5, 128, 128),
            new THREE.MeshBasicMaterial({map: sunTexture})
        );
        sunMesh.userData = {name:'Sun',name_cn:'太阳',description:'太阳是太阳系的中心天体，占太阳系总质量的99.86%', rotation_period: 25.4};
        scene.add(sunMesh);
        
        // 太阳点击
        sunLabel = document.createElement('div');
        sunLabel.textContent = '太阳';
        sunLabel.className = 'planet-label';
        sunLabel.style.cssText='position:absolute;color:rgba(255,200,100,0.8);font-size:13px;cursor:pointer;text-align:center;white-space:nowrap;padding:2px 6px;border-radius:3px;transform:translate(-50%,-100%);';
        sunLabel.addEventListener('click', function(e){ e.stopPropagation(); showInfo(sunMesh.userData); });
        document.getElementById('canvas-container').appendChild(sunLabel);
        
        // 太阳光晕
        var gc=document.createElement('canvas');gc.width=gc.height=256;
        var gx=gc.getContext('2d');
        var gr=gx.createRadialGradient(128,128,0,128,128,128);
        gr.addColorStop(0,'rgba(255,230,130,0.7)');
        gr.addColorStop(0.15,'rgba(255,200,80,0.5)');
        gr.addColorStop(0.4,'rgba(255,160,40,0.2)');
        gr.addColorStop(0.7,'rgba(255,100,20,0.05)');
        gr.addColorStop(1,'rgba(255,60,0,0)');
        gx.fillStyle=gr;gx.fillRect(0,0,256,256);
        var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(gc),transparent:true,opacity:0.85}));
        sp.scale.set(50,50,1);
        sunMesh.add(sp);
        
        // 日冕射线（动态粒子）
        var coronaCount = 200;
        var coronaGeo = new THREE.BufferGeometry();
        var coronaPos = [], coronaVel = [];
        for(var ci = 0; ci < coronaCount; ci++) {
            var ct = Math.random() * Math.PI * 2;
            var cp = Math.acos(2 * Math.random() - 1);
            var cr = 5 + Math.random() * 2;
            coronaPos.push(cr*Math.sin(cp)*Math.cos(ct), cr*Math.sin(cp)*Math.sin(ct), cr*Math.cos(cp));
            coronaVel.push(0.02 + Math.random() * 0.05);
        }
        coronaGeo.setAttribute('position', new THREE.Float32BufferAttribute(coronaPos, 3));
        var coronaMat = new THREE.PointsMaterial({color: 0xffcc44, size: 0.3, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending});
        var coronaMesh = new THREE.Points(coronaGeo, coronaMat);
        sunMesh.add(coronaMesh);
        window._corona = {mesh: coronaMesh, vels: coronaVel, count: coronaCount};

        function createSaturnRingTexture() {
            // 超高清土星环纹理 4096x4096
            var canvas = document.createElement('canvas');
            var ringRes = window.innerWidth < 768 ? 2048 : 4096;
            canvas.width = ringRes;
            canvas.height = ringRes;
            var ctx = canvas.getContext('2d');
            
            var centerX = ringRes / 2;
            var centerY = ringRes / 2;
            var scale = ringRes / 4096;
            
            // F环 (最外层)
            ctx.beginPath();
            ctx.arc(centerX, centerY, 2048*scale, 0, Math.PI * 2);
            ctx.arc(centerX, centerY, 1800*scale, 0, Math.PI * 2, true);
            ctx.fillStyle = 'rgba(155,135,100,0.25)';
            ctx.fill();
            
            // Encke缝隙
            ctx.beginPath();
            ctx.arc(centerX, centerY, 1800*scale, 0, Math.PI * 2);
            ctx.arc(centerX, centerY, 1790*scale, 0, Math.PI * 2, true);
            ctx.fillStyle = 'rgba(20,15,10,0.1)';
            ctx.fill();
            
            // A环
            ctx.beginPath();
            ctx.arc(centerX, centerY, 1790*scale, 0, Math.PI * 2);
            ctx.arc(centerX, centerY, 1240*scale, 0, Math.PI * 2, true);
            var aGrad = ctx.createRadialGradient(centerX, centerY, 1240*scale, centerX, centerY, 1790*scale);
            aGrad.addColorStop(0, 'rgba(175,150,115,0.6)');
            aGrad.addColorStop(0.3, 'rgba(190,165,125,0.8)');
            aGrad.addColorStop(0.7, 'rgba(185,160,120,0.7)');
            aGrad.addColorStop(1, 'rgba(180,155,115,0.5)');
            ctx.fillStyle = aGrad;
            ctx.fill();
            
            // Cassini 分裂 (最明显的缝隙)
            ctx.beginPath();
            ctx.arc(centerX, centerY, 1240*scale, 0, Math.PI * 2);
            ctx.arc(centerX, centerY, 1130*scale, 0, Math.PI * 2, true);
            ctx.fillStyle = 'rgba(30,25,20,0.08)';
            ctx.fill();
            
            // B环 (最亮最宽的主环)
            ctx.beginPath();
            ctx.arc(centerX, centerY, 1130*scale, 0, Math.PI * 2);
            ctx.arc(centerX, centerY, 410*scale, 0, Math.PI * 2, true);
            var bGrad = ctx.createRadialGradient(centerX, centerY, 410*scale, centerX, centerY, 1130*scale);
            bGrad.addColorStop(0, 'rgba(180,155,120,0.5)');
            bGrad.addColorStop(0.15, 'rgba(200,175,135,0.85)');
            bGrad.addColorStop(0.4, 'rgba(218,195,155,0.95)');
            bGrad.addColorStop(0.6, 'rgba(215,190,150,0.92)');
            bGrad.addColorStop(0.85, 'rgba(205,180,140,0.85)');
            bGrad.addColorStop(1, 'rgba(185,160,125,0.55)');
            ctx.fillStyle = bGrad;
            ctx.fill();
            
            // C环 (最内层，暗淡)
            ctx.beginPath();
            ctx.arc(centerX, centerY, 410*scale, 0, Math.PI * 2);
            ctx.arc(centerX, centerY, 0, 0, Math.PI * 2, true);
            var cGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 410*scale);
            cGrad.addColorStop(0, 'rgba(100,85,70,0.0)');
            cGrad.addColorStop(0.3, 'rgba(120,100,80,0.15)');
            cGrad.addColorStop(0.7, 'rgba(130,105,85,0.22)');
            cGrad.addColorStop(1, 'rgba(125,100,80,0.35)');
            ctx.fillStyle = cGrad;
            ctx.fill();
            
            // 添加密度波动细节
            for(var i = 0; i < 300; i++){
                var r = 410*scale + Math.random() * 1380*scale;
                var angle = Math.random() * Math.PI * 2;
                var x = centerX + Math.cos(angle) * r;
                var y = centerY + Math.sin(angle) * r;
                ctx.beginPath();
                ctx.arc(x, y, 1 + Math.random() * 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,' + (0.02 + Math.random() * 0.05) + ')';
                ctx.fill();
            }
            
            // 土星环阴影由 Three.js 光照系统自然产生
            
            return new THREE.CanvasTexture(canvas);
        }
        function createUranusRingTexture() {
            var canvas = document.createElement('canvas');
            canvas.width = 1024; canvas.height = 128;
            var ctx = canvas.getContext('2d');
            var gradient = ctx.createLinearGradient(0, 0, 1024, 0);
            gradient.addColorStop(0, 'rgba(136,170,190,0.1)');
            gradient.addColorStop(0.3, 'rgba(136,180,200,0.4)');
            gradient.addColorStop(0.5, 'rgba(150,190,210,0.5)');
            gradient.addColorStop(0.7, 'rgba(130,175,195,0.3)');
            gradient.addColorStop(1, 'rgba(120,160,180,0.1)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 1024, 128);
            return new THREE.CanvasTexture(canvas);
        }


        // 大气层光晕效果
        function addAtmosphere(parentMesh, r, color) {
            var atmosGeo = new THREE.SphereGeometry(r * 1.04, 64, 64);
            var atmosMat = new THREE.ShaderMaterial({
                uniforms: { glowColor: { value: new THREE.Color(color) } },
                vertexShader: [
                    'varying vec3 vNormal;',
                    'void main() {',
                    '  vNormal = normalize(normalMatrix * normal);',
                    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                    '}'
                ].join('\n'),
                fragmentShader: [
                    'uniform vec3 glowColor;',
                    'varying vec3 vNormal;',
                    'void main() {',
                    '  float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);',
                    '  gl_FragColor = vec4(glowColor, intensity * 0.8);',
                    '}'
                ].join('\n'),
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending,
                transparent: true
            });
            parentMesh.add(new THREE.Mesh(atmosGeo, atmosMat));
        }

        var texLoader = new THREE.TextureLoader();
        
        // 当前日期
        var currentDate = new Date(simTime);
        var daysSinceEpoch = daysSinceJ2000(currentDate);

        // 加载行星数据
        fetch('/solar-system/api/planets.php').then(function(r){return r.json();}).then(function(data){
            var labelFragment = document.createDocumentFragment();
            data.forEach(function(d){
                // 轨道参数
                var a = d.distance_from_sun * 30 + 10;
                var e = (d.eccentricity || 0) * 0.3;
                var inclination = (d.orbital_inclination || 0) * 0.3 * Math.PI / 180;
                var radius = Math.max(d.radius / 6371 * 2, 0.5);
                
                // 计算初始角度（开普勒方程）
                var M0 = (d.mean_anomaly_j2000 || 0) * Math.PI / 180;
                var omega = (d.perihelion_longitude || 0) * Math.PI / 180;
                var meanMotion = 2 * Math.PI / d.orbital_period;
                var M = M0 + meanMotion * daysSinceEpoch;
                
                var E = M;
                for(var iter = 0; iter < 10; iter++){
                    var dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
                    E += dE;
                    if(Math.abs(dE) < 1e-8) break;
                }
                
                var nu = 2 * Math.atan2(
                    Math.sqrt(1 + e) * Math.sin(E / 2),
                    Math.sqrt(1 - e) * Math.cos(E / 2)
                );
                
                var angle = (omega + nu) % (2 * Math.PI);
                
                var r0 = a * (1 - e * e) / (1 + e * Math.cos(nu));
                var x0 = r0 * Math.cos(angle);
                var z0 = -r0 * Math.sin(angle);
                
                // 纹理
                var texture = null;
                // 地球使用高清纹理（TextureLoader.load 是异步的，无需 try/catch）
                if(d.name === 'Earth') {
                    texture = texLoader.load('/solar-system/textures/planets/Earth_mid.jpg');
                } else {
                    texture = texLoader.load('/solar-system/textures/planets/' + d.name + '.jpg?v8k2');
                }
                
                // 气态行星表面不反光，岩石行星稍反光
                var shininess = (d.name === 'Jupiter' || d.name === 'Saturn' || d.name === 'Uranus' || d.name === 'Neptune') ? 3 : 8;
                var mat = texture 
                    ? new THREE.MeshPhongMaterial({map: texture, shininess: shininess})
                    : new THREE.MeshPhongMaterial({color: d.color || 0x888888, shininess: shininess});
                
                var pivot = new THREE.Object3D();
                var segments = (d.name === 'Earth' || d.name === 'Jupiter' || d.name === 'Saturn') ? 96 : 64;
                var mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments), mat);
                
                // 轴倾角设置
                var axialTilt = (d.axial_tilt || 0) * Math.PI / 180;
                if(d.name === 'Earth') {
                    // 地球北极精确方向，确保季节正确
                    pivot.quaternion.set(-0.203129, 0.000000, 0.000000, 0.979152);
                } else if(d.name === 'Uranus') {
                    // 天王星几乎侧翻（97.77度）
                    pivot.rotation.z = axialTilt;
                } else {
                    // 其他行星使用各自的轴倾角
                    pivot.rotation.z = axialTilt;
                }
                pivot.add(mesh);
                
                // 大气层
                if(d.name === 'Earth') {
                    addAtmosphere(mesh, radius, 0x4488ff);
                    // 地球云层
                    var cloudGeo = new THREE.SphereGeometry(radius * 1.015, 64, 64);
                    var cloudCanvas = document.createElement('canvas');
                    cloudCanvas.width = 1024; cloudCanvas.height = 512;
                    var cloudCtx = cloudCanvas.getContext('2d');
                    cloudCtx.fillStyle = 'rgba(0,0,0,0)';
                    cloudCtx.fillRect(0, 0, 1024, 512);
                    for(var ci = 0; ci < 800; ci++) {
                        var cx = Math.random() * 1024;
                        var cy = Math.random() * 512;
                        var cr = 5 + Math.random() * 40;
                        var co = 0.1 + Math.random() * 0.25;
                        cloudCtx.beginPath();
                        cloudCtx.arc(cx, cy, cr, 0, Math.PI * 2);
                        cloudCtx.fillStyle = 'rgba(255,255,255,' + co + ')';
                        cloudCtx.fill();
                    }
                    var cloudMat = new THREE.MeshPhongMaterial({
                        map: new THREE.CanvasTexture(cloudCanvas),
                        transparent: true, opacity: 0.35, depthWrite: false
                    });
                    var cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
                    cloudMesh.userData = { isCloud: true };
                    mesh.add(cloudMesh);
                }
                if(d.name === 'Venus') addAtmosphere(mesh, radius, 0xffcc66);
                if(d.name === 'Mars') addAtmosphere(mesh, radius, 0xff6633);
                
                // 自转轴指示器（细灰色线）
                var axisLength = radius * 1.15;
                var axisGeometry = new THREE.CylinderGeometry(0.003, 0.003, axisLength * 2, 8);
                var axisMaterial = new THREE.MeshBasicMaterial({color: 0x888888, transparent: true, opacity: 0.4});
                var axisMesh = new THREE.Mesh(axisGeometry, axisMaterial);
                pivot.add(axisMesh);
                
                var northPole = new THREE.Mesh(
                    new THREE.SphereGeometry(0.03, 8, 8),
                    new THREE.MeshBasicMaterial({color: 0xaaaaaa})
                );
                northPole.position.y = axisLength;
                axisMesh.add(northPole);
                
                var southPole = new THREE.Mesh(
                    new THREE.SphereGeometry(0.025, 8, 8),
                    new THREE.MeshBasicMaterial({color: 0x666666})
                );
                southPole.position.y = -axisLength;
                axisMesh.add(southPole);
                
                pivot.position.set(x0, z0 * Math.sin(inclination), z0 * Math.cos(inclination));
                
                mesh.userData = d;
                scene.add(pivot);
                
                // 土星环、天王星环
                if(d.name === 'Saturn'){
                    var ring = new THREE.Mesh(
                        new THREE.RingGeometry(radius*1.3, radius*2.2, 128),
                        new THREE.MeshBasicMaterial({map:createSaturnRingTexture(), side: THREE.DoubleSide, transparent:true, opacity:0.9})
                    );
                    ring.rotation.x = Math.PI / 2;
                    mesh.add(ring);
                }
                if(d.name === 'Uranus'){
                    var uRing = new THREE.Mesh(
                        new THREE.RingGeometry(radius*1.4, radius*1.7, 32),
                        new THREE.MeshBasicMaterial({map:createUranusRingTexture(), side:2, transparent:true, opacity:0.6})
                    );
                    uRing.rotation.x = Math.PI / 2;
                    mesh.add(uRing);
                }
                
                // 地球自转初始化
                if(d.name === 'Earth'){
                    var beijingHour = (currentDate.getUTCHours() + 8 + currentDate.getUTCMinutes()/60 + currentDate.getUTCSeconds()/3600) % 24;
                    var toSun = Math.atan2(-x0, -z0);
                    var rotationFromNoon = (beijingHour - 12) * Math.PI / 12;
                    var beijingTheta = 206.397 * Math.PI / 180;
                    mesh.rotation.y = toSun + rotationFromNoon - beijingTheta;
                }
                
                // 木星初始旋转：让大红斑面向太阳
                if(d.name === 'Jupiter'){
                    var jupiterToSun = Math.atan2(-x0, -z0);
                    mesh.rotation.y = jupiterToSun;
                }
                
                // 椭圆轨道线
                var oPts = [];
                for(var i = 0; i <= 256; i++){
                    var theta = i / 256 * Math.PI * 2;
                    var rOrbit = a * (1 - e * e) / (1 + e * Math.cos(theta));
                    var oAngle = (omega + theta) % (2 * Math.PI);
                    var ox = rOrbit * Math.cos(oAngle);
                    var oz = -rOrbit * Math.sin(oAngle);
                    oPts.push(new THREE.Vector3(ox, oz * Math.sin(inclination), oz * Math.cos(inclination)));
                }
                var orbitLine = new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints(oPts),
                    new THREE.LineBasicMaterial({color:0x334455, transparent:true, opacity:0.5})
                );
                scene.add(orbitLine);
                orbitLines.push(orbitLine);
                
                // 标签
                var label = document.createElement('div');
                label.textContent = d.name_cn || d.name;
                label.className = 'planet-label';
                label.style.cssText='position:absolute;color:rgba(255,255,255,0.7);font-size:15px;cursor:pointer;text-align:center;white-space:nowrap;padding:2px 6px;border-radius:3px;transition:background 0.2s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transform:translate(-50%,-100%);';
                label.addEventListener('mouseenter', function(){ this.style.background='rgba(255,255,255,0.15)'; this.style.color='#fff'; });
                label.addEventListener('mouseleave', function(){ this.style.background='none'; this.style.color='rgba(255,255,255,0.7)'; });
                labelFragment.appendChild(label);
                
                (function(pivot, mesh, r){
                    label.addEventListener('click', function(e){ if(Date.now()-lastTrackTime<250)return;lastTrackTime=Date.now();e.stopPropagation();startTrack(pivot,mesh,r); });
                    label.addEventListener('touchend', function(e){ if(Date.now()-lastTrackTime<250)return;lastTrackTime=Date.now();e.preventDefault();e.stopPropagation();startTrack(pivot,mesh,r); });
                })(pivot, mesh, radius);
                
                var planetObj = {
                    pivot: pivot,
                    mesh: mesh, 
                    data: d, 
                    angle: angle, 
                    a: a, 
                    e: e, 
                    inclination: inclination,
                    label: label,
                    axialTilt: axialTilt
                };
                
                // 冥王星LOD纹理
                if(d.name === 'Pluto'){
                    planetObj.lodTextures = {
                        low: texLoader.load('/solar-system/textures/planets/Pluto_low.jpg'),
                        mid: texLoader.load('/solar-system/textures/planets/Pluto_mid.jpg'),
                        high: texLoader.load('/solar-system/textures/planets/Pluto_high.jpg')
                    };
                    planetObj.currentLOD = 'mid';
                }
                // 地球LOD纹理
                if(d.name === 'Earth'){
                    planetObj.lodTextures = {
                        low: texLoader.load('/solar-system/textures/planets/Earth_low.jpg'),
                        mid: texLoader.load('/solar-system/textures/planets/Earth_mid.jpg'),
                        high: texLoader.load('/solar-system/textures/planets/Earth_high.jpg')
                    };
                    planetObj.currentLOD = 'mid';
                }
                
                planets.push(planetObj);
                if(d.name === 'Earth') earthPlanet = planetObj;
            });
            document.getElementById('canvas-container').appendChild(labelFragment);
            
            // 月球
            if(earthPlanet){
                var mMesh = new THREE.Mesh(
                    new THREE.SphereGeometry(0.27, 64, 64),
                    new THREE.MeshPhongMaterial({map: texLoader.load('/solar-system/textures/planets/8k_moon.jpg?v8k3'), shininess:3})
                );
                mMesh.userData = { name: 'Moon', name_cn: '月球', radius: 0.27 };
                scene.add(mMesh);
                
                // 月球标签
                var moonLabel = document.createElement('div');
                moonLabel.textContent = '月球';
                moonLabel.className = 'planet-label';
                moonLabel.style.cssText='position:absolute;color:rgba(255,255,255,0.7);font-size:12px;cursor:pointer;text-align:center;white-space:nowrap;padding:2px 6px;border-radius:3px;transition:background 0.2s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transform:translate(-50%,-100%);';
                moonLabel.addEventListener('mouseenter', function(){ this.style.background='rgba(255,255,255,0.15)'; this.style.color='#fff'; });
                moonLabel.addEventListener('mouseleave', function(){ this.style.background='none'; this.style.color='rgba(255,255,255,0.7)'; });
                moonLabel.addEventListener('click', function(e){ if(Date.now()-lastTrackTime<250)return;lastTrackTime=Date.now();e.stopPropagation();startTrackMoon(mMesh); });
                moonLabel.addEventListener('touchend', function(e){ if(Date.now()-lastTrackTime<250)return;lastTrackTime=Date.now();e.preventDefault();e.stopPropagation();startTrackMoon(mMesh); });
                document.getElementById('canvas-container').appendChild(moonLabel);
                
                var daysSinceNew = (simTime - NEW_MOON_REF_MS) / (1000 * 60 * 60 * 24);
                var moonPhase = (daysSinceNew % SYNODIC_MONTH) / SYNODIC_MONTH;
                var sunLongitude = earthPlanet.angle + Math.PI;
                var moonInitAngle = sunLongitude + moonPhase * 2 * Math.PI;
                
                moon = {mesh:mMesh, earth:earthPlanet, angle:moonInitAngle, dist:4, label:moonLabel};
            }
            
            // 小行星带
            var aPos = [], aColors = [], aCount = 4000;
            for(var i = 0; i < aCount; i++){
                var ar = (2.2 + Math.random() * 1.1) * 30 + 10;
                var at = Math.random() * Math.PI * 2;
                aPos.push(Math.cos(at)*ar, (Math.random()-0.5)*3, -Math.sin(at)*ar);
                asteroidAngles.push(at);
                var auDist = ar / 30;
                asteroidPeriods.push(Math.pow(auDist, 1.5) * 365.25);
                // 小行星颜色差异：碳质(暗灰)、硅质(偏红)、金属(偏亮)
                var aColorRand = Math.random();
                if(aColorRand < 0.5) { aColors.push(0.35, 0.33, 0.3); } // 碳质暗黑
                else if(aColorRand < 0.8) { aColors.push(0.5, 0.42, 0.35); } // 硅质偏褐
                else { aColors.push(0.6, 0.58, 0.55); } // 金属偏亮
                asteroidDists.push(ar);  // 预计算轨道半径
            }
            var aGeo = new THREE.BufferGeometry();
            aGeo.setAttribute('position', new THREE.Float32BufferAttribute(aPos, 3));
            aGeo.setAttribute('color', new THREE.Float32BufferAttribute(aColors, 3));
            asteroidBelt = new THREE.Points(
                aGeo,
                new THREE.PointsMaterial({size:0.3, transparent:true, opacity:0.6, vertexColors:true})
            );
            scene.add(asteroidBelt);
            
            document.getElementById('loading').style.display = 'none';
        }).catch(function(e){
            document.getElementById('loading').textContent = '加载失败: ' + e.message;
        });

        // 视角控制
        function startTrack(targetPivot, targetMesh, radius) {
            // 跟踪时降低其他轨道线透明度，高亮被跟踪行星的轨道
            var targetIdx = -1;
            for(var pi = 0; pi < planets.length; pi++) {
                if(planets[pi].pivot === targetPivot) { targetIdx = pi; break; }
            }
            orbitLines.forEach(function(l, i){
                if(i === targetIdx) {
                    l.material.color.set(0x60a5fa);
                    l.material.opacity = 0.8;
                } else {
                    l.material.color.set(0x334455);
                    l.material.opacity = 0.12;
                }
            });
            var pos = targetPivot.position.clone();
            var r = radius || 1;
            var viewDist = r * 5;
            var targetCamPos = new THREE.Vector3(pos.x + viewDist, pos.y + viewDist*0.4, pos.z + viewDist);
            
            trackTarget = targetPivot;
            trackOffset = targetCamPos.clone().sub(pos);
            
            isFlying = true;
            flyProgress = 0;
            flyStart = { cam: camera.position.clone(), target: controls.target.clone() };
            flyEnd = { cam: targetCamPos, target: pos };
            controls.minDistance = r * 2;
            
            showInfo(targetMesh.userData);
        }
        
        // 月球视角
        function startTrackMoon(moonMesh) {
            var pos = moonMesh.position.clone();
            var r = moonMesh.userData.radius || 0.27;
            var viewDist = r * 8;
            var targetCamPos = new THREE.Vector3(pos.x + viewDist, pos.y + viewDist*0.5, pos.z + viewDist);
            
            trackTarget = moonMesh;
            trackOffset = targetCamPos.clone().sub(pos);
            
            isFlying = true;
            flyProgress = 0;
            flyStart = { cam: camera.position.clone(), target: controls.target.clone() };
            flyEnd = { cam: targetCamPos, target: pos };
            controls.minDistance = r * 3;
            
            showInfo(moonMesh.userData);
        }
        
        function stopTrack() {
            trackTarget = null;
            trackOffset = null;
            isFlying = false;
            controls.minDistance = 5;  // 恢复最小缩放距离
            // 恢复轨道线
            orbitLines.forEach(function(l){
                l.material.color.set(0x334455);
                l.material.opacity = 0.5;
            });
            document.getElementById('info-panel').style.display = 'none';
        }
        
        function showInfo(d) {
            var pa = document.getElementById('info-panel');
            var pn = document.getElementById('planet-name');
            var pi = document.getElementById('planet-info');
            if(!pa || !d) return;
            pa.style.display = 'block';
            if(pn) pn.textContent = (d.name_cn || d.name) + ' (' + d.name + ')';
            var h = '';
            if(d.distance_from_sun) h += '<div class="stat"><span class="stat-label">距太阳</span><span class="stat-value">'+d.distance_from_sun+' AU</span></div>';
            if(d.orbital_period) h += '<div class="stat"><span class="stat-label">公转周期</span><span class="stat-value">'+d.orbital_period.toFixed(1)+' 天</span></div>';
            if(d.rotation_period) h += '<div class="stat"><span class="stat-label">自转周期</span><span class="stat-value">'+d.rotation_period.toFixed(2)+' 天</span></div>';
            if(d.radius) h += '<div class="stat"><span class="stat-label">半径</span><span class="stat-value">'+d.radius.toFixed(0)+' km</span></div>';
            if(d.moons !== undefined) h += '<div class="stat"><span class="stat-label">卫星</span><span class="stat-value">'+d.moons+' 颗</span></div>';
            if(d.axial_tilt) h += '<div class="stat"><span class="stat-label">轴倾角</span><span class="stat-value">'+d.axial_tilt.toFixed(1)+'°</span></div>';
            
            if(d.description) h += '<p class="planet-desc">'+d.description+'</p>';
            h += '<div style="margin-top:10px;color:rgba(255,255,255,0.4);font-size:11px;">跟踪中 · 点击空白退出</div>';
            if(pi) pi.innerHTML = h;
        }

        // 速率滑块控制
        var speedSlider = document.getElementById('speed-slider');
        var speedValueEl = document.getElementById('speed-value');
        
        function updateSpeedDisplay() {
            if(speedValueEl) speedValueEl.textContent = speedLabels[currentSpeedIndex];
            if(speedSlider) speedSlider.value = currentSpeedIndex;
        }
        
        if(speedSlider) {
            speedSlider.addEventListener('input', function() {
                currentSpeedIndex = parseInt(this.value);
                speedMultiplier = speedLevels[currentSpeedIndex];
                updateSpeedDisplay();
            });
            updateSpeedDisplay();
        }
        
        // 暂停按钮
        var pb = document.getElementById('pause-btn');
        if(pb) pb.addEventListener('click', function(){ 
            paused = !paused; 
            pb.textContent = paused ? '▶ 继续' : '⏸ 暂停';
            lastRealTime = Date.now();  // 重置时间基准
        });
        
        // 调整时间按钮
        var adjustBtn = document.getElementById('adjust-btn');
        var timeAdjust = document.getElementById('time-adjust');
        var applyBtn = document.getElementById('apply-time');
        
        if(adjustBtn && timeAdjust) {
            adjustBtn.addEventListener('click', function() {
                timeAdjust.classList.toggle('show');
                if(timeAdjust.classList.contains('show')) {
                    var d = new Date(simTime);
                    document.getElementById('year-input').value = d.getFullYear();
                    document.getElementById('month-input').value = d.getMonth() + 1;
                    document.getElementById('day-input').value = d.getDate();
                    document.getElementById('hour-input').value = d.getHours();
                    document.getElementById('minute-input').value = d.getMinutes();
                    document.getElementById('second-input').value = d.getSeconds();
                }
            });
        }
        
        if(applyBtn) {
            applyBtn.addEventListener('click', function() {
                var year = parseInt(document.getElementById('year-input').value);
                var month = parseInt(document.getElementById('month-input').value) - 1;
                var day = parseInt(document.getElementById('day-input').value);
                var hour = parseInt(document.getElementById('hour-input').value);
                var minute = parseInt(document.getElementById('minute-input').value);
                var second = parseInt(document.getElementById('second-input').value);
                
                simTime = Date.UTC(year, month, day, hour, minute, second);
                lastRealTime = Date.now();
                updatePlanetsPosition(simTime);
                updateTimeDisplay();
                timeAdjust.classList.remove('show');
            });
        }
        
        // 重置到当前时间
        var resetBtn = document.getElementById('reset-btn');
        if(resetBtn) {
            resetBtn.addEventListener('click', function() {
                simTime = Date.now();
                lastRealTime = Date.now();
                updatePlanetsPosition(simTime);
                updateTimeDisplay();
            });
        }
        
        // 键盘控制
        document.addEventListener('keydown', function(e){
            if(e.code === 'Space'){ 
                e.preventDefault(); 
                paused = !paused; 
                if(pb) pb.textContent = paused ? '▶ 继续' : '⏸ 暂停';
                lastRealTime = Date.now();
            }
            if(e.code === 'Equal' || e.code === 'NumpadAdd' || e.code === 'ArrowRight') {  // + 或→键
                currentSpeedIndex = Math.min(currentSpeedIndex + 1, speedLevels.length - 1);
                speedMultiplier = speedLevels[currentSpeedIndex];
                updateSpeedDisplay();
            }
            if(e.code === 'Minus' || e.code === 'NumpadSubtract' || e.code === 'ArrowLeft') {  // - 或←键
                currentSpeedIndex = Math.max(currentSpeedIndex - 1, 0);
                speedMultiplier = speedLevels[currentSpeedIndex];
                updateSpeedDisplay();
            }
            if(e.code === 'KeyR'){ 
                simTime = Date.now();
                lastRealTime = Date.now();
                updatePlanetsPosition(simTime);
                updateTimeDisplay();
            }
            if(e.code === 'Escape') {
                stopTrack();
                if(timeAdjust) timeAdjust.classList.remove('show');
            }
        });

        // 点击/拖动检测（Pointer Events 统一鼠标和触摸）
        var downPos = null;
        var isDrag = false;
        var DRAG_THRESHOLD = 5;
        
        renderer.domElement.addEventListener('pointerdown', function(e){
            downPos = {x: e.clientX, y: e.clientY};
            isDrag = false;
        });
        
        renderer.domElement.addEventListener('pointermove', function(e){
            if(downPos){
                var dx = e.clientX - downPos.x;
                var dy = e.clientY - downPos.y;
                if(Math.sqrt(dx*dx + dy*dy) > DRAG_THRESHOLD){
                    isDrag = true;
                }
            }
        });
        
        renderer.domElement.addEventListener('pointerup', function(e){
            if(!isDrag && trackTarget){
                stopTrack();
            }
            downPos = null;
            isDrag = false;
        });

        var resizeTimer = null;
        window.addEventListener('resize', function(){
            if(resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function(){
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            }, 150);  // 150ms debounce
        });
        
        animate();
        } catch(e) { document.getElementById('loading').textContent = '错误: ' + e.message; }
    }

    function animate() {
        requestAnimationFrame(animate);
        
        // 计算真实时间流逝
        var realNow = Date.now();
        var realElapsed = realNow - lastRealTime;  // 毫秒
        if(realElapsed > 2000) realElapsed = 2000;  // delta cap: 防止切标签页回来模拟跳变
        lastRealTime = realNow;
        
        // 更新模拟时间
        if(!paused) {
            simTime += realElapsed * speedMultiplier;
            updateTimeDisplay();
        }
        
        var dt_seconds = paused ? 0 : realElapsed * speedMultiplier / 1000;
        var dt_days = dt_seconds / 86400;
        
        // 太阳自转
        if(sunMesh){
            var sunRotationPeriod = 25.4;
            sunMesh.rotation.y += dt_days / sunRotationPeriod * 2 * Math.PI;
            sunPulse += dt_days * 0.5;
            sunMesh.scale.setScalar(1 + Math.sin(sunPulse) * 0.02);
            
            // 日冕粒子更新（暂停时跳过）
            if(window._corona && !paused) {
                var cp = window._corona.mesh.geometry.attributes.position.array;
                for(var ci = 0; ci < window._corona.count; ci++) {
                    var cx = cp[ci*3], cy = cp[ci*3+1], cz = cp[ci*3+2];
                    var cd = Math.sqrt(cx*cx + cy*cy + cz*cz);
                    cp[ci*3] += (cx/cd) * window._corona.vels[ci];
                    cp[ci*3+1] += (cy/cd) * window._corona.vels[ci];
                    cp[ci*3+2] += (cz/cd) * window._corona.vels[ci];
                    if(cd > 12) {
                        var ct = Math.random() * Math.PI * 2;
                        var cpp = Math.acos(2 * Math.random() - 1);
                        cp[ci*3] = 5.2 * Math.sin(cpp) * Math.cos(ct);
                        cp[ci*3+1] = 5.2 * Math.sin(cpp) * Math.sin(ct);
                        cp[ci*3+2] = 5.2 * Math.cos(cpp);
                    }
                }
                window._corona.mesh.geometry.attributes.position.needsUpdate = true;
            }
        }
        
        // 统一用开普勒方程更新所有行星位置（含地球自转）
        if(!paused) {
            updatePlanetsPosition(simTime);
            
            // 非地球行星自转（地球自转已在updatePlanetsPosition中精确处理）
            planets.forEach(function(p){
                if(p.data.name !== 'Earth') {
                    var rotationPeriod = p.data.rotation_period || 1;
                    var rotationDir = rotationPeriod < 0 ? -1 : 1;
                    p.mesh.rotation.y += rotationDir * dt_days / Math.abs(rotationPeriod) * 2 * Math.PI;
                } else {
                    // 地球云层缓慢旋转（比地球自转慢）
                    var cloud = p.mesh.getObjectByProperty('isCloud', true);
                    if(cloud) cloud.rotation.y += dt_days * 0.3 * 2 * Math.PI;
                }
            });
        }
        
        // 月球（使用updatePlanetsPosition中计算的moon.angle）
        if(moon){
            moon.mesh.position.x = moon.earth.pivot.position.x + Math.cos(moon.angle) * moon.dist;
            moon.mesh.position.y = moon.earth.pivot.position.y + Math.sin(moon.angle) * Math.sin(MOON_INCLINATION) * moon.dist;
            moon.mesh.position.z = moon.earth.pivot.position.z + Math.sin(moon.angle) * Math.cos(MOON_INCLINATION) * moon.dist;
            moon.mesh.rotation.y = moon.angle;
        }
        
        // 小行星带（每3帧更新一次以节省性能）
        if(asteroidBelt && !paused){
            if(!window._asteroidFrame) window._asteroidFrame = 0;
            window._asteroidFrame++;
            if(window._asteroidFrame % 3 === 0) {
                var positions = asteroidBelt.geometry.attributes.position.array;
                var aDt = dt_days * 3;
                for(var i = 0; i < asteroidAngles.length; i++){
                    asteroidAngles[i] += aDt / asteroidPeriods[i] * 2 * Math.PI;
                    positions[i*3] = Math.cos(asteroidAngles[i]) * asteroidDists[i];
                    positions[i*3+2] = -Math.sin(asteroidAngles[i]) * asteroidDists[i];
                }
                asteroidBelt.geometry.attributes.position.needsUpdate = true;
            }
        }
        
        // 飞行动画
        if(isFlying && flyStart && flyEnd && flyStart.cam && flyEnd.cam){
            flyProgress += 0.02;
            if(flyProgress >= 1){ flyProgress = 1; isFlying = false; flyStart = null; flyEnd = null; }
            else {
                var t = flyProgress < 0.5 ? 2 * flyProgress * flyProgress : 1 - Math.pow(-2 * flyProgress + 2, 2) / 2;
                camera.position.lerpVectors(flyStart.cam, flyEnd.cam, t);
                controls.target.lerpVectors(flyStart.target, flyEnd.target, t);
            }
        }
        
        // 跟踪
        if(trackTarget && trackOffset && !isFlying && !isDragging){
            var targetPos = trackTarget.position.clone();
            camera.position.copy(targetPos.clone().add(trackOffset));
            controls.target.copy(targetPos);
        }
        
        // 标签投影+位置更新（每3帧）
        var updateLabels = (frameCount % 3 === 0);
        if(updateLabels){
            planets.forEach(function(p){
                if(p.label){
                    var v = p.pivot.position.clone();
                    v.y += p.mesh.geometry.parameters.radius + 0.5;
                    v.project(camera);
                    if(v.z < 1){
                        var dist = camera.position.distanceTo(p.pivot.position);
                        var opacity = Math.max(0.3, Math.min(1, 50 / dist));
                        var scale = Math.max(0.7, Math.min(1.2, 30 / dist));
                        p.label.style.display = 'block';
                        p.label.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
                        p.label.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
                        p.label.style.opacity = opacity;
                        // 冥王星LOD纹理切换
                        if(p.lodTextures){
                            var newLOD = dist > 80 ? 'low' : (dist > 20 ? 'mid' : 'high');
                            if(newLOD !== p.currentLOD){
                                p.mesh.material.map = p.lodTextures[newLOD];
                                p.mesh.material.needsUpdate = true;
                                p.currentLOD = newLOD;
                            }
                        }
                    } else {
                        p.label.style.display = 'none';
                    }
                }
            });
            
            // 太阳标签位置
            if(sunLabel){
                var sv = new THREE.Vector3(0, 6, 0).project(camera);
                if(sv.z < 1){
                    sunLabel.style.display='block';
                    sunLabel.style.left=((sv.x*0.5+0.5)*window.innerWidth)+'px';
                    sunLabel.style.top=((-sv.y*0.5+0.5)*window.innerHeight)+'px';
                } else { sunLabel.style.display='none'; }
            }
            
            // 月球标签位置更新
            if(moon && moon.label){
                var mv = moon.mesh.position.clone();
                mv.y += 0.5;
                mv.project(camera);
                if(mv.z < 1){
                    var moonDist = camera.position.distanceTo(moon.earth.pivot.position);
                    var moonScale = Math.max(0.7, Math.min(1.2, 30 / moonDist));
                    moon.label.style.display = 'block';
                    moon.label.style.left = ((mv.x * 0.5 + 0.5) * window.innerWidth) + 'px';
                    moon.label.style.top = ((-mv.y * 0.5 + 0.5) * window.innerHeight) + 'px';
                    moon.label.style.fontSize = (12 * moonScale) + 'px';
                    moon.label.style.opacity = Math.max(0.3, Math.min(1, 50 / moonDist));
                } else {
                    moon.label.style.display = 'none';
                }
            }
        }

        controls.update();
        renderer.render(scene, camera);
        frameCount++;
    }

    if (typeof window !== 'undefined' && typeof THREE !== 'undefined') { window.THREE = THREE; }
    init();
})();