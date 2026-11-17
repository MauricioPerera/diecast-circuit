import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,existsSync,mkdirSync,renameSync} from 'node:fs';
import assert from 'node:assert/strict';
import {inspectPage,summarize} from '../scripts/inspect-canvas.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright-core');
const manifest=JSON.parse(readFileSync('artifacts/builder-evidence.json','utf8'));
const chrome=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
const browser=await chromium.launch(chrome&&existsSync(chrome)?{executablePath:chrome,headless:true}:{channel:'chromium',headless:true});
mkdirSync('artifacts/builder-qa',{recursive:true});
try{for(const entry of manifest.captures){
  const mobile=entry.mode==='mobile';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
  const report=await inspectPage(await context.newPage(),{url:process.env.GAME_URL||'http://127.0.0.1:5189/?qa=1',state:'builder',mobile,seed:42,runId:manifest.runId,screenshotPath:entry.report.replace('.json','.png')});
  writeFileSync(entry.report,JSON.stringify(report,null,2));console.log(summarize(report,entry.report));
  if(!report.result?.ok||report.consoleErrorCount||report.pageErrorCount)process.exitCode=1;
  await context.close();
}
  // Final real-input motion also checks the drafting floor -> warehouse ->
  // drafting floor transition after the visual refinement.
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:'artifacts/builder-qa',size:{width:960,height:600}}});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:5189/?qa=1');await page.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__?.mode==='menu');
  await page.locator('.builder-entry').click();await page.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__?.mode==='builder');
  await page.setViewportSize({width:768,height:1024});await page.waitForTimeout(200);await page.screenshot({path:'artifacts/builder-qa/resized-workshop.png'});
  await page.setViewportSize({width:1440,height:900});await page.locator('[data-editor-action=new]').click();
  for(const piece of ['loop','right','right'])await page.locator(`[data-editor-action=add][data-piece=${piece}]`).click();
  await page.locator('[data-editor-action=close]').click();await page.locator('.builder-play').click();await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__?.mode==='racing');const samples=[];
  for(let i=0;i<3;i++){await page.waitForTimeout(1300);samples.push(await page.evaluate(()=>window.__THREE_GAME_DIAGNOSTICS__));await page.screenshot({path:`artifacts/builder-qa/custom-motion-${i}.png`});}
  assert.ok(samples[2].distance>samples[0].distance+30);assert.ok(samples[1].renderer.calls>60);assert.deepEqual(errors,[]);
  await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');await page.keyboard.press('Escape');await page.getByRole('button',{name:/VOLVER AL TALLER/}).click();
  await page.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__?.mode==='builder');await page.waitForTimeout(100);
  const returned=await page.evaluate(()=>window.__THREE_GAME_DIAGNOSTICS__);assert.ok(returned.renderer.calls<60);
  writeFileSync('artifacts/builder-qa/motion-samples.json',JSON.stringify({samples,returned,errors},null,2));
  const video=page.video();await context.close();renameSync(await video.path(),'artifacts/builder-qa/builder-driving.webm');console.log('PASS final resize, custom drive and warehouse/workshop transition');
}finally{await browser.close();}
