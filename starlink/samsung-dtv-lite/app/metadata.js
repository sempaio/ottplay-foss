(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.StarlinkMetadata=factory();
})(this,function(){
 'use strict';
 function str(v){return String(v===null||v===undefined?'':v).trim();}
 function decodeXtream(v){
  var value=str(v);
  if(!value||value.length%4||!/^[a-zA-Z0-9+/]+={0,2}$/.test(value)||typeof atob!=='function')
   return value;
  try{
   var bytes=atob(value),encoded='';
   for(var i=0;i<bytes.length;i++)encoded+='%'+('0'+bytes.charCodeAt(i).toString(16)).slice(-2);
   var decoded=decodeURIComponent(encoded).trim();
   return decoded||value;
  }catch(e){return value;}
 }
 function guide(payload,nowMs){
  var rows=payload&&Array.isArray(payload.epg_listings)?payload.epg_listings:[];
  var now=Number(nowMs)||Date.now(),out=[];
  for(var i=0;i<rows.length&&out.length<24;i++){
   var e=rows[i],start=Number(e.start_timestamp)*1000,end=Number(e.stop_timestamp)*1000;
   if(!isFinite(start)||!isFinite(end)||start<=0||end<=start||end<=now)continue;
   var title=decodeXtream(e.title);
   if(!title)continue;
   out.push({title:title,description:decodeXtream(e.description),
    startMs:start,endMs:end,nowPlaying:start<=now&&now<end});
  }
  out.sort(function(a,b){return a.startMs-b.startMs||a.endMs-b.endMs;});
  return out;
 }
 function synopsis(payload,item){
  var info=payload&&payload.info&&typeof payload.info==='object'?payload.info:{};
  var movie=payload&&payload.movie_data&&typeof payload.movie_data==='object'?payload.movie_data:{};
  var description=str(info.plot||info.description||movie.plot||movie.description||(item&&item.description));
  return {
   title:str(info.name||movie.name||(item&&item.title)),
   description:description,
   year:str(info.releaseDate||info.releasedate||movie.releasedate||(item&&item.year)),
   genre:str(info.genre||movie.genre||(item&&item.category))
  };
 }
 // A missing synopsis must be rechecked soon after the M81 metadata source changes.
 // Keep actual descriptions cached for twelve hours to avoid needless requests.
 function synopsisCacheTtl(payload,item){
  return synopsis(payload,item).description?12*60*60*1000:60*1000;
 }
 function cache(max){
  var items={},order=[],limit=Math.max(1,Math.min(100,Number(max)||60));
  return {
   get:function(key,ttlMs,now){
    var entry=items[key];
    if(!entry)return null;
    if((Number(now)||Date.now())-entry.time>(Number(ttlMs)||300000))return null;
    return entry.data;
   },
   put:function(key,data,now){
    if(!Object.prototype.hasOwnProperty.call(items,key)){
     order.push(key);
     if(order.length>limit)delete items[order.shift()];
    }
    items[key]={time:Number(now)||Date.now(),data:data};
   },
   clear:function(){items={};order=[];}
  };
 }
 return {decodeXtream:decodeXtream,guide:guide,synopsis:synopsis,synopsisCacheTtl:synopsisCacheTtl,cache:cache};
});
