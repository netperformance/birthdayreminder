// Erzeugt die App-Icons aus SVG. Aufruf: node scripts/icons.cjs (braucht Playwright, nur bei Änderungen am Icon nötig)
const { chromium } = require('playwright')
const path = require('path')
const out = (f) => path.resolve(__dirname, '..', 'assets', f)
// Torte mit Kerze: weiße Form, Zuckerguss-Linie in dunklerem Rosa, Flamme in Gelb.
const cake = (fg, line, flame) => `
  <path d="M256 70c21 25 27 40 27 51a27 27 0 0 1-54 0c0-11 6-26 27-51z" fill="${flame}"/>
  <rect x="236" y="164" width="40" height="76" rx="15" fill="${fg}"/>
  <rect x="128" y="240" width="256" height="170" rx="40" fill="${fg}"/>
  <clipPath id="c"><rect x="128" y="240" width="256" height="170" rx="40"/></clipPath>
  <path clip-path="url(#c)" d="M110 304c21 0 21 26 43 26s21-26 42-26 21 26 43 26 21-26 42-26 21 26 43 26 21-26 43-26 21 26 43 26" stroke="${line}" stroke-width="26" fill="none" stroke-linecap="round"/>`
const grad = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4709f"/><stop offset="1" stop-color="#d2356f"/></linearGradient></defs>`
const mono = `<path d="M256 70c21 25 27 40 27 51a27 27 0 0 1-54 0c0-11 6-26 27-51z" fill="#fff"/><rect x="236" y="164" width="40" height="76" rx="15" fill="#fff"/><rect x="128" y="240" width="256" height="170" rx="40" fill="#fff"/>`
const svgs = {
  'icon.png': [1024, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${grad}<rect width="512" height="512" fill="url(#g)"/><g transform="translate(256 256) scale(0.8) translate(-256 -240)">${cake('#fff', '#c42d66', '#ffc94a')}</g></svg>`],
  // Android: Vordergrund im sicheren Bereich (ca. 66 %), Hintergrund separat
  'android-icon-foreground.png': [1024, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(256 256) scale(0.6) translate(-256 -240)">${cake('#fff', '#c42d66', '#ffc94a')}</g></svg>`],
  'android-icon-background.png': [1024, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${grad}<rect width="512" height="512" fill="url(#g)"/></svg>`],
  'android-icon-monochrome.png': [1024, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(256 256) scale(0.6) translate(-256 -240)">${mono}</g></svg>`],
  'splash-icon.png': [512, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${grad}<rect width="512" height="512" rx="112" fill="url(#g)"/><g transform="translate(256 256) scale(0.8) translate(-256 -240)">${cake('#fff', '#c42d66', '#ffc94a')}</g></svg>`],
  'favicon.png': [48, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${grad}<rect width="512" height="512" rx="112" fill="url(#g)"/>${cake('#fff', '#c42d66', '#ffc94a')}</svg>`],
}
;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  for (const [file, [size, svg]] of Object.entries(svgs)) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<style>html,body{margin:0;background:transparent}</style><img width="${size}" height="${size}" style="display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`)
    await page.screenshot({ path: out(file), omitBackground: true })
  }
  await browser.close()
})()
