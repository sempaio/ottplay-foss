(function(w,d){
'use strict';
var BASE='https://panel.taila5c5c2.ts.net';
var core=w.StarlinkLiteCore;
var state={username:'',password:'',categories:[],channels:[],visible:[],culture:null,current:null,events:0,lastTime:-1,playStart:0,playing:false,logged:false,generation:0,bufferStarts:0,bufferingSince:0,bufferTotalMs:0,remembered:false,lastAdvanceAt:0,stableAt:0,progressEvents:0,retryCount:0,publicSample:false,preparingSince:0,loginAttemptId:0,loginRetryCount:0};
var av=w.webapis&&w.webapis.avplay;
var LOGIN_KEY='starlink-dtv-qa032-remembered-account';
function clearSavedLogin(){try{w.localStorage.removeItem(LOGIN_KEY);}catch(_e){}}
function readSavedLogin(){
 try{
  var v=JSON.parse(w.localStorage.getItem(LOGIN_KEY)||'null');
  return v&&v.username&&v.password&&v.version===1?v:null;
 }catch(_e){return null;}
}
function saveLogin(){
 try{w.localStorage.setItem(LOGIN_KEY,JSON.stringify({version:1,username:state.username,password:state.password}));}
 catch(_e){text('login-status','Conta conectada; nao foi possivel memorizar o login nesta TV.');}
}
function byId(id){return d.getElementById(id);}
var remoteKeyboardField=null,remoteKeyboardUpper=false;
var REMOTE_KEYBOARD_CHARS="abcdefghijklmnopqrstuvwxyz0123456789@._-!#$%&*+?/=,;:()[]{}'\"^~"+String.fromCharCode(92)+"|";
function closeRemoteKeyboard(){
 byId('login-keyboard').hidden=true;
 var target=remoteKeyboardField;
 remoteKeyboardField=null;
 if(target)byId(target==='username'?'password-keyboard':'login-button').focus();
}
function renderRemoteKeyboard(){
 var area=byId('keyboard-keys');
 area.textContent='';
 for(var i=0;i<REMOTE_KEYBOARD_CHARS.length;i++){
  var ch=REMOTE_KEYBOARD_CHARS.charAt(i),button=d.createElement('button');
  button.type='button';button.className='tv-key';
  button.textContent=remoteKeyboardUpper?ch.toUpperCase():ch;
  button.setAttribute('data-tv-key',ch);
  button.onclick=(function(letter){return function(){
   var target=byId(remoteKeyboardField);
   if(target && target.value.length<Number(target.maxLength || 100))
    target.value+=remoteKeyboardUpper?letter.toUpperCase():letter;
  };})(ch);
  area.appendChild(button);
 }
 var cmds=[['shift',remoteKeyboardUpper?'minusculas':'MAIUSCULAS'],
           ['back','Apagar'],['space','Espaco'],['done','Concluir']];
 for(var j=0;j<cmds.length;j++){
  var b=d.createElement('button');b.type='button';b.className='tv-key tv-key-command';
  b.id='keyboard-'+cmds[j][0];b.textContent=cmds[j][1];b.setAttribute('data-tv-key',cmds[j][0]);
  b.onclick=(function(command){return function(){
   if(command==='shift'){remoteKeyboardUpper=!remoteKeyboardUpper;renderRemoteKeyboard();byId('keyboard-shift').focus();return;}
   if(command==='done'){closeRemoteKeyboard();return;}
   var input=byId(remoteKeyboardField);
   if(!input)return;
   if(command==='back')input.value=input.value.slice(0,-1);
   else if(input.value.length<Number(input.maxLength || 100))input.value+=' ';
  };})(cmds[j][0]);
  area.appendChild(b);
 }
}
function openRemoteKeyboard(field){
 if(state.logged)return;
 remoteKeyboardField=field;
 remoteKeyboardUpper=false;
 byId('keyboard-title').textContent=field==='username'?'Digitar usuario':'Digitar senha';
 renderRemoteKeyboard();
 byId('login-keyboard').hidden=false;
 var first=byId('keyboard-keys').firstElementChild;
 if(first)first.focus();
}

function text(id,msg){byId(id).textContent=String(msg);}
function log(msg){text(state.playing?'video-status':'catalog-status',msg);console.log('STARLINK_LITE_QA '+msg);}
function page(name){
 var sections=['login-screen','catalog-screen','player-screen'];
 for(var i=0;i<sections.length;i++)byId(sections[i]).hidden=sections[i]!==name;
 d.body.className=name==='player-screen'?'playing':'';
 d.documentElement.className=name==='player-screen'?'playing':'';
 if(name==='player-screen')byId('back-button').focus();
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
function login(evt,restored){
 if(evt)evt.preventDefault();
 if(!restored)state.loginRetryCount=0;
 var attempt=++state.loginAttemptId;
 state.username=byId('username').value.trim();
 state.password=byId('password').value;
 if(!state.username||!state.password){text('login-status','Preencha usuário e senha.');return;}
 text('login-status','Verificando sua conta Xtream...');
 request('',function(data){
  if(attempt!==state.loginAttemptId)return;
  if(!core.isValidAccount(data)){if(restored)clearSavedLogin();text('login-status','Usuário, senha ou conta não autorizada.');return;}
  state.logged=true;
  state.loginRetryCount=0;
  if(byId('remember-login').checked)saveLogin();else clearSavedLogin();
  byId('password').value='';
  page('catalog-screen');
  text('catalog-status','Carregando categorias e canais do M81...');
  loadCatalog();
 },function(err){
  if(attempt!==state.loginAttemptId)return;
  if(restored && core.isTransientLoginFailure(err) && state.loginRetryCount<3){
   state.loginRetryCount++;
   var tries=state.loginRetryCount;
   text('login-status','Rede instavel ('+err+'). Reconectando automaticamente: '+tries+'/3.');
   w.setTimeout(function(){if(!state.logged&&attempt===state.loginAttemptId)login(null,true);},tries*4000);
   return;
  }
  text('login-status','Não foi possível entrar: '+err);
 });
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
   var firstCat=byId('categories').firstElementChild;if(firstCat)firstCat.focus();
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
 // Invalida callbacks de prepareAsync e eventos AVPlay de transmissões anteriores.
 state.generation++;
 state.playing=false;
 state.preparingSince=0;
 if(!av)return;
 try{av.stop();}catch(e){}
 try{av.close();}catch(e){}
}
function videoStatus(msg){text('video-status',msg);console.log('STARLINK_AVPLAY '+msg);}
function play(item,publicSample,retryCount){
 if(!state.logged)return;
 stop();state.current=item;state.events=0;state.lastTime=-1;state.playStart=Date.now();state.playing=true;state.bufferStarts=0;state.bufferingSince=0;state.bufferTotalMs=0;state.retryCount=retryCount||0;state.progressEvents=0;state.lastAdvanceAt=Date.now();state.stableAt=0;state.publicSample=!!publicSample;state.preparingSince=0;
 var playbackGeneration=state.generation;
 function isCurrentPlayback(){return state.playing&&state.logged&&state.generation===playbackGeneration;}
 page('player-screen');
 byId('retry-button').hidden=true;
 text('now-playing',publicSample?'Vídeo público de diagnóstico':'M81 · '+String(item.name||'Canal'));
 text('video-timer','Aguardando quadros e progresso temporal...');
 if(!av){videoStatus('ERRO: API Samsung AVPlay indisponível no emulador');return;}
 var url;
 try{url=publicSample?'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4':core.streamUrl(BASE,state.username,state.password,item);}
 catch(e){videoStatus('Erro na URL do canal');return;}
 try{
  videoStatus('Abrindo vídeo com Samsung AVPlay...');
  av.open(url);
  // Samsung permite ajustar o buffer somente no estado IDLE, após open e antes de prepareAsync.
  if(typeof av.setBufferingParam==='function'){
   try{
    av.setBufferingParam('PLAYER_BUFFER_FOR_PLAY','PLAYER_BUFFER_SIZE_IN_SECOND',5);
    av.setBufferingParam('PLAYER_BUFFER_FOR_RESUME','PLAYER_BUFFER_SIZE_IN_SECOND',12);
   }catch(e){console.warn('STARLINK_AVPLAY buffering configuration unavailable',e.name||'error');}
  }
  if(typeof av.setTimeoutForBuffering==='function'){
   try{av.setTimeoutForBuffering(10);}catch(e){console.warn('STARLINK_AVPLAY buffering timeout unavailable',e.name||'error');}
  }
  av.setDisplayRect(0,0,1920,1080);
  av.setListener({
   onbufferingstart:function(){if(!isCurrentPlayback())return;state.bufferStarts++;if(!state.bufferingSince)state.bufferingSince=Date.now();videoStatus('Carregando vídeo... (buffer '+state.bufferStarts+')');},
   onbufferingprogress:function(percent){if(isCurrentPlayback()&&percent%20===0)videoStatus('Buffer '+percent+'%');},
   onbufferingcomplete:function(){if(!isCurrentPlayback())return;if(state.bufferingSince){state.bufferTotalMs+=Date.now()-state.bufferingSince;state.bufferingSince=0;}state.lastAdvanceAt=Date.now();videoStatus('Buffer concluído');},
   oncurrentplaytime:function(ms){
    if(!isCurrentPlayback())return;
    state.events++;
    if(ms>state.lastTime){if(state.lastTime>=0&&ms-state.lastTime>250){if(state.bufferingSince){state.bufferTotalMs+=Date.now()-state.bufferingSince;state.bufferingSince=0;}state.progressEvents++;state.lastAdvanceAt=Date.now();if(!state.stableAt)state.stableAt=Date.now();if(Date.now()-state.stableAt>=12000)state.retryCount=0;}state.lastTime=ms;text('video-timer','Tempo '+(ms/1000).toFixed(1)+' s · '+state.events+' eventos');videoStatus('Reprodução em andamento');}
   },
   onstreamcompleted:function(){if(isCurrentPlayback())videoStatus('Vídeo concluído');},
   onerror:function(err){if(isCurrentPlayback())videoStatus('Erro AVPlay: '+String(err));},
   onerrormsg:function(err,msg){if(isCurrentPlayback())videoStatus('Erro AVPlay: '+String(err)+' '+String(msg));}
  });
  state.preparingSince=Date.now();
  videoStatus('Preparando video no decodificador Samsung...');
  av.prepareAsync(function(){
   if(!isCurrentPlayback())return;
   state.preparingSince=0;
   state.lastAdvanceAt=Date.now();
   try{av.play();if(isCurrentPlayback())videoStatus('Play acionado; verificando movimento...');}
   catch(err){if(isCurrentPlayback())videoStatus('Falha ao iniciar: '+err.message);}
  },function(err){if(isCurrentPlayback()){state.preparingSince=0;videoStatus('Falha ao preparar vídeo: '+String(err));}});
 }catch(err){state.preparingSince=0;videoStatus('Falha ao abrir transmissão: '+err.message);}
}
function back(){stop();page('catalog-screen');text('catalog-status','Pronto para selecionar outro canal.');var selected=byId('categories').querySelector('.selected')||byId('categories').firstElementChild;if(selected)selected.focus();}
function logout(){state.loginAttemptId++;if(remoteKeyboardField)closeRemoteKeyboard();clearSavedLogin();stop();state.username='';state.password='';state.logged=false;state.channels=[];state.categories=[];state.culture=null;byId('username').value='';byId('password').value='';page('login-screen');byId('username').focus();text('login-status','Sessão encerrada.');}
byId('login-form').onsubmit=login;
byId('username-keyboard').onclick=function(){openRemoteKeyboard('username');};
byId('password-keyboard').onclick=function(){openRemoteKeyboard('password');};
byId('back-button').onclick=back;
byId('retry-button').onclick=function(){if(state.logged&&state.current)play(state.current,state.publicSample,0);};
byId('exit-button').onclick=logout;
byId('culture-button').onclick=function(){if(state.culture)play(state.culture);};
byId('public-demo-button').onclick=function(){play({name:'Teste HLS público',stream_id:0},true);};
d.addEventListener('keydown',function(ev){
 var key=ev.keyCode;
 if(!byId('login-keyboard').hidden){
  if(key===10009||key===27){ev.preventDefault();closeRemoteKeyboard();return;}
  var keys=byId('keyboard-keys').querySelectorAll('button');
  var index=-1;
  for(var k=0;k<keys.length;k++)if(keys[k]===d.activeElement){index=k;break;}
  if(key===13&&index>=0){ev.preventDefault();keys[index].click();return;}
  if((key===37||key===38||key===39||key===40)&&index>=0){
   ev.preventDefault();
   var delta=key===37?-1:key===39?1:key===38?-10:10;
   var next=Math.max(0,Math.min(keys.length-1,index+delta));
   keys[next].focus();return;
  }
  return;
 }
 if(state.playing&&(key===10009||key===27)){ev.preventDefault();back();return;}
 if(state.logged&&!state.playing&&key===406){logout();return;}
 if(!state.logged||state.playing)return;
 var active=d.activeElement;
 var isCategory=active&&active.classList&&active.classList.contains('category');
 var isChannel=active&&active.classList&&active.classList.contains('channel');
 if(key===39&&isCategory){var first=byId('channels').firstElementChild;if(first){ev.preventDefault();first.focus();}return;}
 if(key===37&&isChannel){var selected=byId('categories').querySelector('.selected')||byId('categories').firstElementChild;if(selected){ev.preventDefault();selected.focus();}return;}
 if((key===38||key===40)&&(isCategory||isChannel)){
  var next=key===40?active.nextElementSibling:active.previousElementSibling;
  if(next){ev.preventDefault();next.focus();try{next.scrollIntoView({block:'nearest'});}catch(e){next.scrollIntoView(false);}}
 }
},true);
w.setInterval(function(){
 if(!state.logged||!state.playing||!state.current||state.publicSample)return;
 if(state.retryCount>=3){
  if(core.isStalled(state,Date.now()) && byId('retry-button').hidden){
   byId('retry-button').hidden=false;
   videoStatus('Canal sem progresso apos 3 reconexoes. Escolha outro canal ou tente novamente.');
  }
  return;
 }
 if(!core.shouldReconnect(state,Date.now()))return;
 var item=state.current,attempt=Math.min(3,state.retryCount+1);
 videoStatus('Reconectando canal apos interrupcao (tentativa '+attempt+')');
 play(item,false,attempt);
},1000);
w.__starlinkLiteQA={snapshot:function(){return {retryCount:state.retryCount,logged:state.logged,channels:state.channels.length,playing:state.playing,events:state.events,timeMs:state.lastTime,channel:state.current&&state.current.name,bufferStarts:state.bufferStarts,bufferTotalMs:state.bufferTotalMs};}};
var remembered=readSavedLogin();
if(remembered){
 byId('username').value=remembered.username;
 byId('password').value=remembered.password;
 byId('remember-login').checked=true;
 text('login-status','Retomando sessao nesta TV...');
 login(null,true);
}
if(!remembered)w.setTimeout(function(){
 if(!state.logged && !byId('login-screen').hidden)byId('username').focus();
},0);
if(!remembered)text('login-status','Digite sua conta M81. Servidor pré-configurado. Ative login automático somente em TV pessoal.');
})(window,document);
