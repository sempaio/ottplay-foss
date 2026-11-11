const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
const url='file:///'+path.resolve(__dirname,'../app/index.html').replace(/\\/g,'/');
async function setup(browser,clock=false) {
  const page=await browser.newPage();
  if(clock) await page.clock.install();
  await page.addInitScript(()=>{
    const p={opened:[],listeners:[],pending:[],playCalls:0,
      open(url){this.opened.push(url);},setDisplayRect(){},
      setBufferingParam(){},setTimeoutForBuffering(){},
      setListener(l){this.listeners.push(l);},
      prepareAsync(ok){this.pending.push(ok);},
      play(){this.playCalls++;},stop(){},close(){}};
    window.webapis={avplay:p};window.__testAV=p;
  });
  await page.route('**/player_api.php?*',async route=>{
    const act=new URL(route.request().url()).searchParams.get('action');
    const data=act==='get_live_categories'?[{category_id:'1',category_name:'Abertos'}]:
      act==='get_live_streams'?[{name:'TV Brasil (720p)',stream_id:730,category_id:'1',container_extension:'m3u8'}]:
      {user_info:{auth:1,status:'Active'}};
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
  });
  await page.goto(url);
  await page.locator('#username').fill('qa_dummy_user');
  await page.locator('#password').fill('qa_dummy_password');
  await page.locator('#login-button').click();
  await page.locator('#player-screen').waitFor({state:'visible',timeout:10000});
  return page;
}
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  let passed=0;
  async function check(name,fn,clock=false){
    const page=await setup(browser,clock);
    try{await fn(page);console.log('PASS',name);passed++;}
    finally{await page.close();}
  }
  await check('remembered login survives app reload',async p=>{
    assert.equal(await p.evaluate(()=>!!localStorage.getItem('starlink-dtv-qa032-remembered-account')),true);
    await p.reload();
    await p.locator('#player-screen').waitFor({state:'visible',timeout:10000});
    assert.equal(await p.evaluate(()=>window.__starlinkLiteQA.snapshot().logged),true);
  });
  await check('explicit logout erases saved credentials and prevents reconnect at startup',async p=>{
    await p.locator('#back-button').click();
    await p.locator('#exit-button').click();
    assert.equal(await p.evaluate(()=>localStorage.getItem('starlink-dtv-qa032-remembered-account')),null);
    await p.reload();
    assert.equal(await p.locator('#login-screen').isVisible(),true);
    assert.equal(await p.evaluate(()=>window.__starlinkLiteQA.snapshot().logged),false);
  });
  await check('frozen live stream reopens the SAME channel',async p=>{
    const before=await p.evaluate(()=>window.__testAV.opened.length);
    await p.evaluate(()=>{
      const listener=window.__testAV.listeners[window.__testAV.listeners.length-1];
      listener.oncurrentplaytime(1000);listener.oncurrentplaytime(2300);
    });
    await p.clock.fastForward(16000);
    assert.equal(await p.evaluate(()=>window.__testAV.opened.length),before+1);
    assert.equal(await p.evaluate(()=>window.__starlinkLiteQA.snapshot().retryCount),1);
  },true);
  await check('back button stops watchdog retry',async p=>{
    await p.evaluate(()=>{
      const l=window.__testAV.listeners[window.__testAV.listeners.length-1];
      l.oncurrentplaytime(1000);l.oncurrentplaytime(2000);
    });
    await p.locator('#back-button').click();
    const before=await p.evaluate(()=>window.__testAV.opened.length);
    await p.clock.fastForward(25000);
    assert.equal(await p.evaluate(()=>window.__testAV.opened.length),before);
  },true);
  await browser.close();
  console.log('QA032_REBUFFER_AUTOLOGIN',passed,'/4 passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
