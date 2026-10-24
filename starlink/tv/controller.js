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
    function create(ports, config) {
        var generation = 0,
            pending = null,
            timer = null,
            ready = false,
            revision = "",
            session = null;
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
                typeof value.token === "string" &&
                value.token.length >= 20 &&
                value.token.length <= 500 &&
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
        function refresh() {
            cancel();
            if (!validSession(session)) {
                logout();
                return;
            }
            var owner = generation;
            pending = ports.request(
                "GET",
                "/api/v1/tv-m3u/source?platform=" + config.platform,
                null,
                {
                    Authorization: "Bearer " + session.token,
                    "X-Device-ID": config.deviceId,
                },
                function (status, value) {
                    if (owner !== generation) return;
                    pending = null;
                    if (status === 401 || status === 403) {
                        logout();
                        return;
                    }
                    if (!validSession(session)) {
                        logout();
                        return;
                    }
                    if (status !== 200) {
                        hold("connection_error");
                        schedule(30);
                        return;
                    }
                    var data;
                    try {
                        data = assignment(value, config.platform);
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
            revision = "";
            try {
                ports.save(null);
                ports.reset();
            } catch (_) {
                hold("storage_error");
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
                        hold(
                            status === 401 || status === 403
                                ? "login_error"
                                : "connection_error"
                        );
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
            if (validSession(session)) {
                hold("connecting");
                refresh();
            } else logout();
        }
        return {
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
