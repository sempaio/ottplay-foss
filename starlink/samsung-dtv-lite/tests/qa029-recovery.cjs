const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const url = 'file:///' + path.resolve(__dirname, '../app/index.html').replace(/\\/g,'/');
async function setup(browser) {
 const page = await browser.newPage();
 await page.addInitScript(() => {
  const p = {
   opened:[],playCalls:0,stopCalls:0,closeCalls:0,listeners:[],pending:[],
   open(url){this.opened.push(url);},
   setDisplayRect(){},
   setListener(listener){this.listeners.push(listener);},
   prepareAsync(ok){this.pending.push(ok);},
   play(){this.playCalls++;},
   stop(){this.stopCalls++;},
   close(){this.closeCalls++;}
  };
  window.webapis={avplay:p};
  window.__testAV=p;
 });
 await page.route('**/player_api.php?*', async route => {
  const act = new URL(route.request().url()).searchParams.get('action');
  const data = act==='get_live_categories'
    ? [{category_id:'1',category_name:'Abertos'}]
    : act==='get_live_streams'
      ? [{name:'TV Brasil (720p)',stream_id:730,container_extension:'m3u8',category_id:'1'},{name:'Rede TV FHD',stream_id:888,container_extension:'m3u8',category_id:'1'}]
      : {user_info:{auth:1,status:'Active'}};
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 });
 await page.goto(url);
 await page.locator('#username').fill('demo_user');
 await page.locator('#password').fill('demo_password');
 await page.locator('#login-button').click();
 await page.locator('#player-screen').waitFor({state:'visible',timeout:15000});
 return page;
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const failed=[];
 async function check(name,fn){
  const page=await setup(browser);
  try{await fn(page);console.log('PASS',name);}
  catch(err){failed.push(name);console.error('FAIL',name,err.message);}
  finally{await page.close();}
 }
 await check('cancel pending prepareAsync on back',async p=>{
  await p.locator('#back-button').click();
  await p.evaluate(()=>window.__testAV.pending[0]());
  const calls=await p.evaluate(()=>window.__testAV.playCalls);
  assert.equal(calls,0,'background video started after returning to catalog');
 });
 await check('cancel stale stream callback after back',async p=>{
  await p.locator('#back-button').click();
  await p.evaluate(()=>window.__testAV.listeners[0].oncurrentplaytime(54321));
  const ev=await p.evaluate(()=>window.__starlinkLiteQA.snapshot().events);
  assert.equal(ev,0,'stale media event changed playback state');
 });
 await check('ignore old stream errors after switching channels',async p=>{
  await p.locator('#back-button').click();
  await p.locator('.channel').nth(1).click();
  await p.evaluate(()=>window.__testAV.listeners[0].onerror('OLD_STREAM_ERROR'));
  const status=await p.locator('#video-status').innerText();
  assert.equal(status.includes('OLD_STREAM_ERROR'),false,'old stream error overwrote current channel');
 });
 await check('Samsung TV Remote Back keyCode 10009 returns to catalog',async p=>{
  await p.evaluate(()=>{
   document.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,keyCode:10009,which:10009}));
  });
  assert.equal(await p.locator('#catalog-screen').isVisible(),true,'Samsung Remote Back ignored');
 });
 await check('no late video playback after logout',async p=>{
  await p.locator('#back-button').click();
  await p.locator('#exit-button').click();
  await p.evaluate(()=>window.__testAV.pending[0]());
  const s=await p.evaluate(()=>({logged:window.__starlinkLiteQA.snapshot().logged,playCalls:window.__testAV.playCalls}));
  assert.deepEqual(s,{logged:false,playCalls:0});
 });
 await browser.close();
 console.log('QA029_RECOVERY',5-failed.length,'/5 passed');
 if(failed.length) process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
