// Browser-side probe. Use the actual scene, transforms, and lunar material.
async () => {
    const {STATE: scene} = await import('/solar-system/js/state.js');
    const {updateSimulation} = await import('/solar-system/js/time.js');
    const T = await import('three');
    const check = (ok, message) => { if (!ok) throw new Error(message); };
    const waitFrame = () => new Promise(requestAnimationFrame);
    const byId = id => document.getElementById(id);
    const fields = ['year','month','day','hour','minute','second'];
    const seek = async iso => {
        const date = new Date(iso);
        byId('adjust-btn').click();
        const parts = [date.getFullYear(),date.getMonth()+1,date.getDate(),date.getHours(),date.getMinutes(),date.getSeconds()];
        parts.forEach((value,i) => byId(fields[i]+'-input').value = value);
        byId('apply-time').click();
        await waitFrame();
        await waitFrame();
    };

    if (!scene.paused) byId('pause-btn').click();
    const earth = scene.earthPlanet;
    function greenwichElevation() {
        earth.pivot.updateMatrixWorld(true);
        const surface = new T.Vector3(1,0,0).transformDirection(earth.mesh.matrixWorld);
        return 90 - T.MathUtils.radToDeg(surface.angleTo(earth.surface.sunDirection));
    }
    await seek('2000-01-01T12:00:00Z');
    const noon = greenwichElevation();
    await seek('2000-01-02T00:00:00Z');
    const midnight = greenwichElevation();
    check(Math.abs(noon - 67) < 1 && Math.abs(midnight + 67) < 1, 'Greenwich equator solar elevation');

    const snapshot = () => ({
        sun: scene.sunMesh.quaternion.toArray(),
        belt: Array.from(scene.asteroidBelt.geometry.attributes.position.array.slice(0,12)),
        earth: earth.pivot.position.toArray(),
        moon: scene.moon.pivot.position.toArray(),
        orbit: Array.from(scene.orbitLines[0].geometry.attributes.position.array.slice(0,6)),
    });
    await seek('2026-11-03T04:00:00Z');
    const start = snapshot();
    await seek('2026-11-16T04:00:00Z');
    const jumped = snapshot();
    for (const key of ['sun','belt','earth','moon']) {
        check(JSON.stringify(start[key]) !== JSON.stringify(jumped[key]), 'paused seek did not move '+key);
    }
    // Advance the actual animation clock to the same time from the preceding day.
    await seek('2026-11-15T04:00:00Z');
    scene.speedMultiplier = 86400;
    const target = Date.parse('2026-11-16T04:00:00Z');
    scene.paused = false;
    while (scene.simTime < target) await waitFrame();
    scene.paused = true;
    const overshoot = scene.simTime;
    await waitFrame();
    const played = snapshot();
    await seek('2025-03-01T00:00:00Z');
    scene.simTime = overshoot;
    updateSimulation(overshoot);
    check(JSON.stringify(snapshot()) === JSON.stringify(played), 'playback and seek disagree');
    await seek('2026-11-16T04:00:00Z');
    check(JSON.stringify(snapshot()) === JSON.stringify(jumped), 'returning to the same time changed the scene');

    // Render the real Moon into a transparent target, viewed from Earth's
    // direction. Isolate direct sunlight and use a white test surface so the
    // lit fraction can be measured independently of its albedo map.
    await seek('2000-01-14T13:34:00Z');
    const moon = scene.moon;
    const renderer = scene.renderer;
    const camera = new T.OrthographicCamera(-0.38,0.38,0.38,-0.38,0.1,20);
    camera.layers.set(5);
    const towardsEarth = earth.pivot.position.clone().sub(moon.pivot.position).normalize();
    camera.position.copy(moon.pivot.position).addScaledVector(towardsEarth, 6);
    camera.lookAt(moon.pivot.position);
    const light = scene.scene.children.find(x => x.isPointLight);
    const material = moon.mesh.material;
    moon.mesh.layers.enable(5);
    light.layers.enable(5);
    const map = material.map;
    material.map = null;
    material.color.set(0xffffff);
    material.needsUpdate = true;
    const size = 256;
    const targetImage = new T.WebGLRenderTarget(size,size);
    const previousColor = renderer.getClearColor(new T.Color());
    const previousAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(targetImage);
    renderer.setClearColor(0,0);
    renderer.render(scene.scene,camera);
    const rgba = new Uint8Array(size*size*4);
    renderer.readRenderTargetPixels(targetImage,0,0,size,size,rgba);
    renderer.setRenderTarget(null);
    renderer.setClearColor(previousColor,previousAlpha);
    targetImage.dispose();
    material.map = map;
    material.needsUpdate = true;
    moon.mesh.layers.disable(5);
    light.layers.disable(5);
    let disk = 0, lit = 0;
    for (let i=0; i<rgba.length; i+=4) {
        if (rgba[i+3] < 128) continue;
        disk++;
        if (rgba[i]>2) lit++;
    }
    check(disk > 30000 && Math.abs(lit/disk - 0.5012) < 0.012, 'lunar terminator: '+lit+'/'+disk);

    // Initialize to the *second* occurrence and open the actual time editor.
    scene.simTime = Date.parse('2026-11-01T06:30:00Z');
    byId('adjust-btn').click();
    check(!byId('time-fold').hidden && byId('time-offset').value === '300', 'fold choice');
    byId('apply-time').click();
    check(scene.simTime === Date.parse('2026-11-01T06:30:00Z'), 'fold round trip');
    byId('adjust-btn').click();
    byId('time-offset').value = '240';
    byId('time-offset').dispatchEvent(new Event('change'));
    byId('apply-time').click();
    check(scene.simTime === Date.parse('2026-11-01T05:30:00Z'), 'first fold choice');
    return {greenwichNoon:noon, greenwichMidnight:midnight, lunarLitFraction:lit/disk};
}
