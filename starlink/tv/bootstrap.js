/* Same STARLINK shell on Tizen/webOS; native device adapters still own playback. */
(function (w) {
    "use strict";
    var config = w.STARLINK_TV_CONFIG;
    if (!config) return;
    w.__starlinkTvRoot = w.location.href
        .split(/[?#]/)[0]
        .replace(/\/[^/]*$/, "");
    var controller,
        resume,
        started = false,
        overlay,
        accountButton,
        status,
        form,
        password;
    var sessionKey = "starlink-tv-session-v1",
        deviceKey = "starlink-tv-device-v1";
    var messages = {
        connecting: "Conectando sua TV…",
        connection_error:
            "Não foi possível conectar ao painel. Tente novamente.",
        invalid_assignment: "A configuração recebida não pôde ser carregada.",
        login: "Entre na sua conta para conectar esta TV.",
        login_error:
            "Não foi possível entrar. Confira sua conta e tente novamente.",
        ready: "TV conectada.",
        storage_error: "Não foi possível salvar a configuração nesta TV.",
        waiting: "Aguardando configuração do catálogo pelo painel.",
    };
    function stop() {
        if (!started) return;
        if (w.__ottActiveProviderDriver) {
            var old = w.__ottActiveProviderDriver;
            w.__ottActiveProviderDriver = null;
            try {
                old.dispose();
            } catch (_) {}
        }
        try {
            if (typeof w.stbStop === "function") w.stbStop();
        } catch (_) {}
        try {
            if (typeof w.stbStopPip === "function") w.stbStopPip();
        } catch (_) {}
    }
    function deviceId() {
        var id = w.localStorage.getItem(deviceKey),
            prefix = "starlink-tv-" + config.platform + ":";
        if (id && id.indexOf(prefix) === 0) return id;
        var bytes = new Uint8Array(20),
            random = w.crypto || w.msCrypto;
        if (!random || !random.getRandomValues)
            throw new Error("secure_random_unavailable");
        random.getRandomValues(bytes);
        id = prefix;
        for (var i = 0; i < bytes.length; i++)
            id += ("0" + bytes[i].toString(16)).slice(-2);
        w.localStorage.setItem(deviceKey, id);
        return id;
    }
    function reset(reason) {
        // Only this new preview app's sandbox is cleared, never other installations.
        // Retire source-scoped favorites/history as well as URLs before switching accounts.
        var id = w.localStorage.getItem(deviceKey);
        if (typeof w.stbClearAllItems === "function") w.stbClearAllItems();
        else w.localStorage.clear();
        if (id) w.localStorage.setItem(deviceKey, id);
        w.stbSetItem("ottplayprov", "");
        // Retire in-memory upstream library state as well as persisted data.
        if (started && reason === "logout") w.location.reload();
    }
    function state(value) {
        status.textContent = messages[value] || messages.connection_error;
        var playing = value === "ready";
        overlay.hidden = playing;
        accountButton.hidden = !playing;
        document.getElementById("starlink-back").hidden = !playing;
        form.hidden =
            value !== "login" &&
            value !== "login_error" &&
            value !== "connection_error";
        if (!playing && form.hidden)
            document.getElementById("starlink-retry").focus();
        else if (!playing) document.getElementById("starlink-login").focus();
        document.body.classList.remove("booting");
    }
    function request(method, path, body, headers, callback) {
        var xhr = new XMLHttpRequest(),
            settled = false;
        function finish(code, value) {
            if (!settled) {
                settled = true;
                callback(code, value);
            }
        }
        xhr.open(method, config.apiBase + path, true);
        xhr.timeout = 20000;
        Object.keys(headers).forEach(function (key) {
            xhr.setRequestHeader(key, headers[key]);
        });
        xhr.setRequestHeader("Accept", "application/json");
        if (body) xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onload = function () {
            var value = null;
            try {
                if (xhr.responseText.length <= 65536)
                    value = JSON.parse(xhr.responseText);
            } catch (_) {}
            finish(xhr.status, value);
        };
        xhr.onerror = xhr.ontimeout = function () {
            finish(0, null);
        };
        xhr.onprogress = function (event) {
            if (event.loaded > 65536) {
                xhr.abort();
                finish(0, null);
            }
        };
        xhr.send(body ? JSON.stringify(body) : null);
        return function () {
            settled = true;
            xhr.abort();
        };
    }
    function apply(url) {
        w.stbSetItem(
            "m3um3uArr",
            JSON.stringify({
                active: 0,
                M3Us: [{ name: "STARLINK", rechours: 0, www: url }],
            })
        );
        w.stbSetItem("ottplayprov", "m3u");
        w.stbSetItem("noSelProv", "1");
        w.stbSetItem("noProvParam", "1");
        if (started) w.loadProv("m3u");
        else {
            started = true;
            resume();
        }
    }
    function mount() {
        var node = document.createElement("section");
        node.id = "starlink-connect";
        node.innerHTML =
            '<div class="starlink-card"><img class="starlink-logo" src="./starlink/logo.png" alt="STARLINK IPTV">' +
            '<div class="starlink-brand">STARLINK <span>IPTV</span></div>' +
            '<h1>Seu conteúdo, na sua TV.</h1><p id="starlink-status" role="status"></p>' +
            '<form id="starlink-form"><label for="starlink-login">Usuário</label><input id="starlink-login" autocomplete="username" maxlength="100">' +
            '<label for="starlink-password">Senha</label><input id="starlink-password" type="password" autocomplete="current-password" maxlength="100">' +
            '<button type="submit">Conectar TV</button></form><div class="starlink-actions">' +
            '<button id="starlink-retry" type="button">Verificar catálogo</button>' +
            '<button id="starlink-logout" type="button">Sair da conta</button>' +
            '<button id="starlink-back" type="button" hidden>Voltar ao player</button></div>' +
            '<p class="starlink-note">O conteúdo é disponibilizado pelo responsável pela sua conta.</p></div>';
        document.body.appendChild(node);
        overlay = node;
        status = document.getElementById("starlink-status");
        form = document.getElementById("starlink-form");
        password = document.getElementById("starlink-password");
        accountButton = document.createElement("button");
        accountButton.id = "starlink-account";
        accountButton.textContent = "STARLINK · Conta (Azul)";
        accountButton.hidden = true;
        document.body.appendChild(accountButton);
        accountButton.onclick = function () {
            overlay.hidden = false;
            accountButton.hidden = true;
            form.hidden = true;
            document.getElementById("starlink-back").hidden = false;
            document.getElementById("starlink-back").focus();
        };
        document.getElementById("starlink-back").onclick = function () {
            if (controller.admitted()) state("ready");
        };
        form.onsubmit = function (event) {
            event.preventDefault();
            var secret = password.value;
            password.value = "";
            var login = document.getElementById("starlink-login").value.trim();
            if (!login || !secret) {
                state("login_error");
                return;
            }
            controller.login(login, secret);
        };
        document.getElementById("starlink-retry").onclick = function () {
            controller.refresh();
        };
        document.getElementById("starlink-logout").onclick = function () {
            controller.logout();
        };
        document.addEventListener(
            "keydown",
            function (event) {
                var key = event.keyCode;
                if (overlay.hidden) {
                    if (key === 406 && controller.admitted()) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        accountButton.onclick();
                    }
                    return;
                }
                event.stopImmediatePropagation();
                var nodes = overlay.querySelectorAll("input,button"),
                    visible = [],
                    i;
                for (i = 0; i < nodes.length; i++)
                    if (nodes[i].offsetParent !== null) visible.push(nodes[i]);
                var index = visible.indexOf(document.activeElement);
                if (key === 38 || key === 40 || key === 9) {
                    event.preventDefault();
                    if (visible.length)
                        visible[
                            (index + (key === 38 ? -1 : 1) + visible.length) %
                                visible.length
                        ].focus();
                } else if (
                    key === 13 &&
                    document.activeElement.tagName === "BUTTON"
                ) {
                    event.preventDefault();
                    document.activeElement.click();
                } else if (
                    (key === 10009 || key === 461 || key === 27) &&
                    controller.admitted()
                ) {
                    event.preventDefault();
                    state("ready");
                }
            },
            true
        );
    }
    w.__starlinkTv = {
        admitted: function () {
            return controller && controller.admitted();
        },
        connect: function (callback) {
            resume = callback;
            if (controller) return;
            mount();
            try {
                controller = w.StarlinkTvController.create(
                    {
                        apply: apply,
                        clearTimer: function (id) {
                            w.clearTimeout(id);
                        },
                        now: function () {
                            return Date.now();
                        },
                        read: function () {
                            return JSON.parse(
                                w.sessionStorage.getItem(sessionKey) || "null"
                            );
                        },
                        request: request,
                        reset: reset,
                        save: function (value) {
                            if (value)
                                w.sessionStorage.setItem(
                                    sessionKey,
                                    JSON.stringify(value)
                                );
                            else w.sessionStorage.removeItem(sessionKey);
                        },
                        setTimer: function (fn, delay) {
                            return w.setTimeout(fn, delay);
                        },
                        state: state,
                        stop: stop,
                    },
                    { deviceId: deviceId(), platform: config.platform }
                );
                controller.start();
            } catch (_) {
                state("storage_error");
            }
        },
    };
    w.addEventListener("beforeunload", function () {
        if (controller) controller.dispose();
    });
})(window);
