(function (w, d, C, G) {
    'use strict';
    var account = null, kind = 'live', rows = [], categories = [], category = '', stack = [], limit = 60;
    var genreFilter = 'Todos os gêneros', categoryRows = [], searchCache = {}, searchAll = false, searchTimer = null, favoritesView = false, searchPending = false;
    var generation = 0, pending = [], playerGeneration = 0, av = null, hls = null, current = null, lastFocus = null, favorites = [], activeStream = null;
    function el(id) { return d.getElementById(id); }
    function message(text) { el('status').textContent = text; }
    function playerMessage(text) { el('player-status').textContent = text; }
    function safeRead(key, fallback) { try { return JSON.parse(w.localStorage.getItem(key)) || fallback; } catch (_) { return fallback; } }
    function safeSave(key, value) { try { w.localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } }

    var AUTH_KEY = 'starlink-dtv-full-qa034-remembered-login';
    var remoteKeyboardField = null, remoteKeyboardUpper = false;
    var CHARACTERS = "abcdefghijklmnopqrstuvwxyz0123456789@._-!#$%&*+?/=,;:()[]{}'"+String.fromCharCode(34,92)+"|^~";
    function clearRemembered() { try { w.localStorage.removeItem(AUTH_KEY); } catch (_) {} }
    function remembered() {
        var value = safeRead(AUTH_KEY, null);
        return value && value.version === 1 && value.server && value.username && value.password ? value : null;
    }
    function saveRemembered() {
        if (!el('remember').checked) { clearRemembered(); return; }
        safeSave(AUTH_KEY, {version:1,server:account.server,username:account.username,password:account.password});
    }
    function closeKeyboard() {
        el('remote-keyboard').hidden = true;
        var field=remoteKeyboardField;
        remoteKeyboardField=null;
        if (field) el(field === 'username' ? 'keyboard-password' : 'connect').focus();
    }
    function renderKeyboard() {
        var grid=el('keyboard-grid');grid.textContent='';
        for(var i=0;i<CHARACTERS.length;i++) {
            var letter=CHARACTERS.charAt(i), button=d.createElement('button');
            button.type='button';button.textContent=remoteKeyboardUpper?letter.toUpperCase():letter;
            button.setAttribute('data-key',letter);
            button.onclick=(function(ch){return function(){
                var input=el(remoteKeyboardField);
                if(input && input.value.length<100)input.value+=remoteKeyboardUpper?ch.toUpperCase():ch;
            };})(letter);
            grid.appendChild(button);
        }
        [['shift','Maiusculas'],['back','Apagar'],['space','Espaco'],['done','Concluir']].forEach(function(pair) {
            var button=d.createElement('button');button.type='button';button.className='command';
            button.id='key-'+pair[0];button.textContent=pair[1];button.setAttribute('data-key',pair[0]);
            button.onclick=function() {
                if(pair[0]==='shift'){remoteKeyboardUpper=!remoteKeyboardUpper;renderKeyboard();el('key-shift').focus();return;}
                if(pair[0]==='done'){closeKeyboard();return;}
                var input=el(remoteKeyboardField);
                if(!input)return;
                if(pair[0]==='back')input.value=input.value.slice(0,-1);
                else if(input.value.length<100)input.value+=' ';
            };
            grid.appendChild(button);
        });
    }
    function openKeyboard(field) {
        if(el('login').hidden)return;
        remoteKeyboardField=field;remoteKeyboardUpper=false;
        el('keyboard-title').textContent=field==='password'?'Digite a senha':'Digite o usuario';
        renderKeyboard();el('remote-keyboard').hidden=false;
        var first=el('keyboard-grid').firstElementChild;if(first)first.focus();
    }
    function recordProgress(ms) {
        if(!activeStream || !isFinite(ms))return;
        if(activeStream.lastPosition == null){activeStream.lastPosition=ms;return;}
        if(ms > activeStream.lastPosition + 250 || ms < activeStream.lastPosition-1000){
            activeStream.lastPosition=ms;
            activeStream.seenProgress=true;
            activeStream.lastAdvanceAt=Date.now();
            if(!activeStream.healthySince)activeStream.healthySince=Date.now();
            if(Date.now()-activeStream.healthySince>=12000)activeStream.retryCount=0;
        }
    }
    w.setInterval(function(){
        if(el('playback').hidden || !activeStream || activeStream.type!=='live' ||
           activeStream.paused || d.hidden) return;
        var limit=activeStream.retryCount>=3?60000:(activeStream.seenProgress?15000:30000);
        if(Date.now()-activeStream.lastAdvanceAt<limit)return;
        var state=activeStream;
        playerMessage('Reconectando o mesmo canal...');
        startPlayer(state.url,state.row,state.type,Math.min(3,state.retryCount+1));
    },1000);
    function abort() { generation += 1; pending.forEach(function (x) { x.abort(); }); pending = []; }
    function api(action, key, id, done) {
        var owner = generation, x = new XMLHttpRequest();
        x.open('GET', C.query(account, action, key, id), true); x.timeout = 25000;
        pending.push(x);
        function finish(error, data) {
            var index = pending.indexOf(x); if (index >= 0) pending.splice(index, 1);
            if (owner === generation) done(error, data);
        }
        x.onload = function () {
            if (x.status !== 200) return finish('O servidor respondeu HTTP ' + x.status + '. Tente novamente.');
            try { var data = JSON.parse(x.responseText); finish(null, data); }
            catch (_) { finish('Resposta inválida do servidor.'); }
        };
        x.onerror = function () { finish('Falha de conexão. Confira o endereço, a rede e a data da TV.'); };
        x.ontimeout = function () { finish('O servidor demorou a responder. Tente novamente.'); };
        x.send();
    }
    function focusFirst(node) { var b = node.querySelector('button,input'); if (b) b.focus(); }
    function button(text, handler, className) {
        var b = d.createElement('button'); b.type = 'button'; b.textContent = text;
        if (className) b.className = className; b.onclick = handler; return b;
    }
    function title() { return kind === 'live' ? 'Canais ao vivo' : kind === 'vod' ? 'Filmes' : 'Séries'; }
    function favoriteKey(row, type) { return type + ':' + (row.stream_id || row.series_id || row.id || row.direct_source || row.stream_url || row.url); }
    function saveFavorites() { return true; } // Session only: stream URLs can contain credentials.
    function render() {
        var term = el('search').value.toLocaleLowerCase(), list = el('items'); list.textContent = '';
        var filtered = rows.filter(function (r) {
            var nameMatches = String(r.name || r.title || '').toLocaleLowerCase().indexOf(term) >= 0;
            return nameMatches && (kind !== 'series' || favoritesView || stack.length > 0 || term || G.matches(r, genreFilter));
        });
        filtered.slice(0, limit).forEach(function (row) {
            var b = button('', function () { open(row); }, 'item'), label = d.createElement('strong');
            var imageUrl = C.http(row.stream_icon || row.cover || row.movie_image);
            if (imageUrl) { var image = d.createElement('img'); image.src = imageUrl; image.alt = ''; image.loading = 'lazy'; image.onerror = function () { this.style.display = 'none'; }; b.appendChild(image); }
            label.textContent = row.name || row.title || 'Conteúdo'; b.appendChild(label);
            list.appendChild(b);
        });
        el('more').hidden = filtered.length <= limit;
        message(filtered.length ? filtered.length + ' itens · ' + Math.min(limit, filtered.length) + ' exibidos.' : 'Nenhum conteúdo nesta seleção.');
    }
    function renderCategories() {
        var rail = el('categories'); rail.textContent = '';
        if (favoritesView || (kind === 'series' && stack.length)) return;
        if (kind === 'series') {
            G.options(rows).forEach(function (name) {
                var b = button(name, function () {
                    genreFilter = name; limit = 60; el('search').value = '';
                    renderCategories(); render(); focusFirst(el('items'));
                });
                b.setAttribute('aria-pressed', String(name === genreFilter)); rail.appendChild(b);
            });
            return;
        }
        categories.forEach(function (row) {
            var b = button(row.category_name || 'Categoria', function () { loadCategory(row); });
            b.setAttribute('aria-pressed', String(row.category_id) === category ? 'true' : 'false'); rail.appendChild(b);
        });
    }
    function loadCategory(row) {
        abort(); w.clearTimeout(searchTimer); category = String(row.category_id); rows = []; categoryRows = []; searchAll = false; searchPending = false; favoritesView = false; limit = 60; stack = []; el('search').value = '';
        renderCategories(); el('title').textContent = row.category_name || title(); el('items').textContent = ''; message('Carregando categoria…');
        api(C.types[kind][1], 'category_id', category, function (error, data) {
            if (error) return message(error);
            if (!Array.isArray(data)) return message('O servidor não retornou uma lista de conteúdos.');
            rows = data.filter(function (r) { return r && typeof r === 'object' && Number(r.is_adult) !== 1 && Number(r.adult) !== 1; }); categoryRows = rows; render(); focusFirst(el('items'));
        });
    }
    function loadKind(next) {
        abort(); w.clearTimeout(searchTimer);
        kind = next; rows = []; categoryRows = []; categories = []; category = ''; stack = [];
        searchAll = false; searchPending = false; favoritesView = false; genreFilter = 'Todos os gêneros'; limit = 60;
        el('search').value = ''; el('title').textContent = title();
        el('subtitle').textContent = next === 'series' ? 'Séries organizadas por gênero. Escolha o que assistir.' :
            next === 'vod' ? 'Escolha o gênero de filmes que deseja assistir.' : 'Escolha uma categoria para assistir.';
        Array.prototype.forEach.call(d.querySelectorAll('#tabs [data-kind]'), function (b) {
            b.setAttribute('aria-pressed', String(b.getAttribute('data-kind') === kind));
        });
        el('items').textContent = ''; el('categories').textContent = ''; el('more').hidden = true;
        message('Carregando categorias…');
        api(C.types[kind][0], '', '', function (error, data) {
            if (error && kind !== 'series') return message(error);
            if (!Array.isArray(data) && kind !== 'series') return message('Categorias incompatíveis com Xtream.');
            categories = Array.isArray(data) ? data.filter(function (r) {
                return r && r.category_id != null && Number(r.is_adult) !== 1;
            }) : [];
            if (kind === 'series') {
                message('Organizando séries por gênero…');
                api(C.types.series[1], '', '', function (seriesError, seriesData) {
                    if (seriesError) return message(seriesError);
                    if (!Array.isArray(seriesData)) return message('O servidor não retornou séries.');
                    rows = seriesData.filter(function (r) {
                        return r && typeof r === 'object' && Number(r.is_adult) !== 1 && Number(r.adult) !== 1;
                    });
                    rows.forEach(function (r) { r._genres = G.classify(r); });
                    categoryRows = rows;
                    renderCategories(); render(); focusFirst(el('categories'));
                });
                return;
            }
            renderCategories();
            message(categories.length ? 'Escolha uma categoria para carregar.' : 'Nenhuma categoria disponível.');
            focusFirst(el('categories'));
        });
    }
    function playRow(row, type) {
        var url = C.media(account, type, row);
        if (!url) return message('Este conteúdo ainda não tem um endereço de reprodução válido.');
        startPlayer(url, row, type);
    }
    function open(row) {
        if (row._favorite) { kind = row._kind; open(row._row); return; }
        if (kind === 'series' && !row._episode) {
            abort(); message('Carregando temporadas e episódios…');
            api('get_series_info', 'series_id', row.series_id || row.id, function (error, data) {
                if (error) return message(error);
                var episodes = C.episodes(data);
                if (!episodes.length) {
                    var source = C.http(row.direct_source || row.stream_url || row.url) || C.http(data && data.info && (data.info.direct_source || data.info.stream_url || data.info.url));
                    if (source) return startPlayer(source, row, 'series');
                    return message('Esta série não tem episódios nem endereço próprio disponível.');
                }
                stack.push({ rows: rows, title: el('title').textContent, genreFilter: genreFilter });
                rows = episodes.map(function (e) { e._episode = true; return e; }); limit = 60; el('search').value = ''; el('title').textContent = row.name || 'Episódios'; renderCategories(); render(); focusFirst(el('items'));
            });
        } else if (kind === 'vod') {
            abort(); message('Preparando filme…');
            api('get_vod_info', 'vod_id', row.stream_id || row.id, function (error, data) {
                if (error) return message(error);
                var copy = {}; Object.keys(row).forEach(function (key) { copy[key] = row[key]; });
                var detail = data && data.movie_data;
                if (detail && /^[a-zA-Z0-9]{1,10}$/.test(detail.container_extension || '')) copy.container_extension = detail.container_extension;
                if (detail && C.http(detail.direct_source)) copy.direct_source = detail.direct_source;
                playRow(copy, 'vod');
            });
        } else playRow(row, kind);
    }
    function stopPlayer() {
        playerGeneration += 1;
        activeStream = null;
        if (hls) { hls.destroy(); hls = null; }
        if (av) { try { av.stop(); } catch (_) {} try { av.close(); } catch (_) {} av = null; }
        var video = el('video'); video.pause(); video.removeAttribute('src'); video.load();
        el('playback').hidden = true; d.body.classList.remove('playing');
        if (lastFocus && d.body.contains(lastFocus)) lastFocus.focus();
    }
    function startPlayer(url, row, type, retryCount) {
        stopPlayer(); lastFocus = d.activeElement; var owner = playerGeneration;
        activeStream = {url:url,row:row,type:type,retryCount:retryCount||0,
            lastPosition:null,lastAdvanceAt:Date.now(),healthySince:0,seenProgress:!!retryCount,paused:false};
        current = { row: row, kind: type, key: favoriteKey(row, type) };
        el('playback').hidden = false; d.body.classList.add('playing'); el('playing-title').textContent = row.name || row.title || 'Reproduzir conteúdo'; el('playtime').textContent = '';
        playerMessage('Conectando ao conteúdo…'); el('stop').focus();
        el('favorite').textContent = favorites.some(function (f) { return f.key === current.key; }) ? '★ Favorito' : '☆ Favoritar';
        if (w.webapis && w.webapis.avplay) {
            av = w.webapis.avplay; el('video').hidden = true; el('avplayer').hidden = false;
            try {
                av.open(url); av.setDisplayRect(0, 0, 1920, 1080);
                av.setListener({ onbufferingstart: function () { if (owner === playerGeneration) playerMessage('Carregando vídeo…'); }, oncurrentplaytime: function (time) { if (owner === playerGeneration) { el('playtime').textContent = Math.floor(time / 1000) + ' s'; recordProgress(time); playerMessage(''); } }, onstreamcompleted: function () { if (owner !== playerGeneration) return; if (type === 'live') { playerMessage('Canal interrompido; aguardando reconexao automatica.'); } else stopPlayer(); }, onerror: function () { if (owner === playerGeneration) playerMessage('Não foi possível reproduzir este conteúdo na TV. Volte e tente outro.'); } });
                av.prepareAsync(function () { if (owner !== playerGeneration || !av) return; try { av.play(); } catch (_) { playerMessage('Não foi possível iniciar o vídeo.'); } }, function () { if (owner === playerGeneration) playerMessage('O formato ou o endereço do vídeo não pôde ser aberto.'); });
            } catch (_) { playerMessage('O player Samsung não conseguiu abrir este vídeo.'); }
        } else {
            var video = el('video'); video.hidden = false; el('avplayer').hidden = true;
            video.onplaying = function () { if (owner === playerGeneration) playerMessage(''); };
            video.ontimeupdate = function () { if (owner === playerGeneration) el('playtime').textContent = Math.floor(video.currentTime) + ' s'; recordProgress(video.currentTime*1000); };
            video.onerror = function () { if (owner === playerGeneration) playerMessage('O vídeo não pôde ser reproduzido neste navegador.'); };
            video.src = url; var promise = video.play(); if (promise && promise.catch) promise.catch(function () { if (owner === playerGeneration) playerMessage('Pressione Pausar / continuar para iniciar.'); });
        }
    }
    function pause() {
        try { if (av) { if (av.getState() === 'PLAYING') { av.pause(); if(activeStream)activeStream.paused=true; } else if (av.getState() === 'PAUSED') { av.play(); if(activeStream){activeStream.paused=false;activeStream.lastAdvanceAt=Date.now();} } } else { var v = el('video'); if (v.paused) { if(activeStream){activeStream.paused=false;activeStream.lastAdvanceAt=Date.now();} var p = v.play(); if (p && p.catch) p.catch(function () { playerMessage('Não foi possível continuar o vídeo.'); }); } else { v.pause(); if(activeStream)activeStream.paused=true; } } } catch (_) { playerMessage('Não foi possível controlar a reprodução.'); }
    }
    function back() {
        abort(); searchPending = false; w.clearTimeout(searchTimer);
        if (!el('login').hidden) { account = null; el('connect').disabled = false; message('Pronto para conectar.'); return; }
        if (!el('playback').hidden) { stopPlayer(); return; }
        if (stack.length) { var previous = stack.pop(); rows = previous.rows; genreFilter = previous.genreFilter || 'Todos os gêneros'; el('title').textContent = previous.title; el('search').value = ''; renderCategories(); render(); focusFirst(el('items')); }
        else if (kind === 'series' && !favoritesView) { genreFilter = 'Todos os gêneros'; renderCategories(); render(); focusFirst(el('categories')); }
        else if (favoritesView) { loadKind(kind); }
        else { rows = []; categoryRows = []; searchAll = false; render(); message('Escolha uma categoria.'); focusFirst(el('categories')); }
    }
    el('login-form').onsubmit = function (event) {
        event.preventDefault(); var server = C.origin(el('server').value), user = el('username').value.trim(), secret = el('password').value;
        if (!server || !user || !secret) return message('Preencha servidor HTTP/HTTPS, usuário e senha.');
        abort(); account = { server: server, username: user, password: secret }; el('connect').disabled = true; message('Validando sua conta…');
        api('', '', '', function (error, data) {
            el('connect').disabled = false;
            if (error) { account = null; clearRemembered(); return message(error); }
            var u = data && data.user_info;
            if (!u || String(u.auth) !== '1' || String(u.status || '').toLowerCase() !== 'active' || (Number(u.exp_date) > 0 && Number(u.exp_date) * 1000 <= Date.now())) { account = null; clearRemembered(); return message('Conta recusada, inativa ou vencida. Confira os dados.'); }
            saveRemembered(); el('password').value = ''; safeSave('starlink-rebuild-server', server); el('login').hidden = true; el('library').hidden = false; loadKind('live');
        });
    };
    el('logout').onclick = function () { searchCache = {}; categoryRows = []; searchAll = false; searchPending = false; favoritesView = false; clearRemembered(); if(remoteKeyboardField)closeKeyboard(); abort(); stopPlayer(); account = null; rows = []; categories = []; favorites = []; saveFavorites(); el('items').textContent = ''; el('categories').textContent = ''; el('library').hidden = true; el('login').hidden = false; el('password').value = ''; el('connect').disabled = false; message('Você saiu da conta.'); el('username').focus(); };
    Array.prototype.forEach.call(d.querySelectorAll('[data-kind]'), function (b) { b.onclick = function () { loadKind(b.getAttribute('data-kind')); }; });
    el('keyboard-username').onclick=function(){openKeyboard('username');};
    el('keyboard-password').onclick=function(){openKeyboard('password');};
    el('back').onclick = back; el('stop').onclick = back; el('pause').onclick = pause;
    function searchAcrossCategories() {
        var term = el('search').value.replace(/^\s+|\s+$/g, '');
        limit = 60;
        if (kind === 'series' || favoritesView) { render(); return; }
        if (!term) {
            if (searchAll) { rows = categoryRows; searchAll = false; }
            render(); return;
        }
        if (searchAll) { render(); return; }
        if (searchPending) return;
        if (searchCache[kind]) {
            rows = searchCache[kind]; searchAll = true; render(); return;
        }
        searchPending = true; message('Buscando em todas as categorias…');
        api(C.types[kind][1], '', '', function (error, data) {
            searchPending = false;
            if (error) return message(error);
            if (!Array.isArray(data)) return message('Busca indisponível neste servidor.');
            searchCache[kind] = data.filter(function (r) {
                return r && typeof r === 'object' && Number(r.is_adult) !== 1 && Number(r.adult) !== 1;
            });
            if (!el('search').value.replace(/^\s+|\s+$/g, '')) {
                rows = categoryRows; searchAll = false; render(); return;
            }
            rows = searchCache[kind]; searchAll = true; render();
        });
    }
    el('search-toggle').onclick = function () {
        var field = el('search'), toggle = el('search-toggle');
        if (field.hidden) {
            field.hidden = false; toggle.setAttribute('aria-expanded', 'true'); field.focus();
        } else if (field.value) {
            field.value = ''; searchAcrossCategories(); field.focus();
        } else {
            field.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus();
        }
    };
    el('search').oninput = function () {
        limit = 60; w.clearTimeout(searchTimer); searchTimer = w.setTimeout(searchAcrossCategories, 280);
    };
    el('more').onclick = function () { limit += 60; render(); };
    el('favorites').onclick = function () {
        abort(); favoritesView = true; searchAll = false; searchPending = false; stack = [];
        rows = favorites.map(function (f) {
            return { name: f.row.name || f.row.title, stream_icon: f.row.stream_icon || f.row.cover,
                _favorite: true, _kind: f.kind, _row: f.row };
        });
        el('search').value = ''; el('title').textContent = 'Favoritos';
        el('subtitle').textContent = 'Seus favoritos durante esta sessão.';
        Array.prototype.forEach.call(d.querySelectorAll('#tabs [data-kind]'), function (b) { b.setAttribute('aria-pressed','false'); });
        renderCategories(); render(); focusFirst(el('items'));
    };
    el('favorite').onclick = function () {
        if (!current) return; var index = -1; favorites.forEach(function (f, i) { if (f.key === current.key) index = i; });
        if (index >= 0) favorites.splice(index, 1); else { var row = current.row, clean = {}; ['name','title','stream_id','series_id','id','container_extension','stream_icon','cover','_episode'].forEach(function (key) { if (row[key] != null) clean[key] = row[key]; }); favorites.push({ key: current.key, row: clean, kind: current.kind }); }
        if (!saveFavorites()) playerMessage('Não foi possível salvar os favoritos nesta TV.');
        el('favorite').textContent = index >= 0 ? '☆ Favoritar' : '★ Favorito';
    };
    d.addEventListener('visibilitychange', function () { if (d.hidden) { abort(); stopPlayer(); } });
    w.addEventListener('pagehide', function () { abort(); stopPlayer(); });
    d.addEventListener('keydown', function (event) {
        var key = event.keyCode;
        if(!el('remote-keyboard').hidden){
            if(key===10009||key===27||key===413){event.preventDefault();closeKeyboard();return;}
            var keys=el('keyboard-grid').querySelectorAll('button'),index=-1;
            for(var i=0;i<keys.length;i++)if(keys[i]===d.activeElement){index=i;break;}
            if(key===13&&index>=0){event.preventDefault();keys[index].click();return;}
            if(index>=0&&(key===37||key===38||key===39||key===40)){
                event.preventDefault();
                var delta=key===37?-1:key===39?1:key===38?-10:10;
                keys[Math.max(0,Math.min(keys.length-1,index+delta))].focus();
                return;
            }
            return;
        }
        if (key === 10009 || key === 27 || key === 413) { event.preventDefault(); back(); return; }
        if (!el('playback').hidden && (key === 10252 || key === 415 || key === 19)) { event.preventDefault(); pause(); return; }
        if (key === 13 && d.activeElement.tagName === 'BUTTON') { event.preventDefault(); d.activeElement.click(); return; }
        if (key < 37 || key > 40) return;
        if (d.activeElement.tagName === 'INPUT' && (key === 37 || key === 39)) return;
        var root = !el('playback').hidden ? el('playback') : !el('login').hidden ? el('login') : el('library');
        var nodes = Array.prototype.filter.call(root.querySelectorAll('button,input'), function (n) { return !n.disabled && n.offsetWidth > 0 && n.offsetHeight > 0; });
        var here = d.activeElement, rect = here.getBoundingClientRect(), best = null, distance = Infinity;
        nodes.forEach(function (node) { if (node === here) return; var r = node.getBoundingClientRect(), dx = r.left + r.width / 2 - rect.left - rect.width / 2, dy = r.top + r.height / 2 - rect.top - rect.height / 2; if ((key === 37 && dx >= -5) || (key === 39 && dx <= 5) || (key === 38 && dy >= -5) || (key === 40 && dy <= 5)) return; var score = key === 37 || key === 39 ? Math.abs(dx) + Math.abs(dy) * 4 : Math.abs(dy) + Math.abs(dx) * 4; if (score < distance) { best = node; distance = score; } });
        event.preventDefault(); if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    });
    try { ['MediaPlayPause','MediaPlay','MediaPause','MediaStop'].forEach(function (key) { w.tizen.tvinputdevice.registerKey(key); }); } catch (_) {}
    el('server').value = safeRead('starlink-rebuild-server', 'https://panel.taila5c5c2.ts.net');
    var saved=remembered();
    if(saved) {
        el('server').value=saved.server;el('username').value=saved.username;
        el('password').value=saved.password;el('remember').checked=true;
        w.setTimeout(function(){if(!el('login').hidden)el('login-form').onsubmit({preventDefault:function(){}});},0);
    }
    // Favorites are session scoped until a server/account namespace can be verified.
    el('username').focus();
}(window, document, StarlinkCatalog, StarlinkGenres));
