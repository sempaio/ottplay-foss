/* STARLINK remote-assignment lifecycle. No channels, provider credentials or media are bundled. */
(function (root, factory) {
    if (typeof module === "object" && module.exports)
        module.exports = factory();
    else root.StarlinkTvController = factory();
})(this, function () {
    "use strict";
    function validSource(value) {
        if (
            typeof value !== "string" ||
            value.length > 4096 ||
            /[\s\\]/.test(value)
        )
            return false;
        var match = /^https?:\/\/([^\/?#]+)(?:[\/?][^#]*)?$/i.exec(value);
        return !!match && match[1].indexOf("@") === -1;
    }
    function assignment(value, platform) {
        if (
            !value ||
            value.schema_version !== 1 ||
            value.platform !== platform ||
            typeof value.configured !== "boolean" ||
            typeof value.revision !== "string" ||
            !value.revision ||
            value.revision.length > 256 ||
            (value.configured && !validSource(value.source_url))
        )
            throw new Error("invalid_assignment");
        return value;
    }
    function loginFailure(status, data) {
        var code = data && data.detail && data.detail.code;
        if (status === 401) return "credentials_error";
        if (status === 403) {
            if (code === "client_blocked") return "blocked_error";
            if (code === "subscription_expired") return "expired_error";
            if (code === "client_inactive") return "inactive_error";
            return "access_error";
        }
        if (status === 429) return "rate_error";
        if (status === 404 || status === 405) return "endpoint_error";
        if (status === 422) return "format_error";
        if (status >= 500) return "server_error";
        if (status === 200) return "response_error";
        return "connection_error";
    }
    function create(ports, config) {
        var generation = 0,
            pending = null,
            timer = null,
            ready = false,
            revision = "",
            session = null,
            account = null;
        function cancel() {
            generation += 1;
            if (timer !== null) ports.clearTimer(timer);
            timer = null;
            var old = pending;
            pending = null;
            if (old) old();
        }
        function validSession(value) {
            return (
                value &&
                (config.mode === "account"
                    ? !!account
                    : typeof value.token === "string" &&
                      value.token.length >= 20 &&
                      value.token.length <= 500) &&
                isFinite(Date.parse(value.expires)) &&
                Date.parse(value.expires) > ports.now()
            );
        }
        function hold(state) {
            ready = false;
            try {
                ports.stop();
            } catch (_) {
                /* Admission/UI must still be revoked on decoder failure. */
            }
            ports.state(state);
        }
        function logout() {
            cancel();
            session = null;
            account = null;
            revision = "";
            hold("login");
            try {
                ports.save(null);
                ports.reset("logout");
            } catch (_) {
                hold("storage_error");
            }
        }
        function schedule(seconds) {
            if (!validSession(session)) return;
            var delay = Math.max(
                1000,
                Math.min(
                    300000,
                    Math.max(10000, seconds * 1000),
                    Date.parse(session.expires) - ports.now()
                )
            );
            timer = ports.setTimer(refresh, delay);
        }
        var catalogCheck = 0;
        function refresh(force) {
            cancel();
            if (force === true) catalogCheck += 1;
            if (!validSession(session)) {
                logout();
                return;
            }
            var owner = generation;
            pending = ports.request(
                "GET",
                config.mode === "account"
                    ? "/player_api.php?username=" +
                          encodeURIComponent(account.username) +
                          "&password=" +
                          encodeURIComponent(account.password)
                    : "/api/v1/tv-m3u/source?platform=" + config.platform,
                null,
                config.mode === "account"
                    ? {}
                    : {
                          Authorization: "Bearer " + session.token,
                          "X-Device-ID": config.deviceId,
                      },
                function (status, value) {
                    if (owner !== generation) return;
                    pending = null;
                    if (status === 401 || status === 403) {
                        logout();
                        if (config.mode === "account")
                            hold(loginFailure(status, value));
                        return;
                    }
                    if (!validSession(session)) {
                        logout();
                        return;
                    }
                    if (status !== 200) {
                        hold(
                            config.mode === "account"
                                ? loginFailure(status, value)
                                : "connection_error"
                        );
                        schedule(30);
                        return;
                    }
                    var data;
                    try {
                        if (config.mode === "account") {
                            var user = value && value.user_info;
                            if (
                                !user ||
                                (user.auth !== 1 && user.auth !== "1")
                            ) {
                                account = null;
                                session = null;
                                hold("credentials_error");
                                return;
                            }
                            if (user.status && user.status !== "Active") {
                                account = null;
                                session = null;
                                hold(
                                    user.status === "Expired"
                                        ? "expired_error"
                                        : "access_error"
                                );
                                return;
                            }
                            var expiry = Number(user.exp_date) * 1000;
                            if (isFinite(expiry) && expiry > 0) {
                                session.expires = new Date(
                                    Math.min(
                                        expiry,
                                        Date.parse(session.expires)
                                    )
                                ).toISOString();
                                if (!validSession(session)) {
                                    logout();
                                    hold("expired_error");
                                    return;
                                }
                            }
                            data = {
                                configured: true,
                                refresh_seconds: 120,
                                revision: "xtream:" + catalogCheck,
                                source_url: config.apiBase,
                            };
                        } else data = assignment(value, config.platform);
                    } catch (_) {
                        hold("invalid_assignment");
                        schedule(30);
                        return;
                    }
                    if (!data.configured) {
                        revision = "";
                        hold("waiting");
                        ports.reset();
                    } else {
                        try {
                            var changed = !ready || revision !== data.revision;
                            ready = true;
                            if (changed)
                                ports.apply(data.source_url, data.revision);
                            if (owner !== generation) return;
                            revision = data.revision;
                            ready = true;
                            ports.state("ready");
                        } catch (_) {
                            hold("storage_error");
                            schedule(30);
                            return;
                        }
                    }
                    schedule(
                        typeof data.refresh_seconds === "number" &&
                            isFinite(data.refresh_seconds)
                            ? data.refresh_seconds
                            : 120
                    );
                }
            );
        }
        function login(username, password) {
            cancel();
            hold("connecting");
            session = null;
            account = null;
            revision = "";
            try {
                ports.save(null);
                ports.reset();
            } catch (_) {
                hold("storage_error");
                return;
            }
            if (config.mode === "account") {
                account = {
                    password: password,
                    server: config.apiBase,
                    username: username,
                };
                // In-memory lifetime only. Xtream itself validates access on every
                // request; no app session is created or existing device revoked.
                session = {
                    expires: new Date(ports.now() + 2592000000).toISOString(),
                };
                catalogCheck = 0;
                refresh();
                return;
            }
            var owner = generation;
            pending = ports.request(
                "POST",
                "/app/auth/login",
                {
                    device_id: config.deviceId,
                    login: username,
                    password: password,
                },
                {},
                function (status, data) {
                    if (owner !== generation) return;
                    pending = null;
                    var next = data && {
                        expires: data.expires_at,
                        token: data.session_token || data.access_token,
                    };
                    // M81 may serialize a naive server datetime. Prefer its relative
                    // lifetime so a TV timezone does not shift the session expiry.
                    if (
                        next &&
                        typeof data.expires_in_seconds === "number" &&
                        isFinite(data.expires_in_seconds) &&
                        data.expires_in_seconds > 0 &&
                        data.expires_in_seconds <= 2678400
                    ) {
                        next.expires = new Date(
                            ports.now() + data.expires_in_seconds * 1000
                        ).toISOString();
                    }
                    if (
                        status !== 200 ||
                        !data ||
                        data.authorized !== true ||
                        !validSession(next)
                    ) {
                        hold(loginFailure(status, data));
                        return;
                    }
                    try {
                        ports.reset();
                        ports.save(next);
                    } catch (_) {
                        hold("storage_error");
                        return;
                    }
                    session = next;
                    revision = "";
                    refresh();
                }
            );
        }
        function start() {
            try {
                session = ports.read();
            } catch (_) {
                hold("storage_error");
                return;
            }
            if (validSession(session) && config.mode !== "account") {
                hold("connecting");
                refresh();
            } else logout();
        }
        return {
            accountSource: function () {
                return ready && validSession(session) && account
                    ? {
                          password: account.password,
                          server: account.server,
                          username: account.username,
                      }
                    : null;
            },
            admitted: function () {
                return ready && validSession(session);
            },
            dispose: cancel,
            login: login,
            logout: logout,
            refresh: refresh,
            start: start,
        };
    }
    return { assignment: assignment, create: create, validSource: validSource };
});
