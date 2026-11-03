"""Run against the demo using Playwright + Chrome; requests are faulted only in this context."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', args=['--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width': 440, 'height': 800}, timezone_id='America/New_York',
                                  has_touch=True, is_mobile=True)
    page = context.new_page()
    page.set_default_timeout(30000)
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.on('console', lambda msg: errors.append(msg.text) if 'shader error' in msg.text.lower() else None)
    page.route('**/lib/astronomy-2.1.19.js', lambda route: route.abort(), times=1)
    for tier in ['preview', 'detail']:
        page.route(f'**/textures/{tier}/Moon.webp', lambda route: route.abort(), times=1)
    page.goto(sys.argv[1], wait_until='domcontentloaded')
    page.wait_for_function("document.querySelector('#loading-message').textContent.includes('程序未能加载')")
    page.locator('#retry-load').click()
    page.wait_for_function("document.querySelector('#texture-status').textContent.includes('基础颜色')")
    page.locator('#body-picker').select_option('Moon')
    page.wait_for_function("""import('/solar-system/js/state.js').then(({STATE}) =>
        STATE.moon.surface.retryAfter > 0 && !STATE.moon.mesh.material.map)""")
    assert '基础颜色' in page.locator('#texture-status').inner_text()
    page.locator('#retry-textures').click()
    page.wait_for_function("""import('/solar-system/js/state.js').then(({STATE}) => {
      const s = STATE.moon.surface; return s.preview && s.detail && s.mesh.material.map === s.detail;
    })""")
    session = context.new_cdp_session(page)
    def touch(kind, points):
        session.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [
            {'x': x, 'y': y, 'id': i} for i,x,y in points]})
    def blank_area():
        return page.evaluate("""() => {
            for(let y=100; y<innerHeight-100; y+=18) {
                for(let x=12; x<innerWidth-70; x+=26) {
                    if ([[x,y],[x+12,y+6],[x+48,y]].every(([a,b])=>
                        document.elementFromPoint(a,b)?.tagName==='CANVAS')) return [x,y];
                }
            }
            throw new Error('could not find a blank area of the canvas');
        }""")
    x,y = blank_area()
    touch('touchStart', [(1,x,y)])
    touch('touchMove', [(1,x+12,y+6)])
    touch('touchStart', [(1,x+12,y+6),(2,x+48,y)])
    touch('touchEnd', [(1,x+12,y+6)])
    touch('touchEnd', [])
    assert page.locator('#body-picker').input_value() == 'Moon'
    page.touchscreen.tap(*blank_area())
    assert page.locator('#info-panel').is_hidden()
    result = page.evaluate(Path(__file__).with_name('scene-checks.js').read_text())
    print(result, flush=True)
    assert not errors, errors
    browser.close()
