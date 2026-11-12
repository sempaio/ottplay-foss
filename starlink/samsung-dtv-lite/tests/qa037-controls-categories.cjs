'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../app/discovery.js','utf8'),ctx);
const m=ctx.module.exports;
const rows=[
 {name:'TV Brasil HD',stream_id:12,category_id:'3'},
 {name:'Globo RJ FHD',stream_id:13,category_id:'3'},
 {name:'SporTV FHD',stream_id:14,category_id:'4'},
 {name:'Discovery Channel HD',stream_id:15,category_id:'5'}
].map(r=>m.normalize('live',r,({'3':'Abertos','4':'Esportes','5':'Documentários'})[r.category_id]));
const channels=m.groupLive(rows);
const categories=m.liveCategories(channels,[
 {category_id:'5',category_name:'Documentários'},
 {category_id:'4',category_name:'Esportes'},
 {category_id:'3',category_name:'Abertos'}
]);
assert.equal(categories[0].id,'','first tab: all channels');
assert.equal(categories[1].title,'Abertos','Abertos first in real categories');
assert.equal(categories[2].title,'Esportes');
assert.equal(categories[3].title,'Documentários');
assert.equal(m.filterLiveCategory(channels,'3').length,2,'Abertos only');
assert.equal(m.filterLiveCategory(channels,'4')[0].title,'SporTV');
assert.equal(m.filterLiveCategory(channels,'').length,4,'all categories');
assert.equal(m.filterLiveCategory(channels,'unknown').length,0);
assert.equal(m.isSeekable({kind:'live'}),false,'never seek live without DVR');
assert.equal(m.isSeekable({kind:'movie'}),true);
assert.equal(m.isSeekable({kind:'episode'}),true);
assert.equal(m.seekTarget(15000,10000,100000),25000);
assert.equal(m.seekTarget(15000,-10000,100000),5000);
assert.equal(m.seekTarget(7000,-10000,100000),0);
assert.equal(m.seekTarget(95000,10000,100000),99000,'avoid seeking past movie end');
assert.equal(m.seekTarget(10000,10000,0),null,'unknown duration cannot seek');
assert.equal(m.seekTarget(10000,10000,NaN),null);
const sheet=fs.readFileSync(__dirname+'/../app/style.css','utf8');
assert(/\.stream-card\.is-live\s+\.stream-poster\s+img\s*\{[^}]*object-fit\s*:\s*contain/s.test(sheet),'live channel logos must not zoom/crop');
assert(/\.stream-card\.is-live\s+\.stream-poster\s*\{[^}]*height\s*:/s.test(sheet),'live channel tiles have dedicated compact dimensions');
console.log('QA037 category and safe seek: PASS');
