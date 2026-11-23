const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
const url='file:///'+path.resolve(__dirname,'../app/index.html').replace(/\\/g,'/');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 let passed=0;
 async function fixture({notice=null,update=null,fail=false}={}){
  const context=await browser.newContext();
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const av={state:'NONE',opened:[],listener:null,open(url){this.opened.push(url);this.state='IDLE';},setListener(x){this.listener=x;},
    setDisplayRect(){},prepareAsync(success){this.state='READY';success();},play(){this.state='PLAYING';},
    stop(){this.state='IDLE';},close(){this.state='NONE';},getState(){return this.state;},pause(){this.state='PAUSED';}};
   window.webapis={avplay:av};window.__avTest=av;
   window.__installCalls=0;
   window.tizen={tvinputdevice:{registerKey(){}},package:{install(){window.__installCalls++;throw Error('privileged');}}};
  });
  await page.route('**/player_api.php?*',async route=>{
   const q=new URL(route.request().url()).searchParams;
   let data={user_info:{auth:1,status:'Active',exp_date:0}};
   if(q.get('action')==='get_live_categories')data=[{category_id:'1',category_name:'TV'}];
   if(q.get('action')==='get_live_streams')data=[{stream_id:730,name:'Canal Teste',category_id:'1'}];
   await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
  });
  const requests=[];
  await page.route('**/app/announcements/active',async route=>{
   requests.push({kind:'notice',url:route.request().url()});
   await route.fulfill({status:fail?404:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
    body:JSON.stringify({announcement:notice})});
  });
  await page.route('**/app/samsung/updates/latest?*',async route=>{
   requests.push({kind:'update',url:route.request().url()});
   await route.fulfill({status:fail?404:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
    body:JSON.stringify({update})});
  });
  await page.goto(url);
  return {context,page,errors,requests};
 }
 async function enter(page){
  await page.locator('#username').fill('qa_user');
  await page.locator('#password').fill('qa_password');
  await page.locator('#connect').click();
  await page.locator('#library').waitFor({state:'visible',timeout:10000});
 }
 async function run(label,options,fn){
  const f=await fixture(options);
  try{await fn(f);assert.deepEqual(f.errors,[]);console.log('PASS',label);passed++;}
  finally{await f.context.close();}
 }
 await run('PR58 announcement appears after Xtream login as text and closes without changing catalog',
  {notice:{id:15,title:'Aviso do painel',message:'Programação em revisão <script>alert(1)</script>'}},
  async ({page,requests})=>{
   await enter(page);
   await page.locator('#remote-notice').waitFor({state:'visible'});
   assert.equal(await page.locator('#remote-notice-title').innerText(),'Aviso do painel');
   assert.match(await page.locator('#remote-notice-body').innerText(),/<script>alert\(1\)<\/script>/);
   assert.equal(await page.locator('#remote-notice script').count(),0);
   assert.equal(requests.some(x=>x.kind==='notice'),true);
   assert.equal(requests.some(x=>x.kind==='update'),true);
   assert.equal(requests.every(x=>!x.url.includes('qa_password')&&!x.url.includes('qa_user')),true);
   await page.locator('#remote-notice-dismiss').click();
   await page.locator('#remote-notice').waitFor({state:'hidden'});
   await page.locator('#categories button').first().click();
   await page.getByText('Canal Teste').waitFor();
  });
 await run('Samsung receives update metadata but never installs a WGT through restricted platform API',
  {update:{package_id:'STLRB036AV',version:'0.3.7',sha256:'a'.repeat(64),
   wgt_url:'https://panel.example/releases/STARLINK-0.3.7.wgt',notes:'Correção de reprodução'}},
  async ({page})=>{
   await enter(page);
   await page.locator('#remote-notice').waitFor({state:'visible'});
   assert.match(await page.locator('#remote-notice-title').innerText(),/0\.3\.7/);
   assert.match(await page.locator('#remote-notice-body').innerText(),/2APP|Samsung/);
   assert.equal(await page.evaluate(()=>window.__installCalls),0);
   assert.equal(await page.locator('#remote-notice a').count(),0);
  });
 await run('Android releases and malicious update urls are ignored',
  {update:{package_id:'ru.iptvremote.android.iptv.pro',version:'99.0.0',sha256:'a'.repeat(64),
   wgt_url:'https://panel.example/releases/app.apk'}},
  async ({page})=>{
   await enter(page);
   await page.waitForTimeout(500);
   assert.equal(await page.locator('#remote-notice').isVisible(),false);
  });
 await run('Missing PR58 and missing Samsung update endpoint do not interrupt Xtream',
  {fail:true},
  async ({page})=>{
   await enter(page);
   await page.locator('#categories button').first().waitFor();
   await page.locator('#categories button').first().click();
   await page.getByText('Canal Teste').waitFor();
   assert.equal(await page.locator('#remote-notice').isVisible(),false);
  });
 await run('Announcement arriving while watching is deferred until returning to catalog',
  {notice:{id:27,title:'Comunicado',message:'Teste de aviso sem interromper filme ou canal'}},
  async ({page})=>{
   // Block the notice call until a channel starts to ensure delivery during playback.
   let release;
   await page.route('**/app/announcements/active',async route=>{
    await new Promise(resolve=>{release=()=>resolve();});
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({announcement:{id:27,title:'Comunicado',message:'Teste de aviso'}})});
   });
   await enter(page);
   await page.locator('#categories button').first().click();
   await page.getByText('Canal Teste').click();
   assert.equal(await page.locator('#playback').isVisible(),true);
   if(release)release();
   await page.waitForTimeout(600);
   assert.equal(await page.locator('#remote-notice').isVisible(),false);
   await page.locator('#stop').click();
   await page.locator('#remote-notice').waitFor({state:'visible'});
  });
 await browser.close();
 console.log('STARLINK_SAMSUNG_QA036_REMOTE_OPS',passed,'/5');
})().catch(e=>{console.error(e);process.exit(1);});
