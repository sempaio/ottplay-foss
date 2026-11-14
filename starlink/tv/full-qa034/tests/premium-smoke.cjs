// M81-APP-01: static safety guard for the TV Premium visual skin.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const app=path.resolve(__dirname,'../app');
const read=(n)=>fs.readFileSync(path.join(app,n),'utf8');
const index=read('index.html'),config=read('config.xml'),skin=read('premium.css'),enhancement=read('premium.js');
for(const id of ['premium-home','premium-hero','premium-play','premium-live','premium-hero-art','items','categories','playback','avplayer','video'])
  assert(index.includes('id="'+id+'"'), 'Missing required UI element: '+id);
assert(index.includes('src="app.js"') && index.includes('src="premium.js"'), 'Original player must remain loaded');
assert(index.indexOf('src="app.js"') < index.indexOf('src="premium.js"'),'premium runs after original app');
assert(index.includes('href="premium.css"'),'premium CSS must be present');
assert(config.includes('STLTP34001.Theater4') && config.includes('package="STLTP34001"'),'isolate production app ID');
assert(!config.includes('STLRB00034'),'do not overwrite original QA3.4');
assert(!skin.includes(':has('),'avoid unsupported Tizen selectors');
assert(!enhancement.includes('.avplay.'),'visual layer must not modify AVPlay');
const original=cp.execFileSync('git',['hash-object',path.join(app,'app.js')],{encoding:'utf8'}).trim();
assert.equal(original,'2e19288091099202981316949c3d9ca3559c1dcf','base QA 3.4 app.js changed: investigate before packaging');
console.log('THEATER4_PREMIUM: 14 verificações estáticas aprovadas');
