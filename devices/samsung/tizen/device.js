version += " samsung-tizen-0219";
// Samsung TV Web keycodes, not the legacy platform's remote constants.
// https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html
var keys = {
    ASPECT: 10140,
    AUDIO: 10195,
    BLUE: 406,
    CH_DOWN: 428,
    CH_LIST: 10073,
    CH_UP: 427,
    DOWN: 40,
    ENTER: 13,
    EPG: 458,
    EXIT: 10182,
    FF: 417,
    GREEN: 404,
    INFO: 457,
    LANG: 0,
    LEFT: 37,
    MUTE: 449,
    N0: 48,
    N1: 49,
    N2: 50,
    N3: 51,
    N4: 52,
    N5: 53,
    N6: 54,
    N7: 55,
    N8: 56,
    N9: 57,
    NEXT: 10233,
    PAUSE: 19,
    PIP: 0,
    PLAY: 415,
    PLAYPAUSE: 10252,
    POWER: 10005,
    PRECH: 10190,
    PREV: 10232,
    REC: 416,
    RED: 403,
    RETURN: 10009,
    RIGHT: 39,
    RW: 412,
    SETUP: 18,
    STOP: 413,
    TOOLS: 10135,
    UP: 38,
    VOL_DOWN: 448,
    VOL_UP: 447,
    YELLOW: 405,
    ZOOM: 10122,
};
var strEXIT = "RETURN";
var strENTER = "ENTER";
var strTools = "TOOLS";
var strRETURN = "RETURN";
var strSETUP = "MENU";
function registerTizenRemoteKeys() {
    var input;
    try {
        input = window.tizen && window.tizen.tvinputdevice;
        if (!input || typeof input.registerKey !== "function") return;
    } catch (e) {
        return;
    }
    // Arrows, Enter and Back arrive automatically. Other keys require the
    // tv.inputdevice privilege in the containing Tizen application's manifest.
    var names = [
        "0",
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "VolumeUp",
        "VolumeDown",
        "VolumeMute",
        "ChannelUp",
        "ChannelDown",
        "ChannelList",
        "PreviousChannel",
        "MediaPlayPause",
        "MediaRewind",
        "MediaFastForward",
        "MediaPlay",
        "MediaPause",
        "MediaStop",
        "MediaRecord",
        "MediaTrackPrevious",
        "MediaTrackNext",
        "ColorF0Red",
        "ColorF1Green",
        "ColorF2Yellow",
        "ColorF3Blue",
        "Menu",
        "Tools",
        "Info",
        "Exit",
        "PictureSize",
        "MTS",
        "Guide",
    ];
    for (var i = 0; i < names.length; i++) {
        try {
            input.registerKey(names[i]);
        } catch (e) {
            // One unavailable key or privilege must not stop player startup
            // or prevent registration of the remaining supported keys.
        }
    }
}
// Capture the existing initializer before assigning the device wrapper.
var _baseStbInit = typeof stbInit === "function" ? stbInit : function () {};
stbInit = function () {
    var baseInitResult = _baseStbInit.apply(this, arguments);
    registerTizenRemoteKeys();
    try {
        if (typeof tizen !== "undefined") {
            console.log("[stb] Samsung Tizen platform detected");
        }
    } catch (e) {}
    return baseInitResult;
};

// Samsung Tizen AVPlay transport. The classic player exposes a platform engine
// hook so Samsung can keep the catalog/UI while delegating decoding to AVPlay.
var _tizenAvPlayLease = null;
function getTizenAvPlay() {
    try {
        return window.webapis && window.webapis.avplay ? window.webapis.avplay : null;
    } catch (e) {
        return null;
    }
}
function setTizenAvPlayRect(avplay) {
    try {
        var node = document.getElementById("vdiv");
        var rect = node && typeof node.getBoundingClientRect === "function"
            ? node.getBoundingClientRect()
            : { left: 0, top: 0, width: window.innerWidth || 1920, height: window.innerHeight || 1080 };
        var sw = (window.screen && window.screen.width) || window.innerWidth || 1920;
        var sh = (window.screen && window.screen.height) || window.innerHeight || 1080;
        var iw = window.innerWidth || sw;
        var ih = window.innerHeight || sh;
        avplay.setDisplayRect(
            Math.max(0, Math.round(rect.left * sw / iw)),
            Math.max(0, Math.round(rect.top * sh / ih)),
            Math.max(1, Math.round(rect.width * sw / iw)),
            Math.max(1, Math.round(rect.height * sh / ih))
        );
    } catch (e) {
        console.warn("[Samsung AVPlay] display rect failed", e);
    }
}
function createTizenAvPlayEngine(request, emit, media) {
    var avplay = getTizenAvPlay();
    if (!avplay) throw new Error("Samsung AVPlay unavailable");
    var disposed = false;
    var paused = !!request.paused;
    var position = Number(request.position) || 0;
    var duration = NaN;
    var hasCurrentPlaytime = false;
    var surface = document.getElementById("vdiv");
    var oldMediaVisibility = media && media.style ? media.style.visibility : "";
    var oldSurfaceBackground = surface && surface.style ? surface.style.backgroundColor : "";
    var body = document.body;
    var html = document.documentElement;
    var oldBodyBackground = body && body.style ? body.style.backgroundColor : "";
    var oldHtmlBackground = html && html.style ? html.style.backgroundColor : "";
    function active() { return !disposed && _tizenAvPlayLease === lease; }
    function fire(name) {
        if (!active()) return;
        try { emit(name); } catch (e) {}
    }
    function state() {
        try { return avplay.getState(); } catch (e) { return "NONE"; }
    }
    function currentSeconds() {
        if (hasCurrentPlaytime) return position;
        try { return Number(avplay.getCurrentTime()) / 1000 || position; } catch (e) { return position; }
    }
    function durationSeconds() {
        try {
            var value = Number(avplay.getDuration());
            if (isFinite(value) && value >= 0) duration = value / 1000;
        } catch (e) {}
        return duration;
    }
    function seek(seconds, done) {
        if (!active()) return;
        var ms = Math.max(0, Math.round(Number(seconds || 0) * 1000));
        position = ms / 1000;
        try {
            avplay.seekTo(ms, function () { if (done) done(); }, function () { if (done) done(); });
        } catch (e) {
            if (done) done();
        }
    }
    function startPrepared() {
        if (!active()) return;
        fire("loadedmetadata");
        durationSeconds();
        function finishStart() {
            if (!active()) return;
            if (paused) {
                fire("pause");
                return;
            }
            try {
                avplay.play();
                fire("playing");
            } catch (e) {
                console.error("[Samsung AVPlay] play failed", e);
                fire("error");
            }
        }
        if (position > 0) seek(position, finishStart);
        else finishStart();
    }
    var listener = {
        onbufferingstart: function () {},
        onbufferingcomplete: function () {},
        oncurrentplaytime: function (ms) {
            hasCurrentPlaytime = true;
            position = Number(ms) / 1000 || 0;
            fire("timeupdate");
        },
        onstreamcompleted: function () { fire("ended"); },
        onerror: function (error) {
            console.error("[Samsung AVPlay] error", error);
            fire("error");
        },
        onerrormsg: function (error, message) {
            console.error("[Samsung AVPlay] error", error, message);
            fire("error");
        }
    };
    var lease = {
        diagnosticAttempt: function () { return null; },
        diagnosticEngine: function () { return active() ? "samsung-avplay" : null; },
        dispose: function () {
            if (disposed) return;
            disposed = true;
            if (_tizenAvPlayLease === lease) _tizenAvPlayLease = null;
            try { if (state() === "PLAYING" || state() === "PAUSED") avplay.stop(); } catch (e) {}
            try { avplay.close(); } catch (e) {}
            if (media && media.style) media.style.visibility = oldMediaVisibility;
            if (surface && surface.style) surface.style.backgroundColor = oldSurfaceBackground;
            if (body && body.style) body.style.backgroundColor = oldBodyBackground;
            if (html && html.style) html.style.backgroundColor = oldHtmlBackground;
        },
        pause: function () {
            if (!active()) return;
            paused = true;
            try { if (state() === "PLAYING") avplay.pause(); } catch (e) {}
            fire("pause");
        },
        resume: function () {
            if (!active()) return;
            paused = false;
            try {
                var current = state();
                if (current === "PAUSED" || current === "READY") avplay.play();
                fire("playing");
            } catch (e) { fire("error"); }
        },
        sample: function () {
            var current = state();
            position = currentSeconds();
            return {
                duration: durationSeconds(),
                paused: paused || current !== "PLAYING",
                position: position,
                ready: current === "READY" || current === "PLAYING" || current === "PAUSED" ? 4 : current === "IDLE" ? 1 : 0
            };
        },
        seek: function (seconds) { seek(seconds); },
        selectTrack: function () {},
        supportsPausedStart: true,
        tracks: function () { return []; }
    };
    if (_tizenAvPlayLease && _tizenAvPlayLease !== lease) {
        try { _tizenAvPlayLease.dispose(); } catch (e) {}
    }
    _tizenAvPlayLease = lease;
    if (media && media.style) media.style.visibility = "hidden";
    if (surface && surface.style) surface.style.backgroundColor = "transparent";
    if (body && body.style) body.style.backgroundColor = "transparent";
    if (html && html.style) html.style.backgroundColor = "transparent";
    try { avplay.close(); } catch (e) {}
    try {
        avplay.open(request.url);
        setTizenAvPlayRect(avplay);
        if (typeof avplay.setDisplayMethod === "function") {
            try { avplay.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX"); } catch (e) {}
        }
        avplay.setListener(listener);
        avplay.prepareAsync(startPrepared, function (error) {
            console.error("[Samsung AVPlay] prepare failed", error);
            fire("error");
        });
    } catch (e) {
        console.error("[Samsung AVPlay] open failed", e);
        fire("error");
    }
    return lease;
}
function installTizenAvPlayEngine() {
    var transport = window.__ottCoreTransport;
    if (!transport || typeof transport.configure !== "function" || !getTizenAvPlay()) return;
    transport.configure({
        engine: createTizenAvPlayEngine,
        fullscreen: function () {
            var avplay = getTizenAvPlay();
            if (!avplay || !_tizenAvPlayLease) return;
            setTimeout(function () {
                if (_tizenAvPlayLease) setTizenAvPlayRect(avplay);
            }, 0);
        }
    });
    console.log("[stb] Samsung AVPlay engine registered");
}
installTizenAvPlayEngine();
