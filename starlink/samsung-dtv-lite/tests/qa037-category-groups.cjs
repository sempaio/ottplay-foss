'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ctx={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../app/discovery.js','utf8'),ctx);
const m=ctx.module.exports;
const channel=(name,id,cat)=>m.normalize('live',{name:name,stream_id:id,category_id:String(id)},cat);
const film=(name,id,cat)=>m.normalize('movie',{name:name,stream_id:id},cat);
const series=(name,id,cat)=>m.normalize('series',{name:name,series_id:id},cat);
const live=m.groupLive([
 channel('TV Cultura HD',1,'Canais abertos'),
 channel('SBT RJ FHD',2,'CANAIS: ABERTOS ✨'),
 channel('Globo SP HD',3,'Canais | Globos Sudeste'),
 channel('SporTV HD',4,'CANAIS: ESPORTES ⚽'),
 channel('NBA TV HD',5,'Canais | NBA'),
 channel('Chaves Temporada 1 24h',6,'Canais | [24H] Series'),
 channel('HBO 2 HD',7,'Canais | HBO'),
 channel('Sem nome HD',8,'Sem categoria')
]);
const facets=m.categoryGroups(live,'live');
assert.equal(facets.groups[1].title,'Abertos');
assert.equal(m.filterGrouped(live,'live','Abertos','').length,3);
assert.equal(m.filterGrouped(live,'live','Esportes','').length,2);
assert.equal(m.filterGrouped(live,'live','Séries 24h','').length,1);
assert.equal(m.filterGrouped(live,'live','Canais de filmes','')[0].title,'HBO 2');
assert.equal(m.filterGrouped(live,'live','Outros','').length,1);
assert.equal(m.filterGrouped(live,'live','','').length,8);
assert.equal(m.filterGrouped(live,'live','Abertos','Globo Sudeste').length,1);
const movies=[
 film('Aventura 1',101,'FILMES | Aventura'),
 film('Aventura 2',102,'Filmes | Aventura'),
 film('Ação 1',103,'Filmes | Acao'),
 film('Ação 2',104,'FILMES | Ação'),
 film('Novo',105,'FILMES | Lançamentos'),
 film('4K',106,'FILMES | 4K UHD'),
 film('Legendado',107,'Canais | Legendados'),
 film('Susto',108,'FILMES | Terror')
];
const filmFacets=m.categoryGroups(movies,'movie');
assert.equal(m.filterGrouped(movies,'movie','Aventura','').length,2);
assert.equal(m.filterGrouped(movies,'movie','Ação','').length,2);
assert.equal(m.filterGrouped(movies,'movie','Lançamentos','').length,1);
assert.equal(m.filterGrouped(movies,'movie','Qualidade','').length,1);
const shows=[
 series('Serie 1',200,'SÉRIES | NETFLIX'),
 series('Serie 2',201,'SÉRIES | GLOBOPLAY'),
 series('Serie 3',202,'Filmes'),
 series('Serie 4',203,'Séries')
];
const seriesFacets=m.categoryGroups(shows,'series');
assert.equal(m.filterGrouped(shows,'series','Por origem','').length,2);
assert.equal(m.filterGrouped(shows,'series','Séries','').length,2);
assert.equal(seriesFacets.groups[0].count,4);
console.log('QA037 grouped taxonomy smoke PASS');
