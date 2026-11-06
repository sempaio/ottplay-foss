/* STARLINK TV Para Voce: opt-in, local-only channel recommendations.
 * Keeps OTT-play provider, catalog, parental controls and decoder authoritative.
 */
(function (root, factory) {
    if (typeof module === "object" && module.exports)
        module.exports = factory();
    else root.StarlinkForYou = factory();
})(this, function () {
    "use strict";
    var KEY = "starlink-for-you-v1";
    var TOPICS = [
        ["futebol", "Futebol"],
        ["gospel", "Gospel"],
        ["desenhos", "Desenhos"],
        ["filmes", "Filmes"],
        ["series", "Séries"],
        ["documentarios", "Documentários"],
        ["animes", "Animes"],
        ["novelas", "Novelas"],
    ];
    var WORDS = {
        animes: /\b(anime|animes|naruto|dragon ball|one piece|beyblade)\b/,
        desenhos:
            /\b(desenho|cartoon|animacao|infantil|tartarugas|bob esponja)\w*/,
        documentarios: /\b(documentario|documentarios|documentary|natureza)\w*/,
        filmes: /\b(filme|filmes|cinema|cine|movie|movies)\w*/,
        futebol:
            /\b(futebol|football|soccer|sportv|premiere|esporte|esportes)\b/,
        gospel: /\b(gospel|louvor|evangelic|religios|adoracao)\w*/,
        novelas: /\b(novela|novelas|dramaturgia)\w*/,
        series: /\b(serie|series|seriado|seriados)\b/,
    };
    function normalize(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }
    function rankChannels(channels, interests, favorites, limit) {
        var allowed = Array.isArray(interests)
            ? interests.filter(function (topic) {
                  return Object.prototype.hasOwnProperty.call(WORDS, topic);
              })
            : [];
        if (!allowed.length || !channels || typeof channels !== "object")
            return [];
        var favoriteIds = Object.create(null);
        if (Array.isArray(favorites))
            favorites.forEach(function (id) {
                if (typeof id === "number" || typeof id === "string")
                    favoriteIds[String(id)] = true;
            });
        var rows = [],
            keys = Object.keys(channels);
        for (var i = 0; i < keys.length && i < 30000; i++) {
            var ch = channels[keys[i]];
            if (!ch || typeof ch !== "object" || Number(ch.adult) === 1)
                continue;
            // The authoritative channel ID is the key of the provider catalog;
            // M3U streams do not necessarily carry a ch_id property.
            var id = Number(keys[i]);
            var title = ch.channel_name || ch.name || ch.title;
            if (
                !Number.isInteger(id) ||
                typeof title !== "string" ||
                !title.trim()
            )
                continue;
            var group =
                ch.category && typeof ch.category.name === "string"
                    ? ch.category.name
                    : "";
            var name = normalize(title),
                category = normalize(group),
                score = 0;
            for (var j = 0; j < allowed.length; j++) {
                var re = WORDS[allowed[j]];
                if (re.test(name)) score += 4;
                else if (re.test(category)) score += 2;
            }
            if (!score) continue;
            rows.push({
                group: group,
                id: id,
                score: score + (favoriteIds[String(id)] ? 0.5 : 0),
                title: title,
            });
        }
        rows.sort(function (a, b) {
            return (
                b.score - a.score ||
                a.title.localeCompare(b.title, "pt-BR") ||
                a.id - b.id
            );
        });
        return rows.slice(0, Math.max(1, Math.min(40, Number(limit) || 18)));
    }
    function read(win) {
        try {
            var data = JSON.parse(win.localStorage.getItem(KEY) || "null");
            if (data && data.v === 1 && Array.isArray(data.interests)) {
                return data.interests.filter(function (id) {
                    return WORDS[id];
                });
            }
        } catch (_) {}
        return [];
    }
    function saved(win) {
        try {
            return !!win.localStorage.getItem(KEY);
        } catch (_) {
            return false;
        }
    }
    function save(win, values) {
        try {
            win.localStorage.setItem(
                KEY,
                JSON.stringify({
                    interests: values.filter(function (id) {
                        return WORDS[id];
                    }),
                    v: 1,
                })
            );
            return true;
        } catch (_) {
            return false;
        }
    }
    function create(win) {
        var doc = win.document,
            old = doc.getElementById("starlink-for-you-root");
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var root = doc.createElement("div");
        root.id = "starlink-for-you-root";
        root.innerHTML =
            '<button type="button" id="starlink-for-you-launch" hidden>✦ Para Você</button>' +
            '<section id="starlink-for-you-panel" role="dialog" aria-label="STARLINK Para Você" aria-modal="true" hidden>' +
            '<div class="starlink-foryou-card">' +
            '<header><div><p class="starlink-foryou-eyebrow">STARLINK IPTV</p><h1>Para Você</h1>' +
            "<p>Escolha seus interesses. Tudo fica somente nesta TV.</p></div>" +
            '<button type="button" id="starlink-for-you-close" aria-label="Fechar">Voltar ✕</button></header>' +
            "<h2>O que você gosta de assistir?</h2>" +
            '<div id="starlink-for-you-topics"></div>' +
            '<div class="starlink-foryou-actions">' +
            '<button type="button" id="starlink-for-you-save">Salvar preferências</button>' +
            '<button type="button" id="starlink-for-you-skip">Pular</button></div>' +
            "<h2>Navegar pelo catálogo</h2>" +
            '<div id="starlink-for-you-navigation">' +
            '<button type="button" id="starlink-for-you-movies" hidden>Filmes</button>' +
            '<button type="button" id="starlink-for-you-series" hidden>Séries</button>' +
            '<button type="button" id="starlink-for-you-recommendations">Para Você</button></div>' +
            '<label for="starlink-for-you-search" class="starlink-foryou-caption">Buscar canais de TV ao vivo</label>' +
            '<input type="search" id="starlink-for-you-search" autocomplete="off" placeholder="Nome ou categoria" maxlength="100">' +
            '<h2>Categorias de TV ao vivo</h2><div id="starlink-for-you-categories"></div>' +
            '<h2 id="starlink-for-you-heading">Sugestões de TV ao vivo</h2>' +
            '<p class="starlink-foryou-caption">Filmes e séries são abertos pelo catálogo original do player, com temporadas e episódios quando disponíveis.</p>' +
            '<p id="starlink-for-you-status" role="status"></p>' +
            '<div id="starlink-for-you-results"></div></div></section>';
        doc.body.appendChild(root);
        var launcher = root.querySelector("#starlink-for-you-launch");
        var panel = root.querySelector("#starlink-for-you-panel");
        var status = root.querySelector("#starlink-for-you-status");
        var resultNode = root.querySelector("#starlink-for-you-results");
        var choices = root.querySelector("#starlink-for-you-topics");
        var categoriesNode = root.querySelector("#starlink-for-you-categories");
        var searchNode = root.querySelector("#starlink-for-you-search");
        var heading = root.querySelector("#starlink-for-you-heading");
        var moviesButton = root.querySelector("#starlink-for-you-movies");
        var seriesButton = root.querySelector("#starlink-for-you-series");
        var selection = read(win),
            admitted = false,
            prompted = false,
            lastFocus = null;
        var activeView = "recommended",
            activeCategory = "",
            refreshTimer = null;
        function clearRefresh() {
            if (refreshTimer !== null) win.clearTimeout(refreshTimer);
            refreshTimer = null;
        }
        function refreshWhenReady() {
            if (
                !admitted ||
                panel.hidden ||
                win.commandChannelsReady ||
                refreshTimer !== null
            )
                return;
            refreshTimer = win.setTimeout(function () {
                refreshTimer = null;
                if (!admitted || panel.hidden) return;
                if (win.commandChannelsReady) {
                    renderCategories();
                    renderResults();
                } else refreshWhenReady();
            }, 700);
        }
        function focusable() {
            return Array.prototype.slice
                .call(panel.querySelectorAll("button,input"))
                .filter(function (el) {
                    return !el.hidden && !el.disabled;
                });
        }
        function renderChoices() {
            choices.textContent = "";
            TOPICS.forEach(function (pair) {
                var node = doc.createElement("button");
                node.type = "button";
                node.setAttribute("data-interest", pair[0]);
                node.setAttribute(
                    "aria-pressed",
                    selection.indexOf(pair[0]) >= 0 ? "true" : "false"
                );
                node.textContent = pair[1];
                node.onclick = function () {
                    var pos = selection.indexOf(pair[0]);
                    if (pos >= 0) selection.splice(pos, 1);
                    else selection.push(pair[0]);
                    node.setAttribute(
                        "aria-pressed",
                        pos >= 0 ? "false" : "true"
                    );
                    activeView = "recommended";
                    searchNode.value = "";
                    renderResults();
                };
                choices.appendChild(node);
            });
        }
        function play(id) {
            if (!admitted) return;
            var names = win.catsArray || [],
                groups = win.cats || {};
            var preferred =
                activeView === "category" ? names.indexOf(activeCategory) : -1;
            var positions = preferred >= 0 ? [preferred] : [];
            for (var c = 0; c < names.length; c++)
                if (c !== preferred) positions.push(c);
            for (var p = 0; p < positions.length; p++) {
                var cat = positions[p],
                    list = groups[names[cat]];
                var i = Array.isArray(list) ? list.indexOf(id) : -1;
                if (i >= 0 && typeof win.setCurrent === "function") {
                    close();
                    // Keep the provider's actual list index and original access checks.
                    win.setCurrent(cat, i);
                    return;
                }
            }
            status.textContent =
                "Este canal não está disponível na categoria atual. Atualize a lista.";
        }
        function asChannel(id, group) {
            var ch = win.channels && win.channels[id];
            if (!ch || typeof ch !== "object" || Number(ch.adult) === 1)
                return null;
            var title = ch.channel_name || ch.name || ch.title;
            var keyId = Number(id);
            if (
                !Number.isInteger(keyId) ||
                typeof title !== "string" ||
                !title.trim()
            )
                return null;
            return {
                group: group || (ch.category && ch.category.name) || "",
                id: keyId,
                title: title,
            };
        }
        function categoryChannels(group) {
            var groups = win.cats || {},
                list = groups[group];
            if (!Array.isArray(list)) return [];
            var found = [],
                seen = Object.create(null);
            for (var i = 0; i < list.length && found.length < 18; i++) {
                var row = asChannel(list[i], group);
                if (!row || seen[row.id]) continue;
                seen[row.id] = true;
                found.push(row);
            }
            return found;
        }
        function searchChannels(query) {
            var term = normalize(query),
                result = [],
                seen = Object.create(null);
            if (!term) return [];
            var channels = win.channels || {},
                ids = Object.keys(channels);
            for (
                var i = 0;
                i < ids.length && i < 30000 && result.length < 18;
                i++
            ) {
                var row = asChannel(ids[i], "");
                if (!row || seen[row.id]) continue;
                if (
                    normalize(row.title).indexOf(term) === -1 &&
                    normalize(row.group).indexOf(term) === -1
                )
                    continue;
                seen[row.id] = true;
                result.push(row);
            }
            return result;
        }
        function renderCategories() {
            categoriesNode.textContent = "";
            if (
                !admitted ||
                !win.commandChannelsReady ||
                !Array.isArray(win.catsArray)
            )
                return;
            win.catsArray.slice(0, 120).forEach(function (group) {
                if (typeof group !== "string" || !group.trim()) return;
                var button = doc.createElement("button");
                button.type = "button";
                button.className = "starlink-foryou-category";
                button.setAttribute("data-category", group);
                button.setAttribute(
                    "aria-pressed",
                    activeView === "category" && activeCategory === group
                        ? "true"
                        : "false"
                );
                button.textContent = group;
                button.onclick = function () {
                    activeView = "category";
                    activeCategory = group;
                    searchNode.value = "";
                    Array.prototype.forEach.call(
                        categoriesNode.querySelectorAll("button"),
                        function (node) {
                            node.setAttribute(
                                "aria-pressed",
                                node === button ? "true" : "false"
                            );
                        }
                    );
                    // Do not replace the clicked button: Samsung D-pad focus must survive.
                    renderResults();
                };
                categoriesNode.appendChild(button);
            });
        }
        function openNative(kind) {
            if (!admitted) return;
            var config = win.STARLINK_TV_CONFIG || {};
            if (
                config.mode === "managed" ||
                !win.commandChannelsReady ||
                typeof win.mediaList !== "function"
            ) {
                status.textContent =
                    "A biblioteca ainda não está pronta. Verifique a conexão.";
                return;
            }
            close();
            // Original Xtream lazy folder: keeps parental gates, credentials and decoder ownership.
            win.mediaList({
                kind: kind,
                name: kind === "vod" ? "Filmes" : "Séries",
            });
        }
        function renderResults() {
            resultNode.textContent = "";
            if (win.commandChannelsReady && !categoriesNode.children.length)
                renderCategories();
            if (!win.commandChannelsReady) {
                status.textContent =
                    "Carregando canais. Abra esta seção novamente depois do catálogo.";
                return;
            }
            var rows;
            if (activeView === "category") {
                heading.textContent = activeCategory;
                rows = categoryChannels(activeCategory);
            } else if (activeView === "search") {
                heading.textContent = "Resultado da busca";
                rows = searchChannels(searchNode.value);
            } else {
                heading.textContent = "Sugestões de TV ao vivo";
                if (!selection.length) {
                    status.textContent =
                        "Escolha seus interesses ou navegue pelas categorias.";
                    return;
                }
                rows = rankChannels(
                    win.channels,
                    selection,
                    win.favoritesArray,
                    18
                );
            }
            status.textContent = rows.length
                ? rows.length + " canais disponíveis nesta seleção."
                : "Nenhum canal corresponde a esta seleção.";
            rows.forEach(function (item) {
                var button = doc.createElement("button");
                button.type = "button";
                button.className = "starlink-foryou-channel";
                button.setAttribute("data-channel-id", String(item.id));
                var title = doc.createElement("strong"),
                    label = doc.createElement("small");
                title.textContent = item.title;
                label.textContent = item.group || "TV ao vivo";
                button.appendChild(title);
                button.appendChild(label);
                button.onclick = function () {
                    play(item.id);
                };
                resultNode.appendChild(button);
            });
        }
        function open() {
            if (!admitted) return;
            lastFocus = doc.activeElement;
            selection = read(win);
            panel.hidden = false;
            var config = win.STARLINK_TV_CONFIG || {};
            moviesButton.hidden = config.mode === "managed";
            seriesButton.hidden = config.mode === "managed";
            renderChoices();
            renderCategories();
            renderResults();
            refreshWhenReady();
            var first = focusable()[0];
            if (first) first.focus();
        }
        function close() {
            clearRefresh();
            panel.hidden = true;
            if (lastFocus && typeof lastFocus.focus === "function")
                lastFocus.focus();
            else launcher.focus();
        }
        launcher.onclick = open;
        moviesButton.onclick = function () {
            openNative("vod");
        };
        seriesButton.onclick = function () {
            openNative("series");
        };
        root.querySelector("#starlink-for-you-recommendations").onclick =
            function () {
                activeView = "recommended";
                searchNode.value = "";
                renderCategories();
                renderResults();
            };
        searchNode.oninput = function () {
            activeView = searchNode.value.trim() ? "search" : "recommended";
            renderCategories();
            renderResults();
        };
        root.querySelector("#starlink-for-you-close").onclick = close;
        root.querySelector("#starlink-for-you-skip").onclick = function () {
            selection = [];
            if (!save(win, selection)) {
                status.textContent =
                    "Não foi possível guardar a opção Pular nesta TV.";
                return;
            }
            close();
        };
        root.querySelector("#starlink-for-you-save").onclick = function () {
            if (!save(win, selection)) {
                status.textContent =
                    "Não foi possível guardar preferências nesta TV.";
                return;
            }
            renderCategories();
            renderResults();
            status.textContent = "Preferências salvas nesta TV.";
        };
        doc.addEventListener(
            "keydown",
            function (event) {
                if (panel.hidden) return;
                var code = event.keyCode;
                if (code === 10009 || code === 461 || code === 27) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    close();
                    return;
                }
                if (
                    code !== 37 &&
                    code !== 38 &&
                    code !== 39 &&
                    code !== 40 &&
                    code !== 9
                )
                    return;
                var nodes = focusable(),
                    current = nodes.indexOf(doc.activeElement);
                if (!nodes.length) return;
                if (
                    doc.activeElement === searchNode &&
                    (code === 37 || code === 39)
                )
                    return;
                event.preventDefault();
                event.stopImmediatePropagation();
                var direction = code === 37 || code === 38 ? -1 : 1;
                nodes[
                    (current + direction + nodes.length) % nodes.length
                ].focus();
            },
            true
        );
        function setAdmission(allowed) {
            var firstEntry = !!allowed && !admitted;
            admitted = !!allowed;
            launcher.hidden = !admitted;
            if (!admitted) {
                clearRefresh();
                panel.hidden = true;
            }
            if (firstEntry && !prompted) {
                prompted = true;
                if (!saved(win)) open();
            }
        }
        return {
            getInterests: function () {
                return read(win);
            },
            open: open,
            setAdmission: setAdmission,
        };
    }
    return { create: create, normalize: normalize, rankChannels: rankChannels };
});
