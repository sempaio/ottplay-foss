const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
const url='file:///'+path.resolve(__dirname,'../app/index.html').replace(/\\/g,'/');
const stubs={
 get_live_categories:[{category_id:'1',category_name:'TV Abertos'},{category_id:'5',category_name:'Esportes'}],
 get_live_streams:[{stream_id:730,name:'Canal M81 Teste',category_id:'1',container_extension:'m3u8'}],
 get_vod_categories:[{category_id:'2',category_name:'Filmes Teste'}],
 get_vod_streams:[{stream_id:20,name:'Filme Teste',category_id:'2',container_extension:'mp4'}],
 get_series_categories:[{category_id:'3',category_name:'Series Teste'}],
 get_series:[{series_id:12,name:'Serie Teste',category_id:'3'}]
};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 let ok=0;
 async function fixture(){
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.clock.install();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const av={opened:[],listener:null,state:'NONE',
    open(u){this.opened.push(u);this.state='IDLE';},
    setDisplayRect(){if(this.state!=='IDLE')throw Error('Display in invalid state');},
    setListener(x){this.listener=x;},
    prepareAsync(ok){if(this.state!=='IDLE')throw Error('Prepare in invalid state');this.state='READY';ok();},
    play(){if(this.state!=='READY'&&this.state!=='PAUSED')throw Error('Play in invalid state');this.state='PLAYING';},
    stop(){if(this.state==='NONE'||this.state==='IDLE')throw Error('Stop in invalid state');this.state='IDLE';},
    close(){this.state='NONE';},
    pause(){if(this.state!=='PLAYING')throw Error('Pause in invalid state');this.state='PAUSED';},
    getState(){return this.state;}};
   window.webapis={avplay:av};window.__avTest=av;
  });
  await page.route(/player_api\.php/,async route=>{
    const params=new URL(route.request().url()).searchParams;
    const action=params.get('action');
    let data=stubs[action] || {user_info:{auth:1,status:'Active',exp_date:'0'}};
    if(action==='get_live_streams' && !params.has('category_id')){
      data=stubs.get_live_streams.concat([{stream_id:731,name:'Canal de Outra Categoria',category_id:'5'}]);
    }
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
  });
  await page.goto(url);
  return {context,page,errors};
 }
 async function enter(page){
  await page.locator('#username').fill('qa_user');
  await page.locator('#password').fill('qa_password');
  await page.locator('#connect').click();
  await page.locator('#library').waitFor({state:'visible',timeout:10000});
  await page.locator('#categories button').first().waitFor({timeout:10000});
 }
 async function run(label,fn){
  const f=await fixture();
  try{await fn(f.page);assert.deepEqual(f.errors,[]);console.log('PASS',label);ok++;}
  finally{await f.context.close();}
 }
 await run('preconfigured server and focus username',async page=>{
  assert.equal(await page.locator('#server').inputValue(),'https://panel.taila5c5c2.ts.net');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'username');
 });
 await run('full Samsung catalog has channels movies and series',async page=>{
  await enter(page);
  assert.equal(await page.locator('#tabs [data-kind]').count(),3);
  await page.locator('#categories button').first().click();
  await page.locator('#items button').first().waitFor();
  assert.match(await page.locator('#items').innerText(),/Canal M81 Teste/);
  await page.locator('[data-kind="vod"]').click();
  await page.locator('#categories button').first().click();
  await page.getByText('Filme Teste').waitFor({timeout:10000});
  assert.match(await page.locator('#items').innerText(),/Filme Teste/);
  await page.locator('[data-kind="series"]').click();
  await page.locator('#categories button').first().click();
  await page.getByText('Serie Teste').waitFor({timeout:10000});
  assert.match(await page.locator('#items').innerText(),/Serie Teste/);
 });
 await run('remote-controlled keyboard types user and masked password',async page=>{
  await page.locator('#keyboard-username').click();
  assert.equal(await page.locator('#remote-keyboard').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'a');
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  assert.equal(await page.locator('#username').inputValue(),'b');
  await page.locator('#key-done').click();
  await page.locator('#keyboard-password').click();
  await page.locator('#keyboard-grid [data-key="a"]').click();
  assert.equal(await page.locator('#password').inputValue(),'a');
  assert.equal(await page.locator('#password').getAttribute('type'),'password');
  assert.equal(await page.evaluate(()=>localStorage.getItem('starlink-dtv-full-qa034-remembered-login')),null);
 });
 await run('login auto-restores and logout erases remembered account',async page=>{
  await enter(page);
  assert.ok(await page.evaluate(()=>localStorage.getItem('starlink-dtv-full-qa034-remembered-login')));
  await page.reload();
  await page.locator('#library').waitFor({state:'visible',timeout:10000});
  await page.locator('#logout').click();
  assert.equal(await page.locator('#login').isVisible(),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('starlink-dtv-full-qa034-remembered-login')),null);
 });
 await run('frozen live stream reopens SAME channel',async page=>{
  await enter(page);
  await page.locator('#categories button').first().click();
  await page.locator('#items button').first().click();
  assert.equal(await page.evaluate(()=>window.__avTest.opened.length),1);
  await page.evaluate(()=>{
    window.__avTest.listener.oncurrentplaytime(1000);
    window.__avTest.listener.oncurrentplaytime(2200);
  });
  await page.clock.fastForward(17000);
  assert.equal(await page.evaluate(()=>window.__avTest.opened.length),2);
  const urls=await page.evaluate(()=>window.__avTest.opened);
  assert.equal(urls[0],urls[1]);
 });
 await run('manual pause prevents live reconnect',async page=>{
  await enter(page);
  await page.locator('#categories button').first().click();
  await page.locator('#items button').first().click();
  await page.evaluate(()=>{window.__avTest.listener.oncurrentplaytime(1000);window.__avTest.listener.oncurrentplaytime(2000);});
  await page.locator('#pause').click();
  await page.clock.fastForward(25000);
  assert.equal(await page.evaluate(()=>window.__avTest.opened.length),1);
 });
 await run('finished live stream remains eligible for automatic recovery',async page=>{
  await enter(page);
  await page.locator('#categories button').first().click();
  await page.getByText('Canal M81 Teste').waitFor();
  await page.locator('#items button').first().click();
  await page.evaluate(()=>{
    window.__avTest.listener.oncurrentplaytime(1000);
    window.__avTest.listener.oncurrentplaytime(2200);
    window.__avTest.listener.onstreamcompleted();
  });
  assert.equal(await page.locator('#playback').isVisible(),true);
  await page.clock.fastForward(17000);
  assert.equal(await page.evaluate(()=>window.__avTest.opened.length),2);
 });
 await run('finished film exits player, with no automatic reconnect',async page=>{
  await enter(page);
  await page.locator('[data-kind="vod"]').click();
  await page.locator('#categories button').first().click();
  await page.getByText('Filme Teste').waitFor();
  await page.locator('#items button').first().click();
  await page.waitForFunction(()=>!!window.__avTest.listener,{timeout:10000});
  await page.evaluate(()=>window.__avTest.listener.onstreamcompleted());
  assert.equal(await page.locator('#playback').isVisible(),false);
 });
 await run('busca global encontra canal de outra categoria e mantem o layout original',async page=>{
  await enter(page);
  assert.equal(await page.locator('#tabs [data-kind]').count(),3);
  assert.equal(await page.locator('#search-channels').isVisible(),true);
  assert.equal(await page.locator('#build').innerText(),'Samsung · reconstrução 0.3.0 QA');
  await page.locator('#categories button').first().click();
  await page.getByText('Canal M81 Teste').waitFor({timeout:10000});
  await page.locator('#search-channels').click();
  await page.locator('#search').fill('Outra Categoria');
  await page.getByText('Canal de Outra Categoria').waitFor({timeout:10000});
  assert.doesNotMatch(await page.locator('#items').innerText(),/Canal M81 Teste/);
  await page.locator('#search').fill('');
  await page.getByText('Canal M81 Teste').waitFor({timeout:10000});
  assert.doesNotMatch(await page.locator('#items').innerText(),/Canal de Outra Categoria/);
  await page.locator('[data-kind="series"]').click();
  assert.equal(await page.locator('#search').getAttribute('placeholder'),'Buscar nesta categoria');
 });
 await run('Xtream media candidate offers HLS fallback only for Xtream live TS',async ()=>{
  const c=require(path.resolve(__dirname,'../app/catalog.js'));
  const account={server:'https://panel.example',username:'qa',password:'private'};
  const generated=c.mediaCandidates(account,'live',{stream_id:42,container_extension:'ts'});
  assert.deepEqual(generated,[
    'https://panel.example/live/qa/private/42.ts',
    'https://panel.example/live/qa/private/42.m3u8'
  ]);
  assert.deepEqual(c.mediaCandidates(account,'live',{stream_id:43,container_extension:'ts',direct_source:'https://cdn.example/live.ts'}),['https://cdn.example/live.ts']);
  assert.deepEqual(c.mediaCandidates(account,'vod',{stream_id:44,container_extension:'mp4'}),['https://panel.example/movie/qa/private/44.mp4']);
 });
 await run('AVPlay retries TS once as HLS when Samsung reports unsupported format',async page=>{
  await page.route(/player_api\\.php/,async route=>{
    const action=new URL(route.request().url()).searchParams.get('action');
    if(action!=='get_live_streams')return route.fallback();
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify([{stream_id:730,name:'Canal M81 Teste',category_id:'1',container_extension:'ts'}])});
  });
  await enter(page);
  await page.locator('#categories button').first().click();
  await page.locator('#items button').first().click();
  let urls=await page.evaluate(()=>window.__avTest.opened);
  assert.equal(urls.length,1);
  assert.ok(urls[0].endsWith('/730.ts'));
  await page.evaluate(()=>window.__avTest.listener.onerror('PLAYER_ERROR_NOT_SUPPORTED_FORMAT'));
  urls=await page.evaluate(()=>window.__avTest.opened);
  assert.equal(urls.length,2);
  assert.ok(urls[1].endsWith('/730.m3u8'));
  await page.evaluate(()=>window.__avTest.listener.onerror('PLAYER_ERROR_NOT_SUPPORTED_FORMAT'));
  await page.clock.fastForward(40000);
  assert.equal(await page.evaluate(()=>window.__avTest.opened.length),2);
  assert.match(await page.locator('#player-status').innerText(),/PLAYER_ERROR_NOT_SUPPORTED_FORMAT/);
  assert.doesNotMatch(await page.locator('#player-status').innerText(),/qa_password/);
 });
 await run('AVPlay unsupported HLS stays stopped without repeated reconnection',async page=>{
  await enter(page);
  await page.locator('#categories button').first().click();
  await page.locator('#items button').first().click();
  await page.evaluate(()=>window.__avTest.listener.onerror('PLAYER_ERROR_NOT_SUPPORTED_FILE'));
  await page.clock.fastForward(90000);
  assert.equal(await page.evaluate(()=>window.__avTest.opened.length),1);
  assert.match(await page.locator('#player-status').innerText(),/PLAYER_ERROR_NOT_SUPPORTED_FILE/);
 });
 await browser.close();
 console.log('STARLINK_SAMSUNG_FULL_QA034',ok,'/12');
})().catch(e=>{console.error(e);process.exit(1);});
