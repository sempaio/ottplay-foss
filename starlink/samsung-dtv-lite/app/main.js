(function(w,d){
'use strict';
var BASE='https://panel.taila5c5c2.ts.net';
var core=w.StarlinkLiteCore;
var state={username:'',password:'',categories:[],channels:[],visible:[],culture:null,current:null,events:0,lastTime:-1,playStart:0,playing:false,logged:false};
var av=w.webapis&&w.webapis.avplay;
function byId(id){return d.getElementById(id);}
function text(id,msg){byId(id).textContent=String(msg);}
function log(msg){text(state.playing?'video-status':'catalog-status',msg);console.log('STARLINK_LITE_QA '+msg);}
function page(name){
 var sections=['login-screen','catalog-screen','player-screen'];
 for(var i=0;i<sections.length;i++)byId(sections[i]).hidden=sections[i]!==name;
 d.body.className=name==='player-screen'?'playing':'';
 d.documentElement.className=name==='player-screen'?'playing':'';
}
function request(action,success,fail){
 var xhr=new XMLHttpRequest();
 var url=BASE+'/player_api.php?username='+encodeURIComponent(state.username)+'&password='+encodeURIComponent(state.password);
 if(action)url+='&action='+encodeURIComponent(action);
 xhr.open('GET',url,true);
 xhr.timeout=20000;
 xhr.onload=function(){
  var obj=null;
  try{obj=JSON.parse(xhr.responseText);}catch(e){fail('Resposta incompatível');return;}
  if(xhr.status===200)success(obj);
  else fail('HTTP '+xhr.status);
 };
 xhr.onerror=function(){fail('Falha de rede');};
 xhr.ontimeout=function(){fail('Tempo esgotado');};
 xhr.send();
}
function login(evt){
 if(evt)evt.preventDefault();
 state.username=byId('username').value.trim();
 state.password=byId('password').value;
 if(!state.username||!state.password){text('login-status','Preencha usuário e senha.');return;}
 text('login-status','Verificando sua conta Xtream...');
 request('',function(data){
  if(!core.isValidAccount(data)){text('login-status','Usuário, senha ou conta não autorizada.');return;}
  state.logged=true;
  byId('password').value='';
  page('catalog-screen');
  text('catalog-status','Carregando categorias e canais do M81...');
  loadCatalog();
 },function(err){text('login-status','Não foi possível entrar: '+err);});
}
function loadCatalog(){
 request('get_live_categories',function(categories){
  if(!Array.isArray(categories)){text('catalog-status','Categorias inválidas.');return;}
  state.categories=categories;
  request('get_live_streams',function(channels){
   if(!Array.isArray(channels)){text('catalog-status','Catálogo inválido.');return;}
   state.channels=channels;
   state.culture=core.pickTestChannel(channels);
   var preferred=null;
   for(var i=0;i<channels.length;i++){
    if(String(channels[i].name||'').toLowerCase().indexOf('tv brasil (720p)')>=0){preferred=channels[i];break;}
   }
   text('catalog-count',categories.length+' categorias · '+channels.length+' canais');
   text('catalog-status','Catálogo Xtream recebido. Reprodução nativa Samsung AVPlay.');
   renderCategories();showCategory('');
   if(preferred||state.culture){w.setTimeout(function(){play(preferred||state.culture);},700);}
  },function(err){text('catalog-status','Falha ao carregar canais: '+err);});
 },function(err){text('catalog-status','Falha ao carregar categorias: '+err);});
}
function selectable(root,items,selected,onSelect,classname){
 root.textContent='';
 for(var i=0;i<items.length;i++){
  (function(item){
   var el=d.createElement('div');
   el.className=classname+(item.id===selected?' selected':'');
   el.tabIndex=0;
   el.textContent=item.title;
   el.onclick=function(){onSelect(item.id);};
   el.onkeydown=function(ev){if(ev.keyCode===13){ev.preventDefault();onSelect(item.id);}};
   root.appendChild(el);
  })(items[i]);
 }
}
function renderCategories(){
 var rows=[{id:'',title:'Todos os canais'}];
 for(var i=0;i<state.categories.length;i++){
  var c=state.categories[i];
  rows.push({id:String(c.category_id),title:String(c.category_name||'Categoria')});
 }
 state.categoryRows=rows;
}
function showCategory(id){
 state.activeCategory=id;
 selectable(byId('categories'),state.categoryRows,id,showCategory,'category');
 var channels=id?state.channels.filter(function(c){return String(c.category_id)===id;}):state.channels;
 state.visible=channels;
 var rows=[];
 for(var i=0;i<Math.min(180,channels.length);i++)rows.push({id:String(channels[i].stream_id),title:channels[i].name||('Canal '+channels[i].stream_id)});
 selectable(byId('channels'),rows,'',function(streamId){
  for(var j=0;j<channels.length;j++){if(String(channels[j].stream_id)===streamId){play(channels[j]);break;}}
 },'channel');
}
function stop(){
 if(!av)return;
 try{av.stop();}catch(e){}
 try{av.close();}catch(e){}
 state.playing=false;
}
function videoStatus(msg){text('video-status',msg);console.log('STARLINK_AVPLAY '+msg);}
function play(item,publicSample){
 if(!state.logged)return;
 stop();state.current=item;state.events=0;state.lastTime=-1;state.playStart=Date.now();state.playing=true;
 page('player-screen');
 text('now-playing',publicSample?'Vídeo público de diagnóstico':'M81 · '+String(item.name||'Canal'));
 text('video-timer','Aguardando quadros e progresso temporal...');
 if(!av){videoStatus('ERRO: API Samsung AVPlay indisponível no emulador');return;}
 var url;
 try{url=publicSample?'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8':core.streamUrl(BASE,state.username,state.password,item);}
 catch(e){videoStatus('Erro na URL do canal');return;}
 try{
  videoStatus('Abrindo vídeo com Samsung AVPlay...');
  av.open(url);
  av.setDisplayRect(0,0,1920,1080);
  av.setListener({
   onbufferingstart:function(){videoStatus('Carregando vídeo...');},
   onbufferingprogress:function(percent){if(percent%20===0)videoStatus('Buffer '+percent+'%');},
   onbufferingcomplete:function(){videoStatus('Buffer concluído');},
   oncurrentplaytime:function(ms){
    state.events++;
    if(ms>state.lastTime){state.lastTime=ms;text('video-timer','Tempo '+(ms/1000).toFixed(1)+' s · '+state.events+' eventos');videoStatus('Reprodução em andamento');}
   },
   onstreamcompleted:function(){videoStatus('Vídeo concluído');},
   onerror:function(err){videoStatus('Erro AVPlay: '+String(err));},
   onerrormsg:function(err,msg){videoStatus('Erro AVPlay: '+String(err)+' '+String(msg));}
  });
  av.prepareAsync(function(){try{av.play();videoStatus('Play acionado; verificando movimento...');}catch(err){videoStatus('Falha ao iniciar: '+err.message);}},function(err){videoStatus('Falha ao preparar vídeo: '+String(err));});
 }catch(err){videoStatus('Falha ao abrir transmissão: '+err.message);}
}
function back(){stop();page('catalog-screen');text('catalog-status','Pronto para selecionar outro canal.');}
function logout(){stop();state.username='';state.password='';state.logged=false;state.channels=[];state.categories=[];state.culture=null;byId('username').value='';byId('password').value='';page('login-screen');text('login-status','Sessão encerrada.');}
byId('login-form').onsubmit=login;
byId('back-button').onclick=back;
byId('exit-button').onclick=logout;
byId('culture-button').onclick=function(){if(state.culture)play(state.culture);};
byId('public-demo-button').onclick=function(){play({name:'Teste HLS público',stream_id:0},true);};
d.addEventListener('keydown',function(ev){
 if(state.playing&&(ev.keyCode===10009||ev.keyCode===27)){ev.preventDefault();back();}
 if(state.logged&&!state.playing&&ev.keyCode===406){logout();}
},true);
w.__starlinkLiteQA={snapshot:function(){return {logged:state.logged,channels:state.channels.length,playing:state.playing,events:state.events,timeMs:state.lastTime,channel:state.current&&state.current.name};}};
text('login-status','Digite sua conta M81. Servidor pré-configurado. Nenhuma senha é armazenada.');
})(window,document);
