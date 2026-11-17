import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright-core');
const base=process.env.GAME_URL||'http://127.0.0.1:5189/';
const out='artifacts/qa-final';mkdirSync(out,{recursive:true});
const tail=process.env.QA_TAIL==='1';
const report=tail?JSON.parse(readFileSync(`${out}/playtest.json`,'utf8')):{url:base,started:new Date().toISOString(),checks:[],errors:[],laps:[],screenshots:[]};
delete report.failure;
const chrome=process.env.CHROME_PATH || (process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
const browser=await chromium.launch(chrome&&existsSync(chrome)?{executablePath:chrome,headless:true}:{channel:'chromium',headless:true});
const check=(name,data)=>{report.checks.push({name,pass:true,...data});console.log(`PASS ${name}`);};
const inspect=page=>page.evaluate(()=>window.__THREE_GAME_DIAGNOSTICS__);
async function capture(page,name){const path=`${out}/${name}.png`;await page.screenshot({path});report.screenshots.push(path);}
function watch(page){page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('requestfailed',r=>report.errors.push(`${r.url()}: ${r.failure()?.errorText}`));}
try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();watch(page);await page.goto(`${base}?qa=1`);await page.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__?.frame>10);await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('[data-course]').count(),5);assert.equal(await page.locator('[data-assist]').count(),3);
  await capture(page,'desktop-menu');check('five courses and three assist controls');
  // Native keyboard button activation must select a course, not start the race.
  await page.locator('[data-course=garage]').focus();await page.keyboard.press('Enter');await page.waitForTimeout(100);
  assert.equal((await inspect(page)).course,'garage');assert.equal((await inspect(page)).mode,'menu');check('keyboard menu selection');
  if(!tail){
  for(const id of ['garage','district','heights','helix','skyline']){
    await page.locator(`[data-course=${id}]`).click();
    const before=await inspect(page);
    await page.locator('.start-button').click();await page.keyboard.down('KeyW');
    if(id==='district')await page.keyboard.down('ShiftLeft');
    await page.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__?.mode==='racing');
    if(id==='district'){
      await page.waitForTimeout(1200);const moving=await inspect(page);assert.ok(moving.speed>15&&moving.nitro<1);
      await capture(page,'desktop-active-play');
      await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__.mode==='paused');
      const p=await inspect(page);await page.waitForTimeout(350);const q=await inspect(page);assert.equal(p.distance,q.distance);assert.equal(p.elapsed,q.elapsed);
      await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__.mode==='racing');
      await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');check('real throttle and nitro; pause freezes timer and movement');
    }
    await page.waitForFunction(()=>['finished','crashed'].includes(window.__THREE_GAME_DIAGNOSTICS__?.mode),{},{timeout:40000});
    await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');
    const d=await inspect(page);assert.equal(d.mode,'finished',id);assert.ok(d.distance>before.distance+250);assert.equal(d.score,1);
    report.laps.push({course:id,time:d.elapsed,metrics:d.renderer,frames:d.frame});check(`real input completed ${id}`,{seconds:d.elapsed});
    if(id==='district')await capture(page,'desktop-finished');
    await page.getByRole('button',{name:/ELEGIR CIRCUITO/}).click();
  }
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('diecast-circuit.records.v1')));assert.equal(Object.keys(saved).length,5);
  await page.reload();await page.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__?.frame>10);
  assert.ok((await page.locator('[data-course=district] .course-record').textContent()).includes(':'));assert.notEqual(await page.locator('[data-course=district] .course-record').textContent(),'—:——.———');
  await page.locator('[data-assist=manual]').click();assert.equal(await page.locator('[data-course=district] .course-record').textContent(),'—:——.———');check('records persist after reload and are separated by assist');
  }else await page.locator('[data-assist=manual]').click();
  await page.locator('.start-button').click();await page.keyboard.down('KeyW');await page.keyboard.down('KeyD');
  await page.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__?.mode==='crashed',{},{timeout:12000});await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');
  await page.waitForSelector('.race-modal-layer:not([hidden])');assert.match(await page.locator('.modal-description').textContent(),/dirección|borde/);await capture(page,'desktop-crashed');
  await page.keyboard.press('KeyR');await page.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__?.mode==='countdown');const reset=await inspect(page);assert.equal(reset.speed,0);assert.equal(reset.nitro,1);assert.equal(reset.elapsed,0);check('manual edge failure and keyboard retry');
  await page.keyboard.press('Escape');await page.getByRole('button',{name:/ELEGIR CIRCUITO/}).click();
  for(const [width,height]of [[1280,720],[1024,768]]){
    await page.setViewportSize({width,height});await capture(page,`menu-${width}`);
    const bounds=await page.locator('.start-button').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1);check(`menu fits ${width}x${height}`);
  }
  const mobile=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});const phone=await mobile.newPage();watch(phone);
  await phone.goto(`${base}?qa=1`);await phone.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__?.frame>10);await capture(phone,'mobile-menu');
  const start=phone.locator('.start-button');await start.scrollIntoViewIfNeeded();await capture(phone,'mobile-menu-start');await start.tap();
  const gas=phone.locator('[data-touch=throttle]'),boost=phone.locator('[data-touch=nitro]');
  // Trusted browser pointer input; hold gas across the countdown-to-racing transition.
  const pedal=await gas.boundingBox();await phone.mouse.move(pedal.x+pedal.width/2,pedal.y+pedal.height/2);await phone.mouse.down();
  await phone.waitForTimeout(4500);const mobileDrive=await inspect(phone);assert.equal(mobileDrive.mode,'racing');assert.ok(mobileDrive.speed>12);await capture(phone,'mobile-active-play');
  await phone.mouse.up();await phone.waitForTimeout(100);const releaseDistance=(await inspect(phone)).distance;
  await phone.getByRole('button',{name:'Pausar carrera'}).tap();await phone.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__.mode==='paused');await capture(phone,'mobile-paused');
  check('mobile gas holds across countdown, releases, and pause opens',{speed:mobileDrive.speed,distance:releaseDistance});
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('#game canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER);});report.gpu=gpu;
  await mobile.close();await context.close();assert.deepEqual(report.errors,[]);check('no JavaScript, console or network errors');
  report.pass=true;
}catch(error){report.pass=false;report.failure=error.stack;console.error(error);process.exitCode=1;}
finally{await browser.close();report.finished=new Date().toISOString();writeFileSync(`${out}/playtest.json`,JSON.stringify(report,null,2));}
