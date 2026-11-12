'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../app/discovery.js','utf8'),context);
const m=context.module.exports;
const categories=[
 {category_id:'aabb',category_name:'FILMES | Lançamentos'},
 {category_id:'ccdd',category_name:'FILMES | Ação'},
 {category_id:'0011',category_name:'FILMES | Acao'},
 {category_id:'eeff',category_name:'FILMES | Terror'},
 {category_id:'1122',category_name:'FILMES | 4K UHD'},
 {category_id:'3344',category_name:'FILMES | Romance'}
];
const facets=m.movieSourceDirectory(categories);
assert.equal(facets.defaultGroup,'Lançamentos');
assert.equal(facets.groups.some(x=>x.key==='Ação'),true);
assert.equal(facets.groups.some(x=>x.key==='Terror'),true);
assert.deepEqual(Array.from(m.movieSourceIds(categories,'Ação','')),['ccdd','0011']);
assert.deepEqual(Array.from(m.movieSourceIds(categories,'Terror','')),['eeff']);
assert.deepEqual(Array.from(m.movieSourceIds(categories,'','')),['aabb'],'Destaques loads one catalog, not all 56k');
assert.deepEqual(Array.from(m.movieSourceIds(categories,'Qualidade','')),['1122']);
assert.deepEqual(Array.from(m.movieSourceIds(categories,'Ação','unknown')),[]);
assert.equal(facets.totalCategories,6);
assert.equal(m.movieSourceDirectory([]).defaultGroup,'');
console.log('STARLINK Samsung final movie source category navigation PASS');
