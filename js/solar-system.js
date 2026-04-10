(function() {
    var scene, camera, renderer, controls;
    var planets = [];
    var sunMesh = null;
    var speedMultiplier = 10.0;
    var moon = null;
    var paused = false;
    var flyTarget = null;
    var trackTarget = null;  // 跟踪目标
    var trackOffset = null;   // 相机相对于行星的偏移
    var flyProgress = 0; // 飞行进度
    var sunPulse = 0;

    function init() {
        try {
        if (typeof THREE === 'undefined') {
            document.getElementById('loading').textContent = 'THREE 未定义'; return;
        }
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
        
        // 拖动结束后更新跟踪偏移
        controls.addEventListener('end', function() {
            if(trackTarget) {
                trackOffset = camera.position.clone().sub(trackTarget.position);
            }
        });
        
        scene.add(new THREE.AmbientLight(0x222244, 0.3));
        var sunLight = new THREE.PointLight(0xfff5e6, 2.5, 3000);
        sunLight.position.set(0, 0, 0);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024;
        sunLight.shadow.mapSize.height = 1024;
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
        sunMesh.userData = {name:'Sun',name_cn:'太阳',description:'太阳是太阳系的中心天体，占太阳系总质量的99.86%'};
        scene.add(sunMesh);
        var gc=document.createElement('canvas');gc.width=gc.height=128;
        var gx=gc.getContext('2d');
        var gr=gx.createRadialGradient(64,64,0,64,64,64);
        gr.addColorStop(0,'rgba(255,220,100,0.6)');gr.addColorStop(0.4,'rgba(255,180,50,0.2)');gr.addColorStop(1,'rgba(255,100,0,0)');
        gx.fillStyle=gr;gx.fillRect(0,0,128,128);
        var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(gc),transparent:true,opacity:0.7}));
        sp.scale.set(30,30,1);sunMesh.add(sp);

        // 土星环纹理生成器
        function createSaturnRingTexture() {
            var canvas = document.createElement('canvas');
            canvas.width = 512; canvas.height = 64;
            var ctx = canvas.getContext('2d');
            var gradient = ctx.createLinearGradient(0, 0, 512, 0);
            gradient.addColorStop(0, 'rgba(210, 180, 140, 0.1)');
            gradient.addColorStop(0.1, 'rgba(210, 180, 140, 0.8)');
            gradient.addColorStop(0.2, 'rgba(180, 150, 100, 0.3)');
            gradient.addColorStop(0.3, 'rgba(200, 170, 130, 0.9)');
            gradient.addColorStop(0.4, 'rgba(160, 140, 110, 0.2)');
            gradient.addColorStop(0.5, 'rgba(190, 165, 120, 0.7)');
            gradient.addColorStop(0.6, 'rgba(170, 150, 115, 0.4)');
            gradient.addColorStop(0.7, 'rgba(200, 175, 135, 0.8)');
            gradient.addColorStop(0.85, 'rgba(180, 160, 125, 0.5)');
            gradient.addColorStop(1, 'rgba(150, 130, 100, 0.1)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 512, 64);
            return new THREE.CanvasTexture(canvas);
        }

        // 天王星环纹理
        function createUranusRingTexture() {
            var canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 32;
            var ctx = canvas.getContext('2d');
            var gradient = ctx.createLinearGradient(0, 0, 256, 0);
            gradient.addColorStop(0, 'rgba(136, 170, 190, 0.1)');
            gradient.addColorStop(0.3, 'rgba(136, 180, 200, 0.4)');
            gradient.addColorStop(0.5, 'rgba(150, 190, 210, 0.5)');
            gradient.addColorStop(0.7, 'rgba(130, 175, 195, 0.3)');
            gradient.addColorStop(1, 'rgba(120, 160, 180, 0.1)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 256, 32);
            return new THREE.CanvasTexture(canvas);
        }

        // 纹理加载器
        var texLoader = new THREE.TextureLoader();

        fetch('/solar-system/api/planets.php').then(function(r){return r.json();}).then(function(data){
            data.forEach(function(d){
                var dist = d.distance_from_sun * 30 + 10;
                var radius = Math.max(d.radius / 6371 * 2, 0.5);
                var angle = Math.random() * Math.PI * 2;
                
                // 纹理加载带容错
                var texture = null;
                var texPath = '/solar-system/textures/planets/' + d.name + '.jpg';
                try {
                    texture = texLoader.load(texPath);
                } catch(e) {
                    console.warn('纹理加载失败:', d.name);
                }
                
                var mat = texture 
                    ? new THREE.MeshPhongMaterial({map: texture, shininess: 15})
                    : new THREE.MeshPhongMaterial({color: d.color || 0x888888, shininess: 15});
                
                var mesh = new THREE.Mesh(
                    new THREE.SphereGeometry(radius, 32, 32),
                    mat
                );
                mesh.position.set(Math.cos(angle)*dist, 0, Math.sin(angle)*dist);
                mesh.userData = d;
                
                // 应用轴倾角
                var tilt = d.axial_tilt || 0;
                mesh.rotation.z = tilt * Math.PI / 180;
                
                scene.add(mesh);
                
                // 轨道
                var oPts=[];
                for(var i=0;i<=128;i++){
                    var a=i/128*Math.PI*2;
                    oPts.push(new THREE.Vector3(Math.cos(a)*dist,0,Math.sin(a)*dist));
                }
                scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(oPts), new THREE.LineBasicMaterial({color:0x334455})));
                
                // 土星环（渐变纹理）
                if(d.name==='Saturn'){
                    var rg=new THREE.RingGeometry(radius*1.3,radius*2.2,64);
                    var rm=new THREE.MeshBasicMaterial({
                        map: createSaturnRingTexture(),
                        side: 2,
                        transparent: true,
                        opacity: 0.9
                    });
                    var ring=new THREE.Mesh(rg,rm);
                    ring.rotation.x=Math.PI/2;
                    mesh.add(ring);
                }
                
                // 天王星环（渐变纹理）
                if(d.name==='Uranus'){
                    var ug=new THREE.RingGeometry(radius*1.4,radius*1.7,32);
                    var um=new THREE.MeshBasicMaterial({
                        map: createUranusRingTexture(),
                        side: 2,
                        transparent: true,
                        opacity: 0.6
                    });
                    var uRing=new THREE.Mesh(ug,um);
                    uRing.rotation.x=Math.PI/2;
                    mesh.add(uRing);
                }
                
                // 点击热区
                var hitSize=Math.max(radius*3, 2);
                var hitMesh=new THREE.Mesh(new THREE.SphereGeometry(hitSize,8,8),new THREE.MeshBasicMaterial({visible:false}));
                mesh.add(hitMesh);
                
                // 行星名字标签
                var label=document.createElement('div');
                label.textContent=d.name_cn||d.name;
                label.style.cssText='position:absolute;color:rgba(255,255,255,0.7);font-size:12px;cursor:pointer;text-align:center;white-space:nowrap;padding:2px 6px;border-radius:3px;transition:background 0.2s;';
                label.addEventListener('mouseenter',function(){this.style.background='rgba(255,255,255,0.15)';this.style.color='rgba(255,255,255,1)';});
                label.addEventListener('mouseleave',function(){this.style.background='none';this.style.color='rgba(255,255,255,0.7)';});
                document.getElementById('canvas-container').appendChild(label);
                
                (function(m,r){
                    label.addEventListener('click',function(e){
                        e.stopPropagation();
                        var pos=m.position.clone();
                        var vd=(r||1)*5;
                        flyTarget={pos:pos,cam:new THREE.Vector3(pos.x+vd,pos.y+vd*0.4,pos.z+vd),mesh:m};
                        flyProgress = 0;
                        controls.minDistance=r*2;
                        trackTarget = m;
                        trackOffset = new THREE.Vector3(vd, vd*0.4, vd);
                        showPlanetInfo(m.userData, m);
                    });
                })(mesh,radius);
                planets.push({mesh:mesh, data:d, angle:angle, dist:dist, label:label});
            });
            
            var eP=null;planets.forEach(function(p){if(p.data.name==='Earth')eP=p;});
            if(eP){
                var mMesh=new THREE.Mesh(
                    new THREE.SphereGeometry(0.27,16,16),
                    new THREE.MeshPhongMaterial({map: texLoader.load('/solar-system/textures/planets/Moon.jpg'),shininess:5})
                );
                scene.add(mMesh);
                moon={mesh:mMesh,earth:eP,angle:0,dist:4};
            }
            
            // 小行星带
            var aPts=[];
            for(var i=0;i<2000;i++){
                var ar=(2.2+Math.random()*1.1)*30+10;
                var at=Math.random()*Math.PI*2;
                aPts.push(Math.cos(at)*ar,(Math.random()-0.5)*4,Math.sin(at)*ar);
            }
            var aGeo=new THREE.BufferGeometry();
            aGeo.setAttribute('position',new THREE.Float32BufferAttribute(aPts,3));
            scene.add(new THREE.Points(aGeo,new THREE.PointsMaterial({color:0x888888,size:0.4,transparent:true,opacity:0.5})));
            
            document.getElementById('loading').style.display='none';
        }).catch(function(e){
            document.getElementById('loading').textContent='加载失败: '+e.message;
        });

        // 显示行星信息面板
        function showPlanetInfo(d, mesh) {
            var pa=document.getElementById('info-panel'),pn=document.getElementById('planet-name'),pi=document.getElementById('planet-info');
            if(pa&&d){
                pa.style.display='block';
                if(pn)pn.textContent=(d.name_cn||d.name)+' ('+d.name+')';
                var h='';
                if(d.distance_from_sun)h+='<div class="stat"><span class="stat-label">距太阳</span><span class="stat-value">'+d.distance_from_sun+' AU</span></div>';
                if(d.orbital_period)h+='<div class="stat"><span class="stat-label">公转周期</span><span class="stat-value">'+d.orbital_period+' 天</span></div>';
                if(d.radius)h+='<div class="stat"><span class="stat-label">半径</span><span class="stat-value">'+d.radius.toFixed(0)+' km</span></div>';
                if(d.moons!==undefined)h+='<div class="stat"><span class="stat-label">卫星</span><span class="stat-value">'+d.moons+' 颗</span></div>';
                if(d.description)h+='<p class="planet-desc">'+d.description+'</p>';
                h+='<div style="margin-top:10px;color:rgba(255,255,255,0.4);font-size:11px;">已自动跟踪 · 点击空白处退出</div>';
                if(pi)pi.innerHTML=h;
            }
        }

        var sl=document.getElementById('speed-control'),sv=document.getElementById('speed-value');
        if(sl){sl.addEventListener('input',function(){speedMultiplier=parseFloat(this.value);if(sv)sv.textContent=speedMultiplier.toFixed(0)+'x';});}
        var pb=document.getElementById('pause-btn');
        if(pb){pb.addEventListener('click',function(){paused=!paused;pb.textContent=paused?'▶ 继续':'⏸ 暂停';});}
        
        document.addEventListener('keydown',function(e){
            if(e.code==='Space'){e.preventDefault();paused=!paused;if(pb)pb.textContent=paused?'▶ 继续':'⏸ 暂停';}
            if(e.code==='ArrowUp'){speedMultiplier=Math.min(speedMultiplier+5,200);if(sl)sl.value=speedMultiplier;if(sv)sv.textContent=speedMultiplier.toFixed(0)+'x';}
            if(e.code==='ArrowDown'){speedMultiplier=Math.max(speedMultiplier-5,1);if(sl)sl.value=speedMultiplier;if(sv)sv.textContent=speedMultiplier.toFixed(0)+'x';}
            if(e.code==='KeyR'){
                camera.position.set(0,120,200);
                controls.target.set(0,0,0);
                controls.minDistance=5;
                controls.maxDistance=800;
                flyTarget=null;
                flyProgress=0;
                trackTarget=null;
                trackOffset=null;
                document.getElementById('info-panel').style.display='none';
            }
            if(e.code==='Escape'){
                trackTarget = null;
                trackOffset = null;
                document.getElementById('info-panel').style.display='none';
            }
        });

        renderer.domElement.addEventListener('click',function(e){
            var msv=new THREE.Vector2((e.clientX/window.innerWidth)*2-1,-(e.clientY/window.innerHeight)*2+1);
            var rc=new THREE.Raycaster();rc.setFromCamera(msv,camera);
            var tg=planets.map(function(p){return p.mesh;});tg.push(sunMesh);if(moon)tg.push(moon.mesh);
            var hits=rc.intersectObjects(tg,true);
            
            if(hits.length>0){
                // 点击到行星
                var clickObj=hits[0].object;
                while(clickObj.parent&&!clickObj.userData.name){clickObj=clickObj.parent;}
                var d=clickObj.userData;
                
                // 默认跟踪此行星
                trackTarget = clickObj;
                
                if(clickObj!==sunMesh){
                    var pos=clickObj.position.clone();
                    var baseR=clickObj.geometry.parameters.radius||1;
                    var vd=baseR*5;
                    flyTarget={pos:pos, cam:new THREE.Vector3(pos.x+vd,pos.y+vd*0.4,pos.z+vd), mesh:clickObj};
                    flyProgress = 0;
                    controls.minDistance=baseR*2;
                    controls.maxDistance=800;
                    // 设置初始偏移
                    trackOffset = new THREE.Vector3(vd, vd*0.4, vd);
                } else {
                    // 点击太阳
                    trackOffset = camera.position.clone().sub(clickObj.position);
                }
                showPlanetInfo(d, clickObj);
                if(window._measureFrom&&clickObj!==sunMesh){
                    var f=window._measureFrom.position;
                    var t=clickObj.position;
                    var dist=f.distanceTo(t);
                    var auDist=(dist/30).toFixed(2);
                    var pi=document.getElementById('planet-info');
                    if(pi){
                        var h=pi.innerHTML;
                        h+='<div class="stat" style="margin-top:10px;border-top:1px solid rgba(255,255,255,0.2);padding-top:8px;"><span class="stat-label">距离 '+window._measureName+'</span><span class="stat-value">'+auDist+' AU ('+dist.toFixed(1)+' 单位)</span></div>';
                        pi.innerHTML=h;
                    }
                    window._measureFrom=null;window._measureName='';
                }
            } else {
                // 点击空白处：退出跟踪，关闭面板
                trackTarget = null;
                trackOffset = null;
                document.getElementById('info-panel').style.display='none';
            }
        });

        window.addEventListener('resize',function(){camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});
        animate();
        } catch(e) { document.getElementById('loading').textContent='错误: '+e.message; }
    }

    function animate() {
        requestAnimationFrame(animate);
        var dt = paused ? 0 : speedMultiplier * 0.01;
        
        // 太阳自转 + 脉动
        if(sunMesh){
            sunMesh.rotation.y += dt * 0.02;
            sunPulse += dt * 0.5;
            var pulseScale = 1 + Math.sin(sunPulse) * 0.02;
            sunMesh.scale.set(pulseScale, pulseScale, pulseScale);
        }
        
        if(moon){
            moon.angle+=dt*0.07;
            moon.mesh.position.x=moon.earth.mesh.position.x+Math.cos(moon.angle)*moon.dist;
            moon.mesh.position.z=moon.earth.mesh.position.z+Math.sin(moon.angle)*moon.dist;
            moon.mesh.rotation.y+=dt*0.3;
        }
        
        planets.forEach(function(p){
            p.angle+=(1/p.data.orbital_period)*dt;
            p.mesh.position.x=Math.cos(p.angle)*p.dist;
            p.mesh.position.z=Math.sin(p.angle)*p.dist;
            p.mesh.rotation.y+=dt*0.5;
        });
        
        // 飞行动画：一次性完成
        if(flyTarget && flyProgress < 1){
            flyProgress += 0.05;
            if(flyProgress > 1) flyProgress = 1;
            
            var targetPos = flyTarget.mesh ? flyTarget.mesh.position.clone() : flyTarget.pos;
            var camTarget = flyTarget.cam.clone();
            
            if(flyTarget.mesh){
                var offset = flyTarget.cam.clone().sub(flyTarget.pos);
                camTarget = targetPos.clone().add(offset);
            }
            
            camera.position.lerp(camTarget, flyProgress);
            controls.target.lerp(targetPos, flyProgress);
            
            if(flyProgress >= 1){
                flyTarget = null;
                flyProgress = 0;
            }
        }
        
        // 跟踪模式：相机跟随行星移动
        if(trackTarget && trackOffset && flyProgress === 0 && !flyTarget){
            var newTargetPos = trackTarget.position.clone();
            camera.position.copy(newTargetPos.clone().add(trackOffset));
            controls.target.copy(newTargetPos);
        }
        
        // 更新标签位置
        planets.forEach(function(p){
            if(p.label){
                var v=p.mesh.position.clone();v.y+=p.mesh.geometry.parameters.radius+0.5;
                v.project(camera);
                var x=(v.x*0.5+0.5)*window.innerWidth;
                var y=(-v.y*0.5+0.5)*window.innerHeight;
                if(v.z<1){p.label.style.display='block';p.label.style.left=x+'px';p.label.style.top=y+'px';p.label.style.transform='translate(-50%,-100%)';}
                else{p.label.style.display='none';}
            }
        });
        controls.update();
        renderer.render(scene, camera);
    }

    if (typeof window !== 'undefined' && typeof THREE !== 'undefined') { window.THREE = THREE; }
    init();
})();
