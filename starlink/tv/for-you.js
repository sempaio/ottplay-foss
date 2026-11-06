/* STARLINK TV Para Voce: opt-in, local-only channel recommendations.
 * Keeps OTT-play provider, catalog, parental controls and decoder authoritative.
 */
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.StarlinkForYou = factory();
})(this, function () {
    "use strict";
    var KEY = "starlink-for-you-v1";
    var TOPICS = [
        ["futebol", "Futebol"], ["gospel", "Gospel"],
        ["desenhos", "Desenhos"], ["filmes", "Filmes"],
        ["series", "Séries"], ["documentarios", "Documentários"],
        ["animes", "Animes"], ["novelas", "Novelas"]
    ];
    var WORDS = {
        futebol: /\b(futebol|football|soccer|sportv|premiere|esporte|esportes)\b/,
        gospel: /\b(gospel|louvor|evangelic|religios|adoracao)\w*/,
        desenhos: /\b(desenho|cartoon|animacao|infantil|tartarugas|bob esponja)\w*/,
        filmes: /\b(filme|filmes|cinema|cine|movie|movies)\w*/,
        series: /\b(serie|series|seriado|seriados)\b/,
        documentarios: /\b(documentario|documentarios|documentary|natureza)\w*/,
        animes: /\b(anime|animes|naruto|dragon ball|one piece|beyblade)\b/,
        novelas: /\b(novela|novelas|dramaturgia)\w*/
    };
    function normalize(value) {
        return String(value || "").normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    }
    function rankChannels(channels, interests, favorites, limit) {
        var allowed = Array.isArray(interests) ? interests.filter(function (topic) {
            return Object.prototype.hasOwnProperty.call(WORDS, topic);
        }) : [];
        if (!allowed.length || !channels || typeof channels !== "object") return [];
        var favoriteIds = Object.create(null);
        if (Array.isArray(favorites)) favorites.forEach(function (id) {
            if (typeof id === "number" || typeof id === "string") favoriteIds[String(id)] = true;
        });
        var rows = [], keys = Object.keys(channels);
        for (var i = 0; i < keys.length && i < 30000; i++) {
            var ch = channels[keys[i]];
            if (!ch || typeof ch !== "object") continue;
            var id = ch.ch_id;
            var title = ch.channel_name || ch.name || ch.title;
            if (!Number.isInteger(id) || typeof title !== "string" || !title.trim()) continue;
            var group = ch.category && typeof ch.category.name === "string" ? ch.category.name : "";
            var name = normalize(title), category = normalize(group), score = 0;
            for (var j = 0; j < allowed.length; j++) {
                var re = WORDS[allowed[j]];
                if (re.test(name)) score += 4;
                else if (re.test(category)) score += 2;
            }
            if (!score) continue;
            rows.push({ id: id, title: title, group: group, score: score +
                (favoriteIds[String(id)] ? 0.5 : 0) });
        }
        rows.sort(function (a, b) {
            return b.score - a.score || a.title.localeCompare(b.title, "pt-BR") || a.id - b.id;
        });
        return rows.slice(0, Math.max(1, Math.min(40, Number(limit) || 18)));
    }
    function read(win) {
        try {
            var data = JSON.parse(win.localStorage.getItem(KEY) || "null");
            if (data && data.v === 1 && Array.isArray(data.interests)) {
                return data.interests.filter(function (id) { return WORDS[id]; });
            }
        } catch (_) {}
        return [];
    }
    function saved(win) {
        try { return !!win.localStorage.getItem(KEY); } catch (_) { return false; }
    }
    function save(win, values) {
        try {
            win.localStorage.setItem(KEY, JSON.stringify({
                v: 1, interests: values.filter(function (id) { return WORDS[id]; })
            }));
            return true;
        } catch (_) { return false; }
    }
    function create(win) {
        var doc = win.document, old = doc.getElementById("starlink-for-you-root");
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var root = doc.createElement("div");
        root.id = "starlink-for-you-root";
        root.innerHTML =
            '<button type="button" id="starlink-for-you-launch" hidden>✦ Para Você</button>' +
            '<section id="starlink-for-you-panel" role="dialog" aria-label="STARLINK Para Você" aria-modal="true" hidden>' +
            '<div class="starlink-foryou-card">' +
            '<header><div><p class="starlink-foryou-eyebrow">STARLINK IPTV</p><h1>Para Você</h1>' +
            '<p>Escolha seus interesses. Tudo fica somente nesta TV.</p></div>' +
            '<button type="button" id="starlink-for-you-close" aria-label="Fechar">Voltar ✕</button></header>' +
            '<h2>O que você gosta de assistir?</h2>' +
            '<div id="starlink-for-you-topics"></div>' +
            '<div class="starlink-foryou-actions">' +
            '<button type="button" id="starlink-for-you-save">Salvar preferências</button>' +
            '<button type="button" id="starlink-for-you-skip">Pular</button></div>' +
            '<h2>Sugestões de TV ao vivo</h2>' +
            '<p class="starlink-foryou-caption">Filmes e séries continuam disponíveis na biblioteca do player.</p>' +
            '<p id="starlink-for-you-status" role="status"></p>' +
            '<div id="starlink-for-you-results"></div></div></section>';
        doc.body.appendChild(root);
        var launcher = root.querySelector("#starlink-for-you-launch");
        var panel = root.querySelector("#starlink-for-you-panel");
        var status = root.querySelector("#starlink-for-you-status");
        var resultNode = root.querySelector("#starlink-for-you-results");
        var choices = root.querySelector("#starlink-for-you-topics");
        var selection = read(win), admitted = false, prompted = false, lastFocus = null;
        function focusable() {
            return Array.prototype.slice.call(panel.querySelectorAll("button"))
                .filter(function (el) { return !el.hidden && !el.disabled; });
        }
        function renderChoices() {
            choices.textContent = "";
            TOPICS.forEach(function (pair) {
                var node = doc.createElement("button");
                node.type = "button";
                node.setAttribute("data-interest", pair[0]);
                node.setAttribute("aria-pressed", selection.indexOf(pair[0]) >= 0 ? "true" : "false");
                node.textContent = pair[1];
                node.onclick = function () {
                    var pos = selection.indexOf(pair[0]);
                    if (pos >= 0) selection.splice(pos, 1);
                    else selection.push(pair[0]);
                    node.setAttribute("aria-pressed", pos >= 0 ? "false" : "true");
                    renderResults();
                };
                choices.appendChild(node);
            });
        }
        function play(id) {
            if (!admitted) return;
            var names = win.catsArray || [], groups = win.cats || {};
            for (var c = 0; c < names.length; c++) {
                var list = groups[names[c]];
                var i = Array.isArray(list) ? list.indexOf(id) : -1;
                if (i >= 0 && typeof win.setCurrent === "function") {
                    close();
                    // Always use OTT-play's selection flow, including access checks.
                    win.setCurrent(c, i);
                    return;
                }
            }
            status.textContent = "Este canal não está disponível na categoria atual. Atualize a lista.";
        }
        function renderResults() {
            resultNode.textContent = "";
            if (!selection.length) {
                status.textContent = "Selecione seus interesses para receber sugestões.";
                return;
            }
            if (!win.commandChannelsReady) {
                status.textContent = "Carregando canais. Abra esta seção novamente depois do catálogo.";
                return;
            }
            var suggestions = rankChannels(win.channels, selection, win.favoritesArray, 18);
            status.textContent = suggestions.length ? suggestions.length + " canais relacionados aos seus interesses." :
                "Ainda não há canais correspondentes na sua lista.";
            suggestions.forEach(function (item) {
                var button = doc.createElement("button");
                button.type = "button";
                button.className = "starlink-foryou-channel";
                button.setAttribute("data-channel-id", String(item.id));
                var title = doc.createElement("strong"), label = doc.createElement("small");
                title.textContent = item.title;
                label.textContent = item.group || "TV ao vivo";
                button.appendChild(title);
                button.appendChild(label);
                button.onclick = function () { play(item.id); };
                resultNode.appendChild(button);
            });
        }
        function open() {
            if (!admitted) return;
            lastFocus = doc.activeElement;
            selection = read(win);
            panel.hidden = false;
            renderChoices();
            renderResults();
            var first = focusable()[0];
            if (first) first.focus();
        }
        function close() {
            panel.hidden = true;
            if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
            else launcher.focus();
        }
        launcher.onclick = open;
        root.querySelector("#starlink-for-you-close").onclick = close;
        root.querySelector("#starlink-for-you-skip").onclick = function () {
            selection = [];
            if (!save(win, selection)) {
                status.textContent = "Não foi possível guardar a opção Pular nesta TV.";
                return;
            }
            close();
        };
        root.querySelector("#starlink-for-you-save").onclick = function () {
            if (!save(win, selection)) {
                status.textContent = "Não foi possível guardar preferências nesta TV.";
                return;
            }
            renderResults();
            status.textContent = "Preferências salvas nesta TV.";
        };
        doc.addEventListener("keydown", function (event) {
            if (panel.hidden) return;
            var code = event.keyCode;
            if (code === 10009 || code === 461 || code === 27) {
                event.preventDefault(); event.stopImmediatePropagation(); close(); return;
            }
            if (code !== 37 && code !== 38 && code !== 39 && code !== 40 && code !== 9) return;
            var nodes = focusable(), current = nodes.indexOf(doc.activeElement);
            if (!nodes.length) return;
            event.preventDefault(); event.stopImmediatePropagation();
            var direction = code === 37 || code === 38 ? -1 : 1;
            nodes[(current + direction + nodes.length) % nodes.length].focus();
        }, true);
        function setAdmission(allowed) {
            var firstEntry = !!allowed && !admitted;
            admitted = !!allowed;
            launcher.hidden = !admitted;
            if (!admitted) panel.hidden = true;
            if (firstEntry && !prompted) {
                prompted = true;
                if (!saved(win)) open();
            }
        }
        return { setAdmission: setAdmission, getInterests: function () { return read(win); }, open: open };
    }
    return { normalize: normalize, rankChannels: rankChannels, create: create };
});