(function(root,factory){
 if(typeof module==='object' && module.exports)module.exports=factory();
 else root.StarlinkDiscovery=factory();
})(this,function(){
 'use strict';
 function val(v){return String(v===undefined||v===null?'':v);}
 function norm(v){var s=val(v).toLowerCase();try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}return s;}
 function validId(n){return /^\d+$/.test(val(n));}
 function ext(v,fallback){
  var s=norm(v);
  return /^(m3u8|ts|mp4|mkv|avi|m4v|webm)$/.test(s)?s:(fallback||'ts');
 }
 function normalize(kind,row,category){
  if(!row||!(/^(live|movie|series)$/.test(kind)))return null;
  var id=kind==='series'?row.series_id:row.stream_id;
  if(!validId(id))return null;
  var title=val(row.name||row.title).trim();
  if(!title)return null;
  var categoryName=val(category||row.category_name||'Sem categoria');
  return {
   key:kind+':'+id,kind:kind,id:val(id),title:title,
   category:categoryName,categoryId:val(row.category_id||''),
   image:val(row.stream_icon||row.cover||row.movie_image||''),
   backdrop:val(row.backdrop_path||row.backdrop||''),
   description:val(row.plot||row.description||''),
   extension:ext(row.container_extension,kind==='live'?'m3u8':'mp4'),
   seasonCount:Number(row.season_count)||0,
   episodeStatus:val(row.episode_metadata||''),
   is24h:kind==='live'&&/24\s*h|series 24h|séries 24h/i.test(title+' '+categoryName)
  };
 }
 function normalizeEpisode(e,parent){
  if(!e||!validId(e.id)||!parent||parent.kind!=='series')return null;
  return {key:'episode:'+e.id,id:val(e.id),kind:'episode',
   seriesKey:parent.key,seriesTitle:parent.title,title:val(e.title||e.info&&e.info.name||'Episódio'),
   category:parent.category,image:parent.image,
   season:Number(e.season)||1,episode:Number(e.episode_num)||1,
   extension:ext(e.container_extension,'ts')};
 }
 function episodesFromDetail(detail,parent){
  if(!detail||!detail.episodes)return [];
  var list=[],groups=detail.episodes,keys=Object.keys(groups);
  for(var i=0;i<keys.length;i++){
   var rows=groups[keys[i]];
   if(!Array.isArray(rows))continue;
   for(var j=0;j<rows.length;j++){
    var item=normalizeEpisode(rows[j],parent);
    if(item)list.push(item);
   }
  }
  return list.sort(function(a,b){return a.season-b.season||a.episode-b.episode;});
 }
 function nextEpisode(episodes,now){
  if(!now||!Array.isArray(episodes))return null;
  for(var i=0;i<episodes.length-1;i++)if(episodes[i].key===now.key)return episodes[i+1];
  return null;
 }
 function playbackUrl(origin,user,password,item){
  if(!/^https:\/\/[^\/?#]+$/.test(val(origin)))throw new Error('Invalid origin');
  if(!item||!validId(item.id))throw new Error('Invalid stream');
  var path={live:'live',movie:'movie',episode:'series'}[item.kind];
  if(!path)throw new Error('No direct stream for this content');
  return origin+'/'+path+'/'+encodeURIComponent(user)+'/'+encodeURIComponent(password)+'/'+item.id+'.'+ext(item.extension,item.kind==='live'?'m3u8':'ts');
 }
 function safeHistory(obj){
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return {};
  var result={},keys=Object.keys(obj).slice(-100);
  for(var i=0;i<keys.length;i++){
   var k=keys[i],v=obj[k];
   if(!/^(movie|episode|series):\d+$/.test(k)||!v)continue;
   if(!(Number(v.positionMs)>0)||!(Number(v.durationMs)>0))continue;
   result[k]={positionMs:Math.floor(Number(v.positionMs)),durationMs:Math.floor(Number(v.durationMs)),updatedAt:Math.floor(Number(v.updatedAt)||0)};
  }
  return result;
 }
 function rememberProgress(history,item,position,duration,when){
  var result=safeHistory(history);
  if(!item||!/^(movie|episode)$/.test(item.kind))return result;
  var pos=Math.max(0,Math.floor(Number(position)||0)),total=Math.max(0,Math.floor(Number(duration)||0));
  if(!total||!pos)return result;
  if(pos/total>=0.95){delete result[item.key];return result;}
  result[item.key]={positionMs:pos,durationMs:total,updatedAt:Math.floor(Number(when)||0)};
  return result;
 }
 function resumePosition(history,item){
  if(!item||!(/^(movie|episode)$/.test(item.kind)))return 0;
  var h=safeHistory(history)[item.key];
  return h&&h.positionMs/h.durationMs<0.95?h.positionMs:0;
 }
 function continueItems(items,history){
  var map=safeHistory(history);
  return (items||[]).filter(function(x){return x&&!!map[x.key]&&(/^(movie|episode)$/.test(x.kind));})
   .sort(function(a,b){return map[b.key].updatedAt-map[a.key].updatedAt;});
 }
 function interestsList(interests){return (Array.isArray(interests)?interests:[]).map(norm).filter(Boolean).slice(0,16);}
 function relevance(item,interests,history){
  var tokens=interestsList(interests),text=norm(item.title+' '+item.category+' '+item.description),score=0;
  for(var i=0;i<tokens.length;i++)if(text.indexOf(tokens[i])>=0)score+=7;
  if(item.kind==='movie'||item.kind==='series')score+=1;
  var h=safeHistory(history);
  if(h[item.key])score+=3;
  return score;
 }
 function recommend(items,interests,history,limit){
  var source=(items||[]).filter(Boolean).slice();
  source.sort(function(a,b){
   var score=relevance(b,interests,history)-relevance(a,interests,history);
   if(score)return score;
   return a.key<b.key?-1:a.key>b.key?1:0;
  });
  return source.slice(0,Math.min(100,Math.max(0,Number(limit)||20)));
 }
 function shelves(items,options){
  options=options||{};
  var source=(items||[]).filter(Boolean),history=options.history||{}, interests=options.interests||[];
  var byKind=function(k){return source.filter(function(x){return x.kind===k;});};
  var result=[],continuing=continueItems(source,history).slice(0,20);
  if(continuing.length)result.push({key:'continue',title:'Continuar assistindo',items:continuing});
  var suggested=recommend(source,interests,history,24);
  if(suggested.length)result.push({key:'for-you',title:'Para você',items:suggested});
  var kinds=[['live','Canais ao vivo'],['movie','Filmes'],['series','Séries']];
  for(var i=0;i<kinds.length;i++){
   var kind=kinds[i][0],group=byKind(kind);
   if(group.length)result.push({key:kind,title:kinds[i][1],items:group.slice(0,24)});
  }
  var cats={},keys=[];
  for(var j=0;j<source.length;j++){
   var item=source[j],name=item.category;
   var tag=norm(name);
   if(!name||tag==='sem categoria'||tag==='variedade')continue;
   // Keep categorization errors from presenting 'Filmes' inside a series page.
   if((item.kind==='series'&&tag==='filmes')||
      (item.kind==='movie'&&(tag==='series'||tag==='serie')))continue;
   var id=item.kind+':'+norm(name);
   if(!cats[id]){cats[id]={key:id,title:name,items:[]};keys.push(id);}
   if(cats[id].items.length<20)cats[id].items.push(item);
  }
  for(var k=0;k<keys.length;k++)if(cats[keys[k]].items.length>=2)result.push(cats[keys[k]]);
  return result;
 }
 // The identity includes network, region and channel number.
 // Strip ONLY trailing resolution markers, never seasons, regions or brand suffixes.
 function qualityLabel(title){
  var t=norm(title).trim();
  var m=t.match(/(?:\s+|\s*\(\s*)(fhd|full\s*hd|1080p|hd|720p|sd|480p|360p)\s*\)?$/i);
  if(!m)return 'Original';
  var q=m[1];return q==='fhd'||q==='full hd'||q==='1080p'?'FHD':
   q==='hd'||q==='720p'?'HD':'SD';
 }
 function stationName(title){
  var t=val(title).trim();
  return t.replace(/(?:\s+|\s*\(\s*)(?:FHD|FULL\s*HD|1080p|HD|720p|SD|480p|360p)\s*\)?$/i,'').trim()||t;
 }
 function groupLive(items){
  var groups=[],byName={};
  (items||[]).forEach(function(item){
   if(!item||item.kind!=='live')return;
   var quality=qualityLabel(item.title),name=stationName(item.title);
   // A label without resolution is not proof that two URLs represent one channel.
   var groupKey=quality==='Original'?'single:'+item.key:'station:'+norm(name);
   var found=byName[groupKey];
   if(!found){
    found={key:item.key,kind:'live',id:item.id,title:name,category:item.category,
     categoryId:item.categoryId,image:item.image,extension:item.extension,qualities:[],
     is24h:item.is24h};
    byName[groupKey]=found;groups.push(found);
   }
   found.qualities.push({quality:quality,item:item});
  });
  return groups;
 }
 function chooseQuality(group,quality){
  if(!group||!group.qualities||!group.qualities.length)return group;
  if(!quality||quality==='auto')return group.qualities[0].item;
  for(var i=0;i<group.qualities.length;i++)
   if(group.qualities[i].quality===quality)return group.qualities[i].item;
  return group.qualities[0].item;
 }
 return {normalize:normalize,normalizeEpisode:normalizeEpisode,episodesFromDetail:episodesFromDetail,
  nextEpisode:nextEpisode,playbackUrl:playbackUrl,rememberProgress:rememberProgress,
  resumePosition:resumePosition,continueItems:continueItems,recommend:recommend,
  shelves:shelves,safeHistory:safeHistory,qualityLabel:qualityLabel,stationName:stationName,
  groupLive:groupLive,chooseQuality:chooseQuality};
});