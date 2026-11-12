'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../app/discovery.js','utf8'),ctx);
const t=ctx.module.exports;
const category=(kind,name)=>t.categoryTaxonomy(kind,name);
assert.equal(category('live','CANAIS: ABERTOS ✨').group,'Abertos');
assert.equal(category('live','Canais |  Abertos').group,'Abertos');
assert.equal(category('live','Canais | Globos Sudeste').group,'Abertos');
assert.equal(category('live','CANAIS: PPV / ESPORTES ⚽').group,'Esportes');
assert.equal(category('live','Canais | NBA').group,'Esportes');
assert.equal(category('live','CANAIS: HBO ✨').group,'Canais de filmes');
assert.equal(category('live','CANAIS: TELECINE ✨').group,'Canais de filmes');
assert.equal(category('live','Canais | [24H] Series').group,'Séries 24h');
assert.equal(category('movie','FILMES | Ação').group,'Ação');
assert.equal(category('movie','Filmes | Acao').group,'Ação');
assert.equal(category('movie','FILMES | 4K UHD').group,'Qualidade');
assert.equal(category('series','SÉRIES | NETFLIX').group,'Por origem');
const items=[
 t.normalize('live',{name:'Globo RJ HD',stream_id:901},'CANAIS: ABERTOS ✨'),
 t.normalize('live',{name:'TV Brasil HD',stream_id:902},'Canais |  Abertos'),
 t.normalize('live',{name:'SporTV HD',stream_id:903},'Canais | Esportes')
];
const groups=t.categoryGroups(items,'live');
assert.equal(groups.groups.find(x=>x.key==='Abertos').count,2);
assert.equal(t.filterGrouped(items,'live','Abertos','').length,2);
assert.equal(t.filterGrouped(items,'live','Esportes','').length,1);
assert.equal(items[0].category,'CANAIS: ABERTOS ✨','source category preserved');
const main=fs.readFileSync(__dirname+'/../app/main.js','utf8');
for(const hook of ['skip-back-button','skip-forward-button','play-pause-button','next-episode-button'])
 assert(main.includes("byId('"+hook+"').onclick"),hook+' must be wired');
console.log('QA037 taxonomy and player controls: PASS');
