import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {inspectPage,summarize} from '../scripts/inspect-canvas.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright-core');
const manifest=JSON.parse(readFileSync('artifacts/garage-evidence.json','utf8'));
const chrome=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined);
const browser=await chromium.launch(chrome&&existsSync(chrome)?{executablePath:chrome,headless:true}:{channel:'chromium',headless:true});
mkdirSync('artifacts/garage-qa',{recursive:true});
const url=new URL(process.env.GAME_URL||'http://127.0.0.1:5189/');url.searchParams.set('qa','1');
try{for(const entry of manifest.captures){
  const mobile=entry.mode==='mobile';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
  const report=await inspectPage(await context.newPage(),{url:url.href,state:'garage',mobile,seed:42,runId:manifest.runId,screenshotPath:entry.report.replace('.json','.png')});
  writeFileSync(entry.report,JSON.stringify(report,null,2));console.log(summarize(report,entry.report));
  if(!report.result?.ok||!report.result?.renderBudget?.withinBudget||report.consoleErrorCount||report.pageErrorCount)process.exitCode=1;
  await context.close();
}}finally{await browser.close();}
