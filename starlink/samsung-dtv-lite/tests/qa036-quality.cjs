'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../app/discovery.js','utf8'),ctx);
const m=ctx.module.exports;
const raw=[
 {name:'Globo RJ SD',stream_id:10,container_extension:'m3u8'},
 {name:'Globo RJ HD',stream_id:11,container_extension:'m3u8'},
 {name:'Globo RJ FHD',stream_id:12,container_extension:'m3u8'},
 {name:'Globo SP HD',stream_id:13,container_extension:'m3u8'},
 {name:'Telecine Action HD',stream_id:14,container_extension:'ts'},
 {name:'Telecine Premium FHD',stream_id:15,container_extension:'ts'},
 {name:'HBO HD',stream_id:16,container_extension:'ts'},
 {name:'HBO 2 HD',stream_id:17,container_extension:'ts'},
 {name:'Chaves S01 24H',stream_id:18,container_extension:'m3u8'},
 {name:'Chaves S02 24H',stream_id:19,container_extension:'m3u8'},
 {name:'TV Brasil (720p)',stream_id:20,container_extension:'m3u8'}
].map(row=>m.normalize('live',row,'Canais Abertos'));
const groups=m.groupLive(raw);
assert.equal(groups.length,9,'only Globo RJ SD/HD/FHD may be grouped');
const rio=groups.find(x=>x.title==='Globo RJ');
assert(rio,'normalized station title');
assert.equal(rio.qualities.length,3);
assert.equal(m.chooseQuality(rio,'SD').id,'10');
assert.equal(m.chooseQuality(rio,'HD').id,'11');
assert.equal(m.chooseQuality(rio,'FHD').id,'12');
assert.equal(m.chooseQuality(rio,'auto').id,'10','auto preserves first working URL (ABR internal to this source)');
assert.equal(m.qualityLabel('TV Brasil (720p)'),'HD');
assert(groups.some(x=>x.title==='Globo SP'));
assert(groups.some(x=>x.title==='Telecine Action'));
assert(groups.some(x=>x.title==='Telecine Premium'));
assert(groups.some(x=>x.title==='HBO 2'));
assert.equal(groups.filter(x=>x.title.includes('Chaves')).length,2);
const test=m.normalize('live',{name:'Cultura',stream_id:101},'Aberto');
assert.equal(m.groupLive([test])[0].qualities.length,1);
console.log('QA036 quality grouping: PASS');
