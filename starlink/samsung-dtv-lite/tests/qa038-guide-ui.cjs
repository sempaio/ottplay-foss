'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..','app');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const js=fs.readFileSync(path.join(dir,'experience.js'),'utf8');
const main=fs.readFileSync(path.join(dir,'main.js'),'utf8');
const discovery=fs.readFileSync(path.join(dir,'discovery.js'),'utf8');
for(const id of ['epg-panel','epg-heading','epg-list','epg-status','epg-close','epg-refresh',
  'epg-watch','guide-current-button','guide-player-button']){
 assert(html.includes('id="'+id+'"'),id+' missing');
}
assert(html.indexOf('metadata.js')<html.indexOf('experience.js'),'metadata helper loaded before UI');
assert(js.includes("bridge.request('get_short_epg'"),'guide loads only on demand');
assert(js.includes("bridge.request('get_vod_info'"),'movie synopsis loads only on demand');
assert(js.includes("bridge.request('get_series_info'"),'series details loaded on demand');
assert(js.includes('guideItem!==item'),'ignore obsolete guide reply');
assert(js.includes('movieDetailItem!==item'),'ignore obsolete VOD reply');
assert(js.includes('metaCache.get(cacheKey,5*60*1000)'),'5 minute EPG cache');
assert(js.includes('metaCache.get(key,12*60*60*1000)'),'12 hour VOD detail cache');
assert(main.includes("action==='get_short_epg'"),'stream-scoped EPG parameters');
assert(main.includes("action==='get_vod_info'"),'movie-scoped detail parameter');
assert(!main.includes('/xmltv.php'),'no full XMLTV downloads in app');
assert(discovery.includes('description:val(e.info&&'),'episode detail included when provided');
console.log('QA038 visible EPG and lazy synopsis UI PASS');
