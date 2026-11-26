// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const scaled = process.argv.includes('--scale=1.5');
const root = process.cwd(),
  parent = path.join(root, '.runtime/control-overlay-verification');
mkdirSync(parent, { recursive: true });
const folder = mkdtempSync(path.join(parent, 'run-'));
const reportFile = path.join(folder, 'report.json');
const entry = path.join(folder, 'main.mjs');
writeFileSync(
  entry,
  `import {app,BrowserWindow,screen} from 'electron';
import {writeFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {ControlOverlay} from ${JSON.stringify(pathToFileURL(path.join(root, 'apps/desktop/main/control-overlay.mjs')).href)};
app.whenReady().then(async()=>{
const owner=new BrowserWindow({show:false,width:200,height:120});
const overlay=new ControlOverlay({BrowserWindow,screen,owner,url:${JSON.stringify(pathToFileURL(path.join(root, 'apps/desktop/renderer/control-overlay.html')).href)}});
try {await overlay.show('CAPRI // CONTROL VERIFICATION');
const windows=await Promise.all([...overlay.displayWindows].map(async ([id,w])=>({
  id,bounds:w.getBounds(),visible:w.isVisible(),fullscreen:w.isFullScreen(),
  focusable:w.isFocusable(),topmost:w.isAlwaysOnTop(),
  viewport:await w.webContents.executeJavaScript('({width:innerWidth,height:innerHeight})')
})));
const displays=screen.getAllDisplays().map(d=>({id:d.id,bounds:d.bounds,workArea:d.workArea,scaleFactor:d.scaleFactor}));
const effects=[];
for(const theme of ['capri','blackwall']){
overlay.configure({enabled:true,intensity:75,theme,cursor:true,pointerDuration:260});
await overlay.windows[0].webContents.executeJavaScript('capriControl.pointer({x:innerWidth*0.62,y:innerHeight*0.56});capriControl.pulse("click")');
await new Promise(resolve=>setTimeout(resolve,180));
for(const [index,window] of overlay.windows.entries()) {
const png=await window.webContents.capturePage();
const size=png.getSize(),bitmap=png.toBitmap();
const alpha=(x,y)=>bitmap[(y*size.width+x)*4+3];
const middleX=Math.floor(size.width/2),middleY=Math.floor(size.height/2);
if(alpha(middleX,middleY)!==0)throw Error('Effects obscured the center of the display.');
if(!alpha(middleX,size.height-2)||!alpha(Math.floor(middleX/2),1)||
   !alpha(1,middleY)||!alpha(size.width-2,middleY))throw Error('An edge of the display frame was not drawn.');
const file=index===0?${JSON.stringify(folder)}+'/'+theme+'.png':null;
if(file)writeFileSync(file,png.toPNG());
effects.push({theme,display:windows[index].id,file,centerTransparent:true});}}
writeFileSync(${JSON.stringify(reportFile)},JSON.stringify({passed:true,windows,displays,effects}));
}catch(error){writeFileSync(${JSON.stringify(reportFile)},JSON.stringify({passed:false,error:error.message}));process.exitCode=1;}
finally{overlay.hide();owner.destroy();app.quit();}});`,
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const args = scaled ? ['--force-device-scale-factor=1.5', entry] : [entry];
const child = spawn(createRequire(import.meta.url)('electron'), args, {
  env,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.on('data', (value) => {
  stderr = (stderr + value).slice(-4000);
});
child.stdout.resume();
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    child.kill();
    reject(Error('Overlay verification timed out.'));
  }, 30000);
  child.on('error', (e) => {
    clearTimeout(timer);
    reject(e);
  });
  child.on('exit', () => {
    clearTimeout(timer);
    resolve();
  });
});
const report = JSON.parse(readFileSync(reportFile, 'utf8'));
assert(report.passed, report.error ?? stderr);
assert.equal(report.windows.length, report.displays.length);
if (scaled) assert(report.displays.some(({ scaleFactor }) => scaleFactor === 1.5));
const edges = ({ x, y, width, height }) => [x, y, x + width, y + height];
report.windows.forEach((w) => {
  const display = report.displays.find((entry) => entry.id === w.id);
  assert.ok(display);
  const expected = edges(display.bounds);
  const tolerance = Number.isInteger(display.scaleFactor) ? 0 : 1;
  assert.ok(edges(w.bounds).every((edge, index) => Math.abs(edge - expected[index]) <= tolerance));
  assert.deepEqual(w.viewport, { width: w.bounds.width, height: w.bounds.height });
  assert(w.visible);
  assert(w.topmost);
  assert.equal(w.fullscreen, false);
  assert.equal(w.focusable, false);
});
console.log(JSON.stringify({ ...report, folder }));
