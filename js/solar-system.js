(function() {
    var scene, camera, renderer, controls;
    var planets = [];
    var sunMesh = null;
    var speedMultiplier = 1.0;
    var moon = null;
    var paused = false;
    var sunPulse = 0;
    var asteroidBelt = null;
    var asteroidAngles = [];
    
    // 模拟时间（从今天开始，包含具体时间）
    var simDate = new Date();
    var simDays = 0; // 模拟经过的天数
    var simSeconds = 0; // 模拟经过的秒数
    
    // 当前时间的小时分数（用于地球自转初始角度）
    var initialHourFraction = (simDate.getHours() * 3600 + simDate.getMinutes() * 60 + simDate.getSeconds()) / 86400;
    
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
        // J2000.0 = 2000-01-01 12:00 UTC
        var j2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0));
        return (date.getTime() - j2000.getTime()) / (1000 * 60 * 60 * 24);
    }

    function init() {
        try {
        if (typeof THREE === 'undefined') {
            document.getElementById('loading').textContent = 'THREE 未定义'; return;
        }
        
        // 初始化模拟时间显示
        updateSimDateDisplay();
        
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
            var canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 64;
            var ctx = canvas.getContext('2d');
            var gradient = ctx.createLinearGradient(0, 0, 512, 0);
            gradient.addColorStop(0, 'rgba(210,180,140,0.1)');
            gradient.addColorStop(0.1, 'rgba(210,180,140,0.8)');
            gradient.addColorStop(0.2, 'rgba(180,150,100,0.3)');
            gradient.addColorStop(0.3, 'rgba(200,170,130,0.9)');
            gradient.addColorStop(0.4, 'rgba(160,140,110,0.2)');
            gradient.addColorStop(0.5, 'rgba(190,165,120,0.7)');
            gradient.addColorStop(0.6, 'rgba(170,150,115,0.4)');
            gradient.addColorStop(0.7, 'rgba(200,175,135,0.8)');
            gradient.addColorStop(0.85, 'rgba(180,160,125,0.5)');
            gradient.addColorStop(1, 'rgba(150,130,100,0.1)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 512, 64);
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
        
        // 计算当前日期相对于J2000的天数
        var daysSinceEpoch = daysSinceJ2000(simDate);
        
        // 春分参考点：2026年春分大约在3月20日
        // 计算从春分点的天数（简化：取整年）
        var currentYear = simDate.getFullYear();
        var springEquinox = new Date(currentYear, 2, 20); // 3月20日
        var daysSinceSpringEquinox = (simDate.getTime() - springEquinox.getTime()) / (1000 * 60 * 60 * 24);

        // 加载行星数据
        fetch('/solar-system/api/planets.php').then(function(r){return r.json();}).then(function(data){
            data.forEach(function(d){
                // 轨道参数
                var a = d.distance_from_sun * 30 + 10;
                var e = (d.eccentricity || 0) * 0.3;
                var b = a * Math.sqrt(1 - e * e);
                var inclination = (d.orbital_inclination || 0) * 0.3 * Math.PI / 180;
                var radius = Math.max(d.radius / 6371 * 2, 0.5);
                
                // 根据当前日期计算初始角度
                // 使用 J2000 平均近点角和近日点经度
                var M0 = (d.mean_anomaly_j2000 || 0) * Math.PI / 180; // J2000 平均近点角
                var omega = (d.perihelion_longitude || 0) * Math.PI / 180; // 近日点经度
                var meanMotion = 2 * Math.PI / d.orbital_period;
                
                // 平均近点角 M = M0 + n × t
                var M = M0 + meanMotion * daysSinceEpoch;
                
                // 从春分点开始的角度 = M + ω（近日点经度）
                var angle = M + omega;
                angle = angle % (2 * Math.PI); // 归一化
                
                // 计算初始位置
                var r0 = a * (1 - e * e) / (1 + e * Math.cos(angle));
                var x0 = r0 * Math.cos(angle);
                var z0 = r0 * Math.sin(angle);
                
                // 地球特殊处理：根据当前时间设置初始自转角度
                var initialRotation = 0;
                if(d.name === 'Earth'){
                    // 地球自转：让当前时间对应的经线处于正确位置
                    // 北京时间 22:18 = UTC 14:18
                    // UTC 12:00 时本初子午线正对太阳
                    // 所以 UTC 14:18 时，本初子午线已经转过了 2.3小时 * 15度/小时
                    var utcHour = simDate.getUTCHours() + simDate.getUTCMinutes()/60 + simDate.getUTCSeconds()/3600;
                    // 地球朝向太阳的角度
                    var toSun = Math.atan2(-x0, -z0);
                    // 自转角度：让当前时间的经线处于正确位置
                    // 北京时间 22:29 = UTC 14:29 = 中国晚上 = 中国背对太阳
                    // 中国在东经120度，UTC 14:29 时应该在背对太阳的位置
                    // 地球自转 = 让正确的时间对应正确的光照
                    // 偏移量需要让中国在晚上背对太阳
                    var chinaLonOffset = 120 * Math.PI / 180; // 中国东经120度
                    initialRotation = toSun + Math.PI/2 - (utcHour - 12) * Math.PI / 12 - chinaLonOffset;
                    console.log('Earth rotation - UTC:', utcHour.toFixed(2), 'toSun:', (toSun*180/Math.PI).toFixed(1), 'initialRotation:', (initialRotation*180/Math.PI).toFixed(1));
                }
                
                // 纹理
                var texture = null;
                try { texture = texLoader.load('/solar-system/textures/planets/' + d.name + '.jpg'); } catch(err) {}
                
                var mat = texture 
                    ? new THREE.MeshPhongMaterial({map: texture, shininess: 15})
                    : new THREE.MeshPhongMaterial({color: d.color || 0x888888, shininess: 15});
                
                // 用容器分离轴倾角和自转
                var pivot = new THREE.Object3D(); // 容器：处理轴倾角
                var mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 32), mat); // 球体：处理自转
                
                // 轴倾角：地球自转轴在空间中指向固定方向（北极星）
                // 轴倾角绕X轴旋转，让北极轴在YZ平面倾斜
                // 这样：春分时北极侧向太阳，夏至时北极倾向太阳，冬至时北极背离太阳
                var axialTilt = (d.axial_tilt || 0) * Math.PI / 180;
                pivot.rotation.x = -axialTilt; // 注意：负号让北极轴在夏至时倾向太阳
                pivot.add(mesh);
                
                // 自转轴指示器（放在容器下，不跟着球体自转）
                // 自转轴 = 行星围绕旋转的轴，穿过南北极
                var axisLength = radius * 2.5;
                var axisGeometry = new THREE.CylinderGeometry(0.015, 0.015, axisLength * 2, 8);
                var axisMaterial = new THREE.MeshBasicMaterial({color: 0x00ff88, transparent: true, opacity: 0.6});
                var axisMesh = new THREE.Mesh(axisGeometry, axisMaterial);
                // 圆柱默认沿Y轴，在pivot坐标系下Y轴就是自转轴方向
                pivot.add(axisMesh);
                
                // 北极标记（绿色）
                var northPole = new THREE.Mesh(
                    new THREE.SphereGeometry(0.12, 8, 8),
                    new THREE.MeshBasicMaterial({color: 0x00ff00})
                );
                northPole.position.y = axisLength;
                axisMesh.add(northPole);
                
                // 南极标记（红色）
                var southPole = new THREE.Mesh(
                    new THREE.SphereGeometry(0.1, 8, 8),
                    new THREE.MeshBasicMaterial({color: 0xff0000})
                );
                southPole.position.y = -axisLength;
                axisMesh.add(southPole);
                
                // 设置位置
                pivot.position.set(x0, z0 * Math.sin(inclination), z0 * Math.cos(inclination));
                
                mesh.userData = d;
                scene.add(pivot);
                
                // 土星环（跟球体一起自转）
                if(d.name === 'Saturn'){
                    var ring = new THREE.Mesh(
                        new THREE.RingGeometry(radius*1.3, radius*2.2, 64),
                        new THREE.MeshBasicMaterial({map:createSaturnRingTexture(), side:2, transparent:true, opacity:0.9})
                    );
                    ring.rotation.x = Math.PI / 2;
                    mesh.add(ring);
                }
                // 天王星环
                if(d.name === 'Uranus'){
                    var uRing = new THREE.Mesh(
                        new THREE.RingGeometry(radius*1.4, radius*1.7, 32),
                        new THREE.MeshBasicMaterial({map:createUranusRingTexture(), side:2, transparent:true, opacity:0.6})
                    );
                    uRing.rotation.x = Math.PI / 2;
                    mesh.add(uRing);
                }
                
                // 椭圆轨道线
                var oPts = [];
                for(var i = 0; i <= 128; i++){
                    var theta = i / 128 * Math.PI * 2;
                    var rOrbit = a * (1 - e * e) / (1 + e * Math.cos(theta));
                    var x = rOrbit * Math.cos(theta);
                    var z = rOrbit * Math.sin(theta);
                    oPts.push(new THREE.Vector3(x, z * Math.sin(inclination), z * Math.cos(inclination)));
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
                    axialTilt: axialTilt,
                    initialRotation: initialRotation
                });
            });
            
            // 月球
            var eP = planets.find(function(p){ return p.data.name === 'Earth'; });
            if(eP){
                var mMesh = new THREE.Mesh(
                    new THREE.SphereGeometry(0.27, 16, 16),
                    new THREE.MeshPhongMaterial({map: texLoader.load('/solar-system/textures/planets/Moon.jpg'), shininess:5})
                );
                scene.add(mMesh);
                moon = {mesh:mMesh, earth:eP, angle:0, dist:4};
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

        // 更新模拟时间显示
        function updateSimDateDisplay() {
            var displayDate = new Date(simDate.getTime() + simDays * 24 * 60 * 60 * 1000);
            var dateStr = displayDate.getFullYear() + '-' + 
                          String(displayDate.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(displayDate.getDate()).padStart(2, '0');
            var el = document.getElementById('sim-date');
            if(el) el.textContent = dateStr;
        }

        // 事件监听
        var sl = document.getElementById('speed-control');
        var sv = document.getElementById('speed-value');
        if(sl) sl.addEventListener('input', function(){ 
            speedMultiplier = parseFloat(this.value); 
            if(sv) {
                if(speedMultiplier >= 1000000) {
                    sv.textContent = (speedMultiplier / 1000000).toFixed(1) + 'Mx';
                } else if(speedMultiplier >= 1000) {
                    sv.textContent = (speedMultiplier / 1000).toFixed(1) + 'Kx';
                } else {
                    sv.textContent = speedMultiplier.toFixed(0) + 'x';
                }
            }
        });
        
        var pb = document.getElementById('pause-btn');
        if(pb) pb.addEventListener('click', function(){ paused = !paused; pb.textContent = paused ? '▶ 继续' : '⏸ 暂停'; });
        
        document.addEventListener('keydown', function(e){
            if(e.code === 'Space'){ e.preventDefault(); paused = !paused; if(pb) pb.textContent = paused ? '▶ 继续' : '⏸ 暂停'; }
            if(e.code === 'ArrowUp'){ speedMultiplier = Math.min(speedMultiplier + 5, 200); if(sl) sl.value = speedMultiplier; if(sv) sv.textContent = speedMultiplier.toFixed(0) + 'x'; }
            if(e.code === 'ArrowDown'){ speedMultiplier = Math.max(speedMultiplier - 5, 1); if(sl) sl.value = speedMultiplier; if(sv) sv.textContent = speedMultiplier.toFixed(0) + 'x'; }
            if(e.code === 'KeyR'){ camera.position.set(0,120,200); controls.target.set(0,0,0); controls.minDistance = 5; stopTrack(); }
            if(e.code === 'Escape') stopTrack();
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
                    isMouseDrag = true; // 移动超过5px就是拖动
                }
            }
        });
        
        renderer.domElement.addEventListener('mouseup', function(e){
            // 只有不是拖动，才检测是否退出跟踪
            if(!isMouseDrag && trackTarget){
                stopTrack();
            }
            mouseDownPos = null;
            isMouseDrag = false;
        });
        
        // 触屏设备同样处理
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
        
        // 实时模式：n倍速 = 1秒真实时间 = n秒模拟时间
        // dt_seconds = 模拟的秒数，dt_days = 模拟的天数
        var dt_seconds = paused ? 0 : speedMultiplier / 60; // 60fps
        var dt_days = dt_seconds / 86400;
        
        // 更新模拟天数
        simDays += dt_days;
        simSeconds += dt_seconds;
        
        // 每100帧更新一次日期显示
        if(Math.floor(simDays * 10) % 10 === 0) {
            updateSimDateDisplay();
        }
        
        // 太阳自转（真实周期约25.4天）
        if(sunMesh){
            var sunRotationPeriod = 25.4;
            sunMesh.rotation.y += dt_days / sunRotationPeriod * 2 * Math.PI;
            sunPulse += dt_days * 0.5;
            sunMesh.scale.setScalar(1 + Math.sin(sunPulse) * 0.02);
        }
        
        // 月球
        if(moon){
            // 月球公转周期约27.3天
            moon.angle += dt_days / 27.3 * 2 * Math.PI;
            moon.mesh.position.x = moon.earth.pivot.position.x + Math.cos(moon.angle) * moon.dist;
            moon.mesh.position.z = moon.earth.pivot.position.z + Math.sin(moon.angle) * moon.dist;
            // 月球自转周期 = 公转周期（潮汐锁定）
            moon.mesh.rotation.y = moon.angle;
        }
        
        // 行星公转和自转
        planets.forEach(function(p){
            // 公转：角度增量 = dt_days / 公转周期 * 2π，位置更新用 pivot
            p.angle += dt_days / p.data.orbital_period * 2 * Math.PI;
            var r = p.a * (1 - p.e * p.e) / (1 + p.e * Math.cos(p.angle));
            var x = r * Math.cos(p.angle);
            var z = r * Math.sin(p.angle);
            p.pivot.position.set(x, z * Math.sin(p.inclination), z * Math.cos(p.inclination));
            
            // 自转：绕Y轴旋转，只用 mesh
            var rotationPeriod = p.data.rotation_period || 1;
            var rotationDir = rotationPeriod < 0 ? -1 : 1; // 金星逆向自转
            // 加上初始自转角度（地球根据当前时间）
            p.mesh.rotation.y = (p.initialRotation || 0) + rotationDir * simSeconds / 86400 / Math.abs(rotationPeriod) * 2 * Math.PI;
        });
        
        // 小行星带公转
        if(asteroidBelt){
            var positions = asteroidBelt.geometry.attributes.position.array;
            for(var i = 0; i < asteroidAngles.length; i++){
                // 小行星带公转周期约 3-6 年，取平均 4.5 年 = 1642.5 天
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
        
        controls.update();
        renderer.render(scene, camera);
    }
    
    function updateSimDateDisplay() {
        var displayDate = new Date(simDate.getTime() + simDays * 24 * 60 * 60 * 1000);
        var dateStr = displayDate.getFullYear() + '-' + 
                      String(displayDate.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(displayDate.getDate()).padStart(2, '0');
        var el = document.getElementById('sim-date');
        if(el) el.textContent = dateStr;
    }

    if (typeof window !== 'undefined' && typeof THREE !== 'undefined') { window.THREE = THREE; }
    init();
})();
