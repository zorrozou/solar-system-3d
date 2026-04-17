(function() {
    var scene, camera, renderer, controls;
    var planets = [];
    var sunMesh = null;
    var speedMultiplier = 1;  // 速率倍数（模拟秒/真实秒）
    var moon = null;
    var paused = false;
    var sunPulse = 0;
    var asteroidBelt = null;
    var asteroidAngles = [];
    
    // 精确的模拟时间（毫秒级）
    var simTime = Date.now();  // 模拟时间的毫秒时间戳
    var lastRealTime = Date.now();  // 上一次真实时间
    
    // 当前速度档位
    var currentSpeedIndex = 0;
    var speedLevels = [1, 60, 600, 3600, 21600, 86400, 604800, 2592000, 7776000, 31536000];
    var speedLabels = ['1秒=1秒', '1秒=1分', '1秒=10分', '1秒=1时', '1秒=6时', '1秒=1天', '1秒=1周', '1秒=1月', '1秒=1季', '1秒=1年'];
    
    // 视角系统
    var trackTarget = null;
    var trackOffset = null;
    var isFlying = false;
    var isDragging = false;
    var flyStart = null;
    var flyEnd = null;
    var flyProgress = 0;

    // 计算从J2000.0到指定日期的天数
    function daysSinceJ2000(date) {
        var j2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
        return (date - j2000) / (1000 * 60 * 60 * 24);
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
        if(timeEl) timeEl.textContent = formatted.time;
        if(dateEl) dateEl.textContent = formatted.date;
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
            var r = p.a * (1 - e * e) / (1 + e * Math.cos(p.angle));
            var x = r * Math.cos(p.angle);
            var z = r * Math.sin(p.angle);
            p.pivot.position.set(x, z * Math.sin(p.inclination), z * Math.cos(p.inclination));
            
            // 更新地球自转
            if(d.name === 'Earth') {
                var d2 = new Date(date);
                var beijingHour = (d2.getUTCHours() + 8 + d2.getUTCMinutes()/60 + d2.getUTCSeconds()/3600) % 24;
                var toSun = Math.atan2(-x, -z);
                var rotationFromNoon = (beijingHour - 12) * Math.PI / 12;
                var beijingTheta = 206 * Math.PI / 180;
                p.mesh.rotation.y = toSun + rotationFromNoon - beijingTheta;
                
                // 木星初始旋转：让大红斑面向太阳
                if(d.name === 'Jupiter'){
                    var jupiterToSun = Math.atan2(-x0, -z0);
                    mesh.rotation.y = 0; // 大红斑面向太阳
                }
            }
        });
        
        // 更新月球位置
        if(moon) {
            var newMoonRef = Date.UTC(2000, 0, 6, 18, 14, 0);
            var daysSinceNew = (date - newMoonRef) / (1000 * 60 * 60 * 24);
            var synodicMonth = 29.530588;
            var moonPhase = (daysSinceNew % synodicMonth) / synodicMonth;
            
            var earthAngle = planets.find(function(p){ return p.data.name === 'Earth'; }).angle;
            var sunLongitude = earthAngle + Math.PI;
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
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 20000);
        camera.position.set(0, 120, 200);
        
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        document.getElementById('canvas-container').appendChild(renderer.domElement);
        
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.rotateSpeed = 0.8;
        controls.minDistance = 5;
        controls.maxDistance = 800;
        
        controls.addEventListener('start', function() {
            isDragging = true;
            isFlying = false;
        });
        controls.addEventListener('end', function() {
            isDragging = false;
            if(trackTarget) trackOffset = camera.position.clone().sub(trackTarget.position);
        });
        
        // 光照
        scene.add(new THREE.AmbientLight(0x222244, 0.3));
        var sunLight = new THREE.PointLight(0xfff5e6, 2.5, 3000);
        sunLight.position.set(0, 0, 0);
        sunLight.castShadow = true;
        scene.add(sunLight);

        // 星空
        var sGeo = new THREE.BufferGeometry(), sPos = [];
        for (var i = 0; i < 5000; i++) {
            var r = 3000 + Math.random() * 3000;
            var t = Math.random() * Math.PI * 2;
            var p = Math.acos(2 * Math.random() - 1);
            sPos.push(r*Math.sin(p)*Math.cos(t), r*Math.sin(p)*Math.sin(t), r*Math.cos(p));
        }
        sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
        scene.add(new THREE.Points(sGeo, new THREE.PointsMaterial({size:1.2})));

        // 太阳
        sunMesh = new THREE.Mesh(
            new THREE.SphereGeometry(5, 32, 32),
            new THREE.MeshBasicMaterial({color: 0xFDB813})
        );
        sunMesh.userData = {name:'Sun',name_cn:'太阳',description:'太阳是太阳系的中心天体，占太阳系总质量的99.86%', rotation_period: 25.4};
        scene.add(sunMesh);
        
        // 太阳光晕
        var gc=document.createElement('canvas');gc.width=gc.height=128;
        var gx=gc.getContext('2d');
        var gr=gx.createRadialGradient(64,64,0,64,64,64);
        gr.addColorStop(0,'rgba(255,220,100,0.6)');
        gr.addColorStop(0.4,'rgba(255,180,50,0.2)');
        gr.addColorStop(1,'rgba(255,100,0,0)');
        gx.fillStyle=gr;gx.fillRect(0,0,128,128);
        var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(gc),transparent:true,opacity:0.7}));
        sp.scale.set(30,30,1);
        sunMesh.add(sp);

        function createSaturnRingTexture() {
            // 超高清土星环纹理 4096x4096
            var canvas = document.createElement('canvas');
            canvas.width = 4096;
            canvas.height = 4096;
            var ctx = canvas.getContext('2d');
            
            var centerX = 2048;
            var centerY = 2048;
            
            // F环 (最外层)
            ctx.beginPath();
            ctx.arc(centerX, centerY, 2048, 0, Math.PI * 2);
            ctx.arc(centerX, centerY, 1800, 0, Math.PI * 2, true);
            ctx.fillStyle = 'rgba(155,135,100,0.25)';
            ctx.fill();
            
            // Encke缝隙
            ctx.beginPath();
            ctx.arc(centerX, centerY, 1800, 0, Math.PI * 2);
            ctx.arc(centerX, centerY, 1790, 0, Math.PI * 2, true);
            ctx.fillStyle = 'rgba(20,15,10,0.1)';
            ctx.fill();
            
            // A环
            ctx.beginPath();
            ctx.arc(centerX, centerY, 1790, 0, Math.PI * 2);
            ctx.arc(centerX, centerY, 1240, 0, Math.PI * 2, true);
            var aGrad = ctx.createRadialGradient(centerX, centerY, 1240, centerX, centerY, 1790);
            aGrad.addColorStop(0, 'rgba(175,150,115,0.6)');
            aGrad.addColorStop(0.3, 'rgba(190,165,125,0.8)');
            aGrad.addColorStop(0.7, 'rgba(185,160,120,0.7)');
            aGrad.addColorStop(1, 'rgba(180,155,115,0.5)');
            ctx.fillStyle = aGrad;
            ctx.fill();
            
            // Cassini 分裂 (最明显的缝隙)
            ctx.beginPath();
            ctx.arc(centerX, centerY, 1240, 0, Math.PI * 2);
            ctx.arc(centerX, centerY, 1130, 0, Math.PI * 2, true);
            ctx.fillStyle = 'rgba(30,25,20,0.08)';
            ctx.fill();
            
            // B环 (最亮最宽的主环)
            ctx.beginPath();
            ctx.arc(centerX, centerY, 1130, 0, Math.PI * 2);
            ctx.arc(centerX, centerY, 410, 0, Math.PI * 2, true);
            var bGrad = ctx.createRadialGradient(centerX, centerY, 410, centerX, centerY, 1130);
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
            ctx.arc(centerX, centerY, 410, 0, Math.PI * 2);
            ctx.arc(centerX, centerY, 0, 0, Math.PI * 2, true);
            var cGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 410);
            cGrad.addColorStop(0, 'rgba(100,85,70,0.0)');
            cGrad.addColorStop(0.3, 'rgba(120,100,80,0.15)');
            cGrad.addColorStop(0.7, 'rgba(130,105,85,0.22)');
            cGrad.addColorStop(1, 'rgba(125,100,80,0.35)');
            ctx.fillStyle = cGrad;
            ctx.fill();
            
            // 添加密度波动细节
            for(var i = 0; i < 300; i++){
                var r = 410 + Math.random() * 1380;
                var angle = Math.random() * Math.PI * 2;
                var x = centerX + Math.cos(angle) * r;
                var y = centerY + Math.sin(angle) * r;
                ctx.beginPath();
                ctx.arc(x, y, 1 + Math.random() * 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,' + (0.02 + Math.random() * 0.05) + ')';
                ctx.fill();
            }
            
            // 添加土星影子 - 半透明的黑色椭圆，模拟土星遮挡阳光
            // 假设阳光从左侧照过来，影子在右侧
            var shadowGrad = ctx.createRadialGradient(
                centerX + 600, centerY, 0,      // 影子中心偏右
                centerX + 600, centerY, 800     // 影子半径
            );
            shadowGrad.addColorStop(0, 'rgba(0,0,0,0.4)');
            shadowGrad.addColorStop(0.3, 'rgba(0,0,0,0.25)');
            shadowGrad.addColorStop(0.7, 'rgba(0,0,0,0.1)');
            shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = shadowGrad;
            ctx.fillRect(0, 0, 4096, 4096);
            
            return new THREE.CanvasTexture(canvas);
        }
        function createUranusRingTexture() {
            var canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 32;
            var ctx = canvas.getContext('2d');
            var gradient = ctx.createLinearGradient(0, 0, 256, 0);
            gradient.addColorStop(0, 'rgba(136,170,190,0.1)');
            gradient.addColorStop(0.3, 'rgba(136,180,200,0.4)');
            gradient.addColorStop(0.5, 'rgba(150,190,210,0.5)');
            gradient.addColorStop(0.7, 'rgba(130,175,195,0.3)');
            gradient.addColorStop(1, 'rgba(120,160,180,0.1)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 256, 32);
            return new THREE.CanvasTexture(canvas);
        }

        var texLoader = new THREE.TextureLoader();
        
        // 当前日期
        var currentDate = new Date(simTime);
        var daysSinceEpoch = daysSinceJ2000(currentDate);

        // 加载行星数据
        fetch('/solar-system/api/planets.php').then(function(r){return r.json();}).then(function(data){
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
                
                var r0 = a * (1 - e * e) / (1 + e * Math.cos(angle));
                var x0 = r0 * Math.cos(angle);
                var z0 = r0 * Math.sin(angle);
                
                // 纹理
                var texture = null;
                // 地球使用高清纹理
                if(d.name === 'Earth') {
                    try { texture = texLoader.load('/solar-system/textures/planets/Earth-HD.jpg?v8k2'); } catch(err) {}
                } else {
                    try { texture = texLoader.load('/solar-system/textures/planets/' + d.name + '.jpg?v8k2'); } catch(err) {}
                }
                
                var mat = texture 
                    ? new THREE.MeshPhongMaterial({map: texture, shininess: 15})
                    : new THREE.MeshPhongMaterial({color: d.color || 0x888888, shininess: 15});
                
                var pivot = new THREE.Object3D();
                var mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 32), mat);
                
                // 夏至时（地球在-Z位置）北极指向太阳（+Z方向）
                var axialTilt = (d.axial_tilt || 0) * Math.PI / 180;
                pivot.rotation.x = axialTilt;  // 固定方向，公转时相对太阳角度会变化
                pivot.add(mesh);
                
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
                        new THREE.RingGeometry(radius*1.3, radius*2.2, 64),
                        new THREE.MeshBasicMaterial({map:createSaturnRingTexture(), side:2, transparent:true, opacity:0.9})
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
                    var beijingTheta = 206 * Math.PI / 180;
                    mesh.rotation.y = toSun + rotationFromNoon - beijingTheta;
                }
                
                // 木星初始旋转：让大红斑面向太阳
                if(d.name === 'Jupiter'){
                    var jupiterToSun = Math.atan2(-x0, -z0);
                    mesh.rotation.y = 0; // 大红斑面向太阳
                }
                
                // 椭圆轨道线
                var oPts = [];
                for(var i = 0; i <= 128; i++){
                    var theta = i / 128 * Math.PI * 2;
                    var rOrbit = a * (1 - e * e) / (1 + e * Math.cos(theta));
                    var ox = rOrbit * Math.cos(theta);
                    var oz = rOrbit * Math.sin(theta);
                    oPts.push(new THREE.Vector3(ox, oz * Math.sin(inclination), oz * Math.cos(inclination)));
                }
                scene.add(new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints(oPts),
                    new THREE.LineBasicMaterial({color:0x334455, transparent:true, opacity:0.5})
                ));
                
                // 标签
                var label = document.createElement('div');
                label.textContent = d.name_cn || d.name;
                label.className = 'planet-label';
                label.style.cssText = 'position:absolute;color:rgba(255,255,255,0.7);font-size:12px;cursor:pointer;text-align:center;white-space:nowrap;padding:2px 6px;border-radius:3px;transition:background 0.2s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;';
                label.addEventListener('mouseenter', function(){ this.style.background='rgba(255,255,255,0.15)'; this.style.color='#fff'; });
                label.addEventListener('mouseleave', function(){ this.style.background='none'; this.style.color='rgba(255,255,255,0.7)'; });
                document.getElementById('canvas-container').appendChild(label);
                
                (function(pivot, mesh, r){
                    label.addEventListener('click', function(e){ e.stopPropagation(); startTrack(pivot, mesh, r); });
                    label.addEventListener('touchend', function(e){ e.preventDefault(); e.stopPropagation(); startTrack(pivot, mesh, r); });
                })(pivot, mesh, radius);
                
                planets.push({
                    pivot: pivot,
                    mesh: mesh, 
                    data: d, 
                    angle: angle, 
                    a: a, 
                    e: e, 
                    inclination: inclination,
                    label: label,
                    axialTilt: axialTilt
                });
            });
            
            // 月球
            var eP = planets.find(function(p){ return p.data.name === 'Earth'; });
            if(eP){
                var mMesh = new THREE.Mesh(
                    new THREE.SphereGeometry(0.27, 16, 16),
                    new THREE.MeshPhongMaterial({map: texLoader.load('/solar-system/textures/planets/Moon.jpg?v8k2'), shininess:5})
                );
                mMesh.userData = { name: 'Moon', name_cn: '月球', radius: 0.27 };
                scene.add(mMesh);
                
                // 月球标签
                var moonLabel = document.createElement('div');
                moonLabel.textContent = '月球';
                moonLabel.className = 'planet-label';
                moonLabel.style.cssText = 'position:absolute;color:rgba(255,255,255,0.7);font-size:12px;cursor:pointer;text-align:center;white-space:nowrap;padding:2px 6px;border-radius:3px;transition:background 0.2s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;';
                moonLabel.addEventListener('mouseenter', function(){ this.style.background='rgba(255,255,255,0.15)'; this.style.color='#fff'; });
                moonLabel.addEventListener('mouseleave', function(){ this.style.background='none'; this.style.color='rgba(255,255,255,0.7)'; });
                moonLabel.addEventListener('click', function(e){ e.stopPropagation(); startTrackMoon(mMesh); });
                moonLabel.addEventListener('touchend', function(e){ e.preventDefault(); e.stopPropagation(); startTrackMoon(mMesh); });
                document.getElementById('canvas-container').appendChild(moonLabel);
                
                var newMoonRef = Date.UTC(2000, 0, 6, 18, 14, 0);
                var daysSinceNew = (simTime - newMoonRef) / (1000 * 60 * 60 * 24);
                var synodicMonth = 29.530588;
                var moonPhase = (daysSinceNew % synodicMonth) / synodicMonth;
                var sunLongitude = eP.angle + Math.PI;
                var moonInitAngle = sunLongitude + moonPhase * 2 * Math.PI;
                
                moon = {mesh:mMesh, earth:eP, angle:moonInitAngle, dist:4, label:moonLabel};
            }
            
            // 小行星带
            var aPos = [], aCount = 1500;
            for(var i = 0; i < aCount; i++){
                var ar = (2.2 + Math.random() * 1.1) * 30 + 10;
                var at = Math.random() * Math.PI * 2;
                aPos.push(Math.cos(at)*ar, (Math.random()-0.5)*3, Math.sin(at)*ar);
                asteroidAngles.push(at);
            }
            asteroidBelt = new THREE.Points(
                new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(aPos, 3)),
                new THREE.PointsMaterial({color:0x888888, size:0.3, transparent:true, opacity:0.6})
            );
            scene.add(asteroidBelt);
            
            document.getElementById('loading').style.display = 'none';
        }).catch(function(e){
            document.getElementById('loading').textContent = '加载失败: ' + e.message;
        });

        // 视角控制
        function startTrack(targetPivot, targetMesh, radius) {
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
                
                simTime = new Date(year, month, day, hour, minute, second).getTime();
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

        // 点击/拖动检测
        var mouseDownPos = null;
        var isMouseDrag = false;
        
        renderer.domElement.addEventListener('mousedown', function(e){
            mouseDownPos = {x: e.clientX, y: e.clientY};
            isMouseDrag = false;
        });
        
        renderer.domElement.addEventListener('mousemove', function(e){
            if(mouseDownPos){
                var dx = e.clientX - mouseDownPos.x;
                var dy = e.clientY - mouseDownPos.y;
                if(Math.sqrt(dx*dx + dy*dy) > 5){
                    isMouseDrag = true;
                }
            }
        });
        
        renderer.domElement.addEventListener('mouseup', function(e){
            if(!isMouseDrag && trackTarget){
                stopTrack();
            }
            mouseDownPos = null;
            isMouseDrag = false;
        });
        
        var touchDownPos = null;
        var isTouchDrag = false;
        
        renderer.domElement.addEventListener('touchstart', function(e){
            if(e.touches.length === 1){
                touchDownPos = {x: e.touches[0].clientX, y: e.touches[0].clientY};
                isTouchDrag = false;
            }
        });
        
        renderer.domElement.addEventListener('touchmove', function(e){
            if(touchDownPos && e.touches.length === 1){
                var dx = e.touches[0].clientX - touchDownPos.x;
                var dy = e.touches[0].clientY - touchDownPos.y;
                if(Math.sqrt(dx*dx + dy*dy) > 10){
                    isTouchDrag = true;
                }
            }
        });
        
        renderer.domElement.addEventListener('touchend', function(e){
            if(!isTouchDrag && trackTarget){
                stopTrack();
            }
            touchDownPos = null;
            isTouchDrag = false;
        });

        window.addEventListener('resize', function(){
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        animate();
        } catch(e) { document.getElementById('loading').textContent = '错误: ' + e.message; }
    }

    function animate() {
        requestAnimationFrame(animate);
        
        // 计算真实时间流逝
        var realNow = Date.now();
        var realElapsed = realNow - lastRealTime;  // 毫秒
        lastRealTime = realNow;
        
        // 更新模拟时间
        if(!paused) {
            // speedMultiplier = 模拟秒/真实秒
            // realElapsed 毫秒 * speedMultiplier = 模拟毫秒
            simTime += realElapsed * speedMultiplier;
            updateTimeDisplay();
        }
        
        // 暂停时所有动画都停止
        var dt_seconds = paused ? 0 : realElapsed * speedMultiplier / 1000;
        var dt_days = dt_seconds / 86400;
        
        // 太阳自转
        if(sunMesh){
            var sunRotationPeriod = 25.4;
            sunMesh.rotation.y += dt_days / sunRotationPeriod * 2 * Math.PI;
            sunPulse += dt_days * 0.5;
            sunMesh.scale.setScalar(1 + Math.sin(sunPulse) * 0.02);
        }
        
        // 月球
        if(moon){
            moon.angle += dt_days / 27.3 * 2 * Math.PI;
            moon.mesh.position.x = moon.earth.pivot.position.x + Math.cos(moon.angle) * moon.dist;
            moon.mesh.position.z = moon.earth.pivot.position.z + Math.sin(moon.angle) * moon.dist;
            moon.mesh.rotation.y = moon.angle;
        }
        
        // 行星公转和自转
        planets.forEach(function(p){
            p.angle += dt_days / p.data.orbital_period * 2 * Math.PI;
            var r = p.a * (1 - p.e * p.e) / (1 + p.e * Math.cos(p.angle));
            var x = r * Math.cos(p.angle);
            var z = r * Math.sin(p.angle);
            p.pivot.position.set(x, z * Math.sin(p.inclination), z * Math.cos(p.inclination));
            
            var rotationPeriod = p.data.rotation_period || 1;
            var rotationDir = rotationPeriod < 0 ? -1 : 1;
            p.mesh.rotation.y += rotationDir * dt_days / Math.abs(rotationPeriod) * 2 * Math.PI;
            
            
        });
        
        // 小行星带
        if(asteroidBelt){
            var positions = asteroidBelt.geometry.attributes.position.array;
            for(var i = 0; i < asteroidAngles.length; i++){
                asteroidAngles[i] += dt_days / 1642.5 * 2 * Math.PI;
                var dist = Math.sqrt(positions[i*3]*positions[i*3] + positions[i*3+2]*positions[i*3+2]);
                positions[i*3] = Math.cos(asteroidAngles[i]) * dist;
                positions[i*3+2] = Math.sin(asteroidAngles[i]) * dist;
            }
            asteroidBelt.geometry.attributes.position.needsUpdate = true;
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
        
        // 标签
        planets.forEach(function(p){
            if(p.label){
                var v = p.pivot.position.clone();
                v.y += p.mesh.geometry.parameters.radius + 0.5;
                v.project(camera);
                if(v.z < 1){
                    p.label.style.display = 'block';
                    p.label.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
                    p.label.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
                } else {
                    p.label.style.display = 'none';
                }
            }
        });
        
        // 月球标签位置更新
        if(moon && moon.label){
            var mv = moon.mesh.position.clone();
            mv.y += 0.5;
            mv.project(camera);
            if(mv.z < 1){
                moon.label.style.display = 'block';
                moon.label.style.left = ((mv.x * 0.5 + 0.5) * window.innerWidth) + 'px';
                moon.label.style.top = ((-mv.y * 0.5 + 0.5) * window.innerHeight) + 'px';
            } else {
                moon.label.style.display = 'none';
            }
        }
        
        controls.update();
        renderer.render(scene, camera);
    }

    if (typeof window !== 'undefined' && typeof THREE !== 'undefined') { window.THREE = THREE; }
    init();
})();