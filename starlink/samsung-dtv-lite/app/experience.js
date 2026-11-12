(function(w,d){
'use strict';
// UI-only companion to the validated AVPlay player. No media proxy or transcoding.
var m=w.StarlinkDiscovery,bridge=null,ready=false;
var data={live:[],movie:[],series:[]},raw={live:[],movie:[],series:[]},categoryNames={live:{},movie:{},series:{}};
var loading={},loaded={},failed={},filter='all',search='',history={},interests=[];
var current=null,activeGroup=null,episodes=[],details={},lastStore=0,requested={},episodeRecords={};
var INTERESTS=['Evangélico','Anime','Ação','Aventura','Ficção científica','Documentários','Suspense','Terror','Romance','Clássicos','Lançamentos','Desenhos antigos','Coisas antigas','Brasileiro'];
function el(id){return d.getElementById(id);}
function node(tag,cls,text){
 var n=d.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;
}
function norm(v){var s=String(v||'').toLowerCase();try{return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){return s;}}
function storeKey(kind){return 'starlink-dtv-'+kind+'-v1-'+String(bridge&&bridge.accountKey||'local');}
function read(k,fallback){try{return JSON.parse(w.localStorage.getItem(k))||fallback;}catch(e){return fallback;}}
function store(k,v){try{w.localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function all(){
 var extra=Object.keys(episodeRecords).slice(-40).map(function(k){return episodeRecords[k];})
  .filter(function(e){return e&&m.resumePosition(history,e)>0;});
 return data.live.concat(data.movie,data.series,extra);
}
function active(){return ready && !el('catalog-screen').hidden;}
function status(){
 var text=data.live.length+' canais · '+data.movie.length+' filmes · '+data.series.length+' séries';
 if(loading.movie||loading.series)text+=' · Carregando catálogo...';
 if(failed.movie||failed.series)text+=' · Algumas listas indisponíveis (selecione a aba para tentar novamente)';
 el('experience-status').textContent=text;
}
function init(b){
 if(!m||!b||typeof b.request!=='function')return;
 if(ready){
  if(String(bridge.accountKey)===String(b.accountKey)){bridge=b;return;}
  bridge=b;data={live:[],movie:[],series:[]};raw={live:[],movie:[],series:[]};
  categoryNames={live:{},movie:{},series:{}};loaded={};loading={};failed={};
  activeGroup=null;current=null;currentSeries=null;episodeList=[];details={};
  history=m.safeHistory(read(storeKey('watch-history'),{}));
  interests=read(storeKey('interests'),[]);if(!Array.isArray(interests))interests=[];
  episodeRecords=read(storeKey('episodes'),{});
  if(!episodeRecords||typeof episodeRecords!=='object')episodeRecords={};
  search='';el('stream-search').value='';filter='all';
  el('experience-detail').hidden=true;el('quality-panel').hidden=true;render();return;
 }
 ready=true;bridge=b;el('experience-shell').hidden=false;
 d.body.classList.add('experience-ready');
 history=m.safeHistory(read(storeKey('watch-history'),{}));
 episodeRecords=read(storeKey('episodes'),{});
 if(!episodeRecords||typeof episodeRecords!=='object')episodeRecords={};
 interests=read(storeKey('interests'),[]);
 if(!Array.isArray(interests))interests=[];
 var tabs=el('experience-tabs').querySelectorAll('[data-shelf-filter]');
 for(var i=0;i<tabs.length;i++)tabs[i].onclick=function(){
  filter=this.getAttribute('data-shelf-filter');
  for(var j=0;j<tabs.length;j++)tabs[j].classList.toggle('selected',tabs[j]===this);
  if(filter==='movie'||filter==='series')loadKind(filter);
  if(filter==='for-you'){loadKind('series');loadKind('movie');}
  render();
 };
 var searchEl=el('stream-search'),debounce=null;
 searchEl.oninput=function(){search=searchEl.value.trim();w.clearTimeout(debounce);debounce=w.setTimeout(render,120);};
 el('interest-open').onclick=function(){renderInterests();el('interests-panel').hidden=false;el('interest-done').focus();};
 el('interest-done').onclick=function(){
  var checked=el('interest-options').querySelectorAll('input:checked'),arr=[];
  for(var j=0;j<checked.length;j++)arr.push(checked[j].value);
  interests=arr;store(storeKey('interests'),arr);
  el('interests-panel').hidden=true;render();el('interest-open').focus();
 };
 el('detail-close').onclick=closeDetail;
 el('quality-button').onclick=function(){
  var panel=el('quality-panel');panel.hidden=!panel.hidden;
  if(!panel.hidden){qualityChoices();var first=panel.querySelector('button');if(first)first.focus();}
 };
 d.addEventListener('keydown',function(ev){
  if(ev.keyCode!==10009&&ev.keyCode!==27)return;
  if(!el('quality-panel').hidden){ev.preventDefault();el('quality-panel').hidden=true;el('quality-button').focus();return;}
  if(!el('experience-detail').hidden){ev.preventDefault();closeDetail();}
 },true);
 status();render();
}
function onLiveLoaded(channels,categories){
 if(!ready)return;
 var names={};
 (categories||[]).forEach(function(c){names[String(c.category_id)]=String(c.category_name||'Canais ao vivo');});
 categoryNames.live=names;
 normalizeRows('live',channels||[]);
 loaded.live=true;render();
 // Series summary is smaller; defer large movie load to keep initial navigation quick.
 w.setTimeout(function(){if(ready)loadKind('series');},700);
 w.setTimeout(function(){if(ready)loadKind('movie');},3500);
}
function normalizeRows(kind,rows){
 raw[kind]=rows;
 var names=categoryNames[kind],result=[];
 for(var i=0;i<rows.length;i++){
  var item=m.normalize(kind,rows[i],names[String(rows[i].category_id)]);
  if(item)result.push(item);
 }
 data[kind]=kind==='live'?m.groupLive(result):result;
}
function loadKind(kind){
 if(!ready||loaded[kind]||loading[kind]||!/^(movie|series)$/.test(kind))return;
 loading[kind]=true;delete failed[kind];status();
 var action=kind==='movie'?'get_vod_streams':'get_series';
 var categoriesAction=kind==='movie'?'get_vod_categories':'get_series_categories';
 // Categories never block stream listing (series categories may take >20s).
 bridge.request(categoriesAction,function(rows){
  if(!Array.isArray(rows))return;
  var names={};
  rows.forEach(function(x){names[String(x.category_id)]=String(x.category_name||kind);});
  categoryNames[kind]=names;
  for(var i=0;i<data[kind].length;i++){
   var item=data[kind][i],name=names[item.categoryId];
   if(name)item.category=name;
  }
  render();
 },function(){});
 bridge.request(action,function(rows){
  if(!Array.isArray(rows)){finishError(kind);return;}
  var normalized=[],idx=0,batchSize=450;
  function processBatch(){
   var end=Math.min(rows.length,idx+batchSize);
   for(;idx<end;idx++){
    var item=m.normalize(kind,rows[idx],categoryNames[kind][String(rows[idx].category_id)]);
    if(item)normalized.push(item);
   }
   if(idx<rows.length){w.setTimeout(processBatch,0);return;}
   data[kind]=normalized;loaded[kind]=true;loading[kind]=false;
   status();render();
  }
  w.setTimeout(processBatch,0);
 },function(){finishError(kind);});
}
function finishError(kind){loading[kind]=false;failed[kind]=true;status();render();}
function card(item){
 var btn=node('button','stream-card');btn.type='button';
 btn.setAttribute('data-key',item.key);
 btn.setAttribute('aria-label',item.title+' · '+(item.category||''));
 var cover=node('div','stream-poster');
 if(/^https:\/\//.test(item.image||'')){
  var img=node('img');img.alt='';img.loading='lazy';img.decoding='async';img.src=item.image;
  img.onerror=function(){this.remove();};
  cover.appendChild(img);
 }
 cover.appendChild(node('span','poster-placeholder',item.kind==='live'?'TV':item.kind==='movie'?'FILME':'SÉRIE'));
 cover.appendChild(node('span','kind-chip',item.kind==='live'?'AO VIVO':item.kind==='movie'?'FILME':'SÉRIE'));
 btn.appendChild(cover);btn.appendChild(node('span','card-name',item.title));
 var progress=m.safeHistory(history)[item.key];
 if(progress){
  var bar=node('span','watch-progress'),fill=node('span','watch-progress-fill');
  fill.style.width=Math.round(progress.positionMs/progress.durationMs*100)+'%';
  bar.appendChild(fill);btn.appendChild(bar);
 }
 btn.onclick=function(){openItem(item);};
 return btn;
}
function render(){
 if(!ready)return;
 status();
 var target=el('experience-rails');target.textContent='';
 var list=all(),groups=[],q=norm(search);
 if(q.length>=2)groups=[{key:'search',title:'Resultados da busca',items:list.filter(function(item){
  return norm(item.title+' '+item.category).indexOf(q)>=0;
 }).slice(0,80)}];
 else{
  groups=m.shelves(list,{history:history,interests:interests});
  if(filter==='for-you')groups=groups.filter(function(x){return x.key==='continue'||x.key==='for-you';});
  else if(filter!=='all')groups=groups.filter(function(x){return x.key==='continue'||x.key===filter||x.key.indexOf(filter+':')===0;});
 }
 var count=0;
 groups.slice(0,22).forEach(function(group){
  if(!group.items||!group.items.length)return;
  var rail=node('section','stream-rail'),strip=node('div','stream-strip');
  rail.appendChild(node('h2','rail-title',group.title));
  group.items.slice(0,26).forEach(function(item){strip.appendChild(card(item));});
  rail.appendChild(strip);target.appendChild(rail);count++;
 });
 if(!count)target.appendChild(node('p','empty-rail','Carregando conteúdos ou nenhum resultado encontrado.'));
}
function renderInterests(){
 var root=el('interest-options');root.textContent='';
 INTERESTS.forEach(function(name){
  var label=node('label','interest-chip'),input=node('input');
  input.type='checkbox';input.value=name;input.checked=interests.indexOf(name)>=0;
  label.appendChild(input);label.appendChild(node('span','',name));root.appendChild(label);
 });
}
function openItem(item){
 if(item.kind==='series'){openSeries(item);return;}
 if(item.kind==='live'){
  activeGroup=item;
  playQuality(m.chooseQuality(item,'auto'),'auto');
  return;
 }
 activeGroup=null;bridge.play(item);
}
function playQuality(item,mode){
 if(!item)return;
 el('quality-panel').hidden=true;
 currentQuality=mode||'auto';
 bridge.play(item);
}
var currentQuality='auto';
function onPlaybackStart(item){
 current=item;
 if(item&&item.kind==='episode'){
  episodeRecords[item.key]={
   kind:'episode',key:item.key,id:item.id,title:item.name||item.title||'Episódio',
   seriesKey:item.seriesKey||'',seriesTitle:item.seriesTitle||'',
   extension:item.extension||'ts',image:item.image||'',category:item.category||'Séries'
  };
  var ids=Object.keys(episodeRecords);
  for(var i=0;i<ids.length-45;i++)delete episodeRecords[ids[i]];
  store(storeKey('episodes'),episodeRecords);
 }
 el('quality-panel').hidden=true;
 var button=el('quality-button');
 var isLive=item&&item.kind==='live';
 button.hidden=!isLive;
 button.textContent=isLive?'Qualidade: '+(currentQuality==='auto'?'Automática':currentQuality):'Qualidade';
}
function qualityChoices(){
 var root=el('quality-options');root.textContent='';
 if(!activeGroup||!current||current.kind!=='live'){
  root.appendChild(node('p','empty-rail','Escolha um canal para ver as qualidades disponíveis.'));return;
 }
 var choices=[{key:'auto',label:'Automática (HLS, se disponível)'}];
 (activeGroup.qualities||[]).forEach(function(q){
  if(q.quality!=='Original'&&!choices.some(function(x){return x.key===q.quality;}))
   choices.push({key:q.quality,label:q.quality});
 });
 if(choices.length===1)choices.push({key:'original',label:'Qualidade original'});
 choices.forEach(function(entry){
  var btn=node('button','quality-choice',entry.label);
  btn.type='button';btn.onclick=function(){
   var selected=entry.key==='original'?m.chooseQuality(activeGroup,'auto'):
    m.chooseQuality(activeGroup,entry.key);
   playQuality(selected,entry.key==='original'?'auto':entry.key);
  };
  root.appendChild(btn);
 });
}
function closeDetail(){
 el('experience-detail').hidden=true;
 if(currentSeries){
  var button=el('experience-rails').querySelector('[data-key="'+currentSeries.key+'"]');
  if(button)button.focus();
 }
}
var currentSeries=null,episodeList=[];
function openSeries(series){
 currentSeries=series;el('experience-detail').hidden=false;
 var content=el('detail-content');content.textContent='';
 content.appendChild(node('h2','detail-heading',series.title));
 content.appendChild(node('p','detail-copy',series.description||series.category));
 el('season-buttons').textContent='';el('episode-list').textContent='';
 if(series.episodeStatus==='pending'||series.episodeStatus==='ambiguous'){
  el('episode-list').appendChild(node('p','empty-rail','Temporadas ainda não disponíveis na lista.'));return;
 }
 function showDetail(detail){
  episodeList=m.episodesFromDetail(detail,series);
  var seasons=[],seen={};
  episodeList.forEach(function(e){if(!seen[e.season]){seen[e.season]=true;seasons.push(e.season);}});
  var buttons=el('season-buttons');buttons.textContent='';
  function showSeason(season){
   var target=el('episode-list');target.textContent='';
   episodeList.filter(function(e){return e.season===season;}).forEach(function(e){
    var btn=node('button','episode-button','E'+e.episode+' · '+e.title);
    btn.onclick=function(){activeGroup=null;el('experience-detail').hidden=true;bridge.play(e);};
    target.appendChild(btn);
   });
  }
  seasons.forEach(function(s){
   var btn=node('button','season-button','Temporada '+s);
   btn.onclick=function(){showSeason(s);};buttons.appendChild(btn);
  });
  if(seasons.length)showSeason(seasons[0]);
  else el('episode-list').appendChild(node('p','empty-rail','Nenhum episódio reproduzível encontrado.'));
 }
 if(details[series.key]){showDetail(details[series.key]);return;}
 el('episode-list').appendChild(node('p','empty-rail','Carregando temporadas e episódios...'));
 bridge.request('get_series_info',function(data){
  details[series.key]=data||{};
  if(currentSeries&&currentSeries.key===series.key)showDetail(data);
 },function(){el('episode-list').textContent='Não foi possível carregar episódios.';},{series_id:series.id});
}
function progress(item,ms,duration){
 if(!item||!(/^(movie|episode)$/.test(item.kind))||duration<=0)return;
 var now=Date.now();if(now-lastStore<6000)return;
 lastStore=now;
 history=m.rememberProgress(history,item,ms,duration,now);
 store(storeKey('watch-history'),history);
}
function resume(item){return m.resumePosition(history,item);}
function ended(item){
 if(!item)return;
 if(item.kind==='episode'){
  var next=m.nextEpisode(episodeList,item);
  if(next){bridge.play(next);return;}
 }
}
w.StarlinkExperience={init:init,onLiveLoaded:onLiveLoaded,onPlaybackStart:onPlaybackStart,
 onPlaybackProgress:progress,onPlaybackEnd:ended,resumePosition:resume,
 active:function(){return ready;},render:render,loading:function(){return loading;}};
})(window,document);
