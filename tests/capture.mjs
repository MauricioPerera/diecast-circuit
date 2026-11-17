import { createRequire } from 'node:module';
import { readFileSync,writeFileSync,existsSync,renameSync } from 'node:fs';
import { inspectPage,summarize } from '../scripts/inspect-canvas.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright-core');
const manifest=JSON.parse(readFileSync('artifacts/evidence.json','utf8'));
const chrome=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
const browser=await chromium.launch(chrome&&existsSync(chrome)?{executablePath:chrome,headless:true}:{channel:'chromium',headless:true});
const url=process.env.GAME_URL||'http://127.0.0.1:5189/?qa=1';
try{
  for(const entry of manifest.captures){
    const mobile=entry.mode==='mobile';
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
    const page=await context.newPage();
    const report=await inspectPage(page,{url,mobile,state:entry.state,seed:42,runId:manifest.runId,screenshotPath:entry.report.replace('.json','.png')});
    writeFileSync(entry.report,JSON.stringify(report,null,2));console.log(summarize(report,entry.report));
    if(!report.result?.ok||report.consoleErrorCount||report.pageErrorCount)process.exitCode=1;
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:'artifacts/qa-final',size:{width:960,height:540}}});
  const page=await context.newPage();await page.goto(url);await page.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__?.frame>5);
  await page.locator('.start-button').click();await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(()=>window.__THREE_GAME_DIAGNOSTICS__.mode==='racing');
  const samples=[];
  for(let i=0;i<4;i++){await page.waitForTimeout(1500);await page.screenshot({path:`artifacts/qa-final/motion-${i}.png`});samples.push(await page.evaluate(()=>window.__THREE_GAME_DIAGNOSTICS__));}
  await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');await page.keyboard.press('Escape');
  const video=page.video();await context.close();renameSync(await video.path(),'artifacts/qa-final/loop-drive.webm');
  writeFileSync('artifacts/qa-final/motion-samples.json',JSON.stringify(samples,null,2));console.log('PASS unpaused keyboard-driven loop motion captured');
}finally{await browser.close();}
