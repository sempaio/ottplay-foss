const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
const url='file:///'+path.resolve(__dirname,'../app/index.html').replace(/\\/g,'/');
async function setup(browser, bufferMethods=true){
 const page=await browser.newPage();
 await page.addInitScript((enable)=>{
  const stub={
   events:[],listeners:[],pending:[],playCalls:0,
   open(u){this.events.push(['open','stream']);},
   setDisplayRect(){this.events.push(['display']);},
   setListener(l){this.listeners.push(l);},
   prepareAsync(ok){this.pending.push(ok);},
   play(){this.playCalls++;},
   stop(){this.events.push(['stop']);},close(){this.events.push(['close']);}
  };
  if(enable){
   stub.setBufferingParam=function(a,b,c){this.events.push(['buffer',a,b,c]);};
   stub.setTimeoutForBuffering=function(s){this.events.push(['timeout',s]);};
  }
  window.webapis={avplay:stub};window.__testAV=stub;
 }, bufferMethods);
 await page.route('**/player_api.php?*',async r=>{
  const a=new URL(r.request().url()).searchParams.get('action');
  const data=a==='get_live_categories'?[{category_id:'1',category_name:'Abertos'}]:
             a==='get_live_streams'?[{name:'TV Brasil (720p)',stream_id:730,category_id:'1',container_extension:'m3u8'}, {name:'Rede TV FHD',stream_id:888,category_id:'1',container_extension:'m3u8'}]:
             {user_info:{auth:1,status:'Active'}};
  await r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
 });
 await page.goto(url);
 await page.locator('#username').fill('demo');
 await page.locator('#password').fill('test');
 await page.locator('#login-button').click();
 await page.locator('#player-screen').waitFor({state:'visible',timeout:10000});
 return page;
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 let passed=0,failed=0;
 async function test(label,fn,enable){
  const p=await setup(browser,enable!==false);
  try{await fn(p);passed++;console.log('PASS',label);}
  catch(e){failed++;console.error('FAIL',label,e.message);}
  finally{await p.close();}
 }
 await test('Samsung AVPlay explicit initial and resume buffer settings',async p=>{
  const calls=await p.evaluate(()=>window.__testAV.events);
  assert(calls.some(x=>x[0]==='buffer'&&x[1]==='PLAYER_BUFFER_FOR_PLAY'&&x[2]==='PLAYER_BUFFER_SIZE_IN_SECOND'&&x[3]>=4));
  assert(calls.some(x=>x[0]==='buffer'&&x[1]==='PLAYER_BUFFER_FOR_RESUME'&&x[3]>=4));
  assert(calls.findIndex(x=>x[0]==='open')<calls.findIndex(x=>x[0]==='buffer'));
 });
 await test('Unsupported AVPlay buffering methods remain nonfatal',async p=>{
  const pending=await p.evaluate(()=>window.__testAV.pending.length);
  assert.equal(pending,1);
 },false);
 await test('Tizen D-pad right selects channel and down selects next channel',async p=>{
  await p.locator('#back-button').click();
  const initial=await p.evaluate(()=>document.activeElement.className);
  assert(initial.includes('category'),'focus should return to category on back: '+initial);
  await p.keyboard.press('ArrowRight');
  assert((await p.evaluate(()=>document.activeElement.className)).includes('channel'),'right should focus channels');
  await p.keyboard.press('ArrowDown');
  assert.equal(await p.evaluate(()=>document.activeElement.textContent.trim()),'Rede TV FHD');
  await p.keyboard.press('Enter');
  assert.equal((await p.locator('#now-playing').innerText()).includes('Rede TV FHD'),true);
 });
 await test('Samsung Return key 10009 returns from player to list',async p=>{
  await p.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,keyCode:10009,which:10009})));
  assert.equal(await p.locator('#catalog-screen').isVisible(),true);
 });
 await test('Playback buffer events counted but stale events ignored',async p=>{
  await p.evaluate(()=>{
   const l=window.__testAV.listeners[0];
   l.onbufferingstart();
   l.onbufferingcomplete();
   l.oncurrentplaytime(1000);
  });
  const s=await p.evaluate(()=>window.__starlinkLiteQA.snapshot());
  assert.equal(s.bufferStarts,1,'buffer start should be observable');
  await p.locator('#back-button').click();
  await p.evaluate(()=>window.__testAV.listeners[0].onbufferingstart());
  const s2=await p.evaluate(()=>window.__starlinkLiteQA.snapshot());
  assert.equal(s2.bufferStarts,1,'old events must be ignored');
 });
 await test('Escape key emulated Back exits player',async p=>{
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('#catalog-screen').isVisible(),true);
 });
 await browser.close();
 console.log('QA030_UI_BUFFER',passed,'/',passed+failed,'passed');
 if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
