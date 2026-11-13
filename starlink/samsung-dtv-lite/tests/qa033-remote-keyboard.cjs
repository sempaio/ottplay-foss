const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const path = require('node:path');
const url = 'file:///' + path.resolve(__dirname, '../app/index.html').replace(/\\/g, '/');
(async () => {
 const browser = await chromium.launch({headless: true, channel:'chrome'});
 let passed=0;
 async function test(name, action) {
   const page=await browser.newPage();
   await page.addInitScript(() => {
     const av={open(){},setDisplayRect(){},setListener(){},prepareAsync(){},play(){},stop(){},close(){}};
     window.webapis={avplay:av};
   });
   await page.route('**/player_api.php?*', async route => {
     const act=new URL(route.request().url()).searchParams.get('action');
     const data=act==='get_live_categories'?[{category_id:'1',category_name:'Abertos'}]:
       act==='get_live_streams'?[{name:'Canal A',stream_id:730,category_id:'1',container_extension:'m3u8'}]:
       {user_info:{auth:1,status:'Active'}};
     await route.fulfill({status:200,contentType:'application/json',
       headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
   });
   await page.goto(url);
   try {await action(page); console.log('PASS', name);passed++;}
   finally {await page.close();}
 }
 await test('login has a focused text field that the TV remote can select',async p=>{
   await p.waitForTimeout(50);
   assert.equal(await p.evaluate(()=>document.activeElement.id),'username');
 });
 await test('fallback keyboard opens and enters username using remote arrows and Enter',async p=>{
   await p.locator('#username-keyboard').click();
   assert.equal(await p.locator('#login-keyboard').isVisible(),true);
   const initial=await p.evaluate(()=>document.activeElement.textContent.trim());
   assert.equal(initial,'a');
   await p.keyboard.press('ArrowRight');
   await p.keyboard.press('Enter');
   assert.equal(await p.locator('#username').inputValue(),'b');
   await p.locator('#keyboard-done').click();
   assert.equal(await p.locator('#login-keyboard').isVisible(),false);
 });
 await test('password entry is masked and remote fallback does not log or persist before successful login',async p=>{
   await p.locator('#password-keyboard').click();
   await p.locator('[data-tv-key="a"]').click();
   assert.equal(await p.locator('#password').inputValue(),'a');
   assert.equal(await p.locator('#password').getAttribute('type'),'password');
   assert.equal(await p.evaluate(()=>localStorage.getItem('starlink-dtv-qa032-remembered-account')),null);
 });
 await test('remote Back closes fallback without logging out',async p=>{
   await p.locator('#username-keyboard').click();
   await p.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:10009,which:10009,bubbles:true,cancelable:true})));
   assert.equal(await p.locator('#login-keyboard').isVisible(),false);
   assert.equal(await p.locator('#login-screen').isVisible(),true);
 });
 await test('QA 1.0.0 login: Enter from lost focus and remote arrows reach username and password',async p=>{
   await p.waitForTimeout(50);
   await p.evaluate(()=>document.activeElement.blur());
   await p.keyboard.press('Enter');
   assert.equal(await p.evaluate(()=>document.activeElement.id),'username');
   await p.keyboard.press('ArrowDown');
   assert.equal(await p.evaluate(()=>document.activeElement.id),'password');
   await p.keyboard.press('ArrowUp');
   assert.equal(await p.evaluate(()=>document.activeElement.id),'username');
   await p.keyboard.press('ArrowRight');
   assert.equal(await p.evaluate(()=>document.activeElement.id),'username-keyboard');
   await p.keyboard.press('ArrowLeft');
   assert.equal(await p.evaluate(()=>document.activeElement.id),'username');
   await p.keyboard.press('ArrowDown');
   await p.keyboard.press('ArrowRight');
   assert.equal(await p.evaluate(()=>document.activeElement.id),'password-keyboard');
 });
 await test('native Samsung IME Done advances from username to password to Connect without sending credentials',async p=>{
   await p.waitForTimeout(50);
   await p.locator('#username').focus();
   await p.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:65376,which:65376,bubbles:true,cancelable:true})));
   await p.waitForTimeout(30);
   assert.equal(await p.evaluate(()=>document.activeElement.id),'password');
   await p.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:65376,which:65376,bubbles:true,cancelable:true})));
   await p.waitForTimeout(30);
   assert.equal(await p.evaluate(()=>document.activeElement.id),'login-button');
   assert.equal(await p.evaluate(()=>document.querySelector('#password').value),'');
 });
 await browser.close();
 console.log('QA033_REMOTE_LOGIN_KEYBOARD',passed,'/6 passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
