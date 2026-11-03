"""Run against a deployed instance with Python Playwright and Chrome."""
import argparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('url')
parser.add_argument('--mobile', action='store_true')
parser.add_argument('--zone', default='Asia/Shanghai')
parser.add_argument('--faults', action='store_true')
parser.add_argument('--slow', action='store_true')
args = parser.parse_args()
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel='chrome', args=['--enable-unsafe-swiftshader'])
    context = browser.new_context(timezone_id=args.zone, is_mobile=args.mobile, has_touch=args.mobile,
                                 viewport={'width': 390 if args.mobile else 960, 'height': 780})
    page = context.new_page()
    errors, urls = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: urls.append(request.url))
    page.set_default_timeout(30000)
    if args.slow:
        cdp = context.new_cdp_session(page)
        cdp.send('Network.enable')
        cdp.send('Network.emulateNetworkConditions', {
            'offline': False, 'latency': 140, 'downloadThroughput': 180000, 'uploadThroughput': 90000})
    if args.faults:
        page.route('**/api/planets.php', lambda route: route.fulfill(status=503, body='{}'), times=1)
        page.route('**/textures/detail/Moon.webp', lambda route: route.abort())
    page.goto(args.url, wait_until='domcontentloaded', timeout=70000)
    if args.faults:
        page.locator('#retry-load').click()

    page.wait_for_function("document.querySelector('#texture-status').textContent==='场景就绪'", timeout=65000)
    initial = {url for url in urls if '/textures/' in url}
    size = page.evaluate("""performance.getEntriesByType('resource').filter(e=>e.name.includes('/textures/'))
                            .reduce((sum,e)=>sum+e.decodedBodySize,0)""")
    assert len(initial) == 10 and all('/preview/' in u for u in initial)
    assert 0 < size < 5_000_000

    def click(selector):
        el = page.locator(selector)
        el.tap() if args.mobile else el.click()

    click('#pause-btn')
    assert page.evaluate("""() => {
        const boxes = [...document.querySelectorAll('.planet-label:not([hidden])')].map(e=>e.getBoundingClientRect());
        return boxes.length > 0 && boxes.every((a,i) => boxes.slice(i+1).every(b =>
            a.right<=b.left || a.left>=b.right || a.bottom<=b.top || a.top>=b.bottom));
    }""")
    before = page.locator('#sim-time').inner_text()
    click('#adjust-btn')
    click('#apply-time')
    assert page.locator('#sim-time').inner_text() == before
    click('#adjust-btn')
    page.locator('#day-input').fill('')
    click('#apply-time')
    assert page.locator('#time-error').inner_text() and page.locator('#sim-time').inner_text() == before
    for name, value in zip(('year', 'month', 'day', 'hour', 'minute', 'second'), ('2024','2','29','10','20','30')):
        page.locator('#'+name+'-input').fill(value)
    page.locator('#hour-input').press('ArrowRight')
    assert page.locator('#speed-slider').input_value() == '0'
    click('#apply-time')
    assert page.locator('#sim-date').inner_text() == '2024-02-29'
    assert page.locator('#sim-time').inner_text() == '10:20:30'

    picker = page.locator('#body-picker')
    picker.select_option('Moon')
    assert '1737.4' in page.locator('#planet-info').inner_text().replace(',', '')
    if args.faults:
        page.wait_for_function("document.querySelector('#texture-status').textContent.includes('已保留预览')")
        assert page.evaluate("""import('/solar-system/js/state.js').then(({STATE})=>
            STATE.moon.mesh.material.map===STATE.moon.surface.preview && !!STATE.moon.surface.preview)""")
    else:
        page.wait_for_function("performance.getEntriesByType('resource').some(e=>e.name.includes('/detail/Moon.webp'))")
    picker.select_option('Earth')
    assert 'AU' in page.locator('#current-distance').inner_text()
    picker.select_option('Sun')
    assert page.evaluate("import('/solar-system/js/state.js').then(({STATE})=>STATE.trackTarget===STATE.sunMesh)")
    point = page.evaluate("""() => {for(let y=innerHeight*.45;y<innerHeight*.78;y+=15)
        for(let x=10;x<innerWidth-10;x+=25) if(document.elementFromPoint(x,y)?.tagName==='CANVAS')return {x,y}}""")
    if args.mobile:
        page.touchscreen.tap(point['x'],point['y'])
    else:
        page.mouse.click(point['x'],point['y'])
    assert page.locator('#info-panel').is_hidden()
    picker.select_option('Pluto')
    click('#overview')
    assert page.locator('#info-panel').is_hidden()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors, errors
    print(f'PASS {args.zone}, mobile={args.mobile}, faults={args.faults}, throttled={args.slow}, preview bytes={size}')
    browser.close()
