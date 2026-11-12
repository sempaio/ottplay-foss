'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={module:{exports:{}},atob:x=>Buffer.from(x,'base64').toString('latin1')};
vm.runInNewContext(fs.readFileSync(__dirname+'/../app/metadata.js','utf8'),ctx);
const m=ctx.module.exports,now=1760000000000;
const b=x=>Buffer.from(x,'utf8').toString('base64');
const listings=m.guide({epg_listings:[
 {title:b('Programa atual'),description:b('Descrição com acentuação: ação e família'),
  start_timestamp:String(now/1000-3600),stop_timestamp:String(now/1000+3600)},
 {title:b('Programa seguinte'),description:b('Próxima atração'),
  start_timestamp:String(now/1000+3600),stop_timestamp:String(now/1000+7200)},
 {title:b('Expirou'),start_timestamp:'100',stop_timestamp:'200'},
 {title:b('Inválido'),start_timestamp:'5000',stop_timestamp:'4000'}
]},now);
assert.equal(listings.length,2);
assert.equal(listings[0].title,'Programa atual');
assert.equal(listings[0].description,'Descrição com acentuação: ação e família');
assert.equal(listings[0].nowPlaying,true);
assert.equal(listings[1].nowPlaying,false);
assert.deepEqual(Array.from(m.guide({epg_listings:[]},now)),[]);
assert.equal(m.decodeXtream('Sem horários'), 'Sem horários');
assert.equal(m.synopsis({info:{name:'Filme',description:'Sinopse oficial',genre:'Ação',releasedate:'2026'}},{title:'Fallback'}).description,'Sinopse oficial');
assert.equal(m.synopsis({info:{description:''}},{title:'Sem descrição'}).description,'');
const longSynopsisTtl=12*60*60*1000,shortMissTtl=60*1000;
assert.equal(m.synopsisCacheTtl({info:{plot:'Sinopse TMDB'}},{title:'Filme'}),longSynopsisTtl);
assert.equal(m.synopsisCacheTtl({info:{description:''}},{title:'Filme'}),shortMissTtl);
assert.equal(m.synopsisCacheTtl({},{}),shortMissTtl);
assert.equal(m.synopsisCacheTtl({info:{}},{description:'Sinopse da fonte'}),longSynopsisTtl);
const emptyInfo={info:{plot:''}},negative=m.cache(2);
negative.put('vod:123',emptyInfo,now);
assert.equal(negative.get('vod:123',m.synopsisCacheTtl(emptyInfo,{}),now+61000),null,'missing synopsis re-fetches shortly after TMDB activation');
const validInfo={info:{plot:'Sinopse confirmada'}},positive=m.cache(2);
positive.put('vod:123',validInfo,now);
assert.ok(positive.get('vod:123',m.synopsisCacheTtl(validInfo,{}),now+600000),'valid synopsis keeps long cache');
const c=m.cache(2);c.put('guide:123',listings,now);
assert.ok(c.get('guide:123',300000,now+200000));
assert.equal(c.get('guide:123',300000,now+301000),null);
c.put('b',{value:2},now);c.put('c',{value:3},now);
assert.equal(c.get('guide:123',300000,now),null,'cache bounded');
console.log('QA038 metadata parsing/cache PASS');
