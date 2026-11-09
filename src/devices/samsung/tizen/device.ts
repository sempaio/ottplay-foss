/**
 * Samsung Tizen device stub.
 *
 * Keycodes and platform-specific init for Samsung Tizen TVs.
 * Sets window.keys and overrides stbInit.
 */

import { stbInit as baseStbInit } from "../../../core";

// https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html
var tizenKeys = {
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

// Set globals expected by the player
(window as any).keys = tizenKeys;
(window as any).strEXIT = "RETURN";
(window as any).strENTER = "ENTER";
(window as any).strTools = "TOOLS";
(window as any).strRETURN = "RETURN";
(window as any).strSETUP = "MENU";

function registerTizenRemoteKeys(): void {
    var input: any;
    try {
        input = (window as any).tizen && (window as any).tizen.tvinputdevice;
        if (!input || typeof input.registerKey !== "function") return;
    } catch {
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
        } catch {
            // Keep startup and the remaining keys working if a key or the
            // containing application's tv.inputdevice privilege is unavailable.
        }
    }
}

// Hide Samsung launch splash — Tizen 5.5+ exposes setSplashEnabled on webapis.appcommon
function hideSplash(): void {
    try {
        const webapis = (window as any).webapis;
        if (webapis?.appcommon?.setSplashEnabled) {
            webapis.appcommon.setSplashEnabled(false);
        }
    } catch {
        // ponytail: degrade silently
    }
}

// Hide smart-remote cursor — Tizen SDK has no setCursorVisible JS API, use CSS
function hideCursor(): void {
    try {
        document.documentElement.style.cursor = "none";
        document.body.style.cursor = "none";
    } catch {
        // ponytail: degrade silently
    }
}

// Lock window to landscape — Tizen supports portrait, we don't
function lockLandscape(): void {
    try {
        const so = (screen as any).orientation;
        if (so?.lock) {
            so.lock("landscape").catch(() => {
                /* ponytail: some Tizen builds reject; ignore */
            });
        }
    } catch {
        // ponytail: degrade silently
    }
}

// Bring app to foreground — prevent OS from stealing focus during playback
function focusApp(): void {
    try {
        const tizen = (window as any).tizen;
        if (tizen?.application?.getCurrentApplication) {
            tizen.application.getCurrentApplication().requestForeground();
        }
        if (typeof window.focus === "function") window.focus();
    } catch {
        // ponytail: degrade silently
    }
}

// Override stbInit with Tizen-specific init
function stbInit(): void {
    baseStbInit();
    registerTizenRemoteKeys();
    const win = window as any;
    if (typeof win.tizen === "undefined") {
        return;
    }
    console.log("[stb] Samsung Tizen platform detected");
    hideSplash();
    hideCursor();
    lockLandscape();
    focusApp();
}
(window as any).stbInit = stbInit;

let tizenAvPlayLease: any = null;
function getTizenAvPlay(): any {
    try {
        return (window as any).webapis?.avplay || null;
    } catch {
        return null;
    }
}
function setTizenAvPlayRect(avplay: any): void {
    try {
        const node = document.getElementById("vdiv");
        const rect = node?.getBoundingClientRect?.() || {
            left: 0,
            top: 0,
            width: window.innerWidth || 1920,
            height: window.innerHeight || 1080,
        };
        const sw = window.screen?.width || window.innerWidth || 1920;
        const sh = window.screen?.height || window.innerHeight || 1080;
        const iw = window.innerWidth || sw;
        const ih = window.innerHeight || sh;
        avplay.setDisplayRect(
            Math.max(0, Math.round((rect.left * sw) / iw)),
            Math.max(0, Math.round((rect.top * sh) / ih)),
            Math.max(1, Math.round((rect.width * sw) / iw)),
            Math.max(1, Math.round((rect.height * sh) / ih))
        );
    } catch (error) {
        console.warn("[Samsung AVPlay] display rect failed", error);
    }
}
function createTizenAvPlayEngine(request: any, emit: (name: string) => void, media: any): any {
    const avplay = getTizenAvPlay();
    if (!avplay) throw new Error("Samsung AVPlay unavailable");
    let disposed = false;
    let paused = !!request.paused;
    let position = Number(request.position) || 0;
    let duration = Number.NaN;
    let hasCurrentPlaytime = false;
    const surface = document.getElementById("vdiv");
    const oldMediaVisibility = media?.style?.visibility || "";
    const oldSurfaceBackground = surface?.style?.backgroundColor || "";
    const oldBodyBackground = document.body?.style?.backgroundColor || "";
    const oldHtmlBackground = document.documentElement?.style?.backgroundColor || "";
    const active = () => !disposed && tizenAvPlayLease === lease;
    const fire = (name: string) => {
        if (!active()) return;
        try { emit(name); } catch {}
    };
    const state = () => {
        try { return avplay.getState(); } catch { return "NONE"; }
    };
    const currentSeconds = () => {
        if (hasCurrentPlaytime) return position;
        try { return Number(avplay.getCurrentTime()) / 1000 || position; } catch { return position; }
    };
    const durationSeconds = () => {
        try {
            const value = Number(avplay.getDuration());
            if (Number.isFinite(value) && value >= 0) duration = value / 1000;
        } catch {}
        return duration;
    };
    const seek = (seconds: number, done?: () => void) => {
        if (!active()) return;
        const ms = Math.max(0, Math.round(Number(seconds || 0) * 1000));
        position = ms / 1000;
        try { avplay.seekTo(ms, () => done?.(), () => done?.()); } catch { done?.(); }
    };
    const startPrepared = () => {
        if (!active()) return;
        fire("loadedmetadata");
        durationSeconds();
        const finishStart = () => {
            if (!active()) return;
            if (paused) { fire("pause"); return; }
            try { avplay.play(); fire("playing"); } catch (error) {
                console.error("[Samsung AVPlay] play failed", error);
                fire("error");
            }
        };
        if (position > 0) seek(position, finishStart); else finishStart();
    };
    const listener = {
        onbufferingstart() {},
        onbufferingcomplete() {},
        oncurrentplaytime(ms: number) { hasCurrentPlaytime = true; position = Number(ms) / 1000 || 0; fire("timeupdate"); },
        onstreamcompleted() { fire("ended"); },
        onerror(error: unknown) { console.error("[Samsung AVPlay] error", error); fire("error"); },
        onerrormsg(error: unknown, message: unknown) { console.error("[Samsung AVPlay] error", error, message); fire("error"); },
    };
    const lease: any = {
        diagnosticAttempt: () => null,
        diagnosticEngine: () => (active() ? "samsung-avplay" : null),
        dispose() {
            if (disposed) return;
            disposed = true;
            if (tizenAvPlayLease === lease) tizenAvPlayLease = null;
            try { if (state() === "PLAYING" || state() === "PAUSED") avplay.stop(); } catch {}
            try { avplay.close(); } catch {}
            if (media?.style) media.style.visibility = oldMediaVisibility;
            if (surface?.style) surface.style.backgroundColor = oldSurfaceBackground;
            if (document.body?.style) document.body.style.backgroundColor = oldBodyBackground;
            if (document.documentElement?.style) document.documentElement.style.backgroundColor = oldHtmlBackground;
        },
        pause() { if (!active()) return; paused = true; try { if (state() === "PLAYING") avplay.pause(); } catch {} fire("pause"); },
        resume() { if (!active()) return; paused = false; try { const current = state(); if (current === "PAUSED" || current === "READY") avplay.play(); fire("playing"); } catch { fire("error"); } },
        sample() { const current = state(); position = currentSeconds(); return { duration: durationSeconds(), paused: paused || current !== "PLAYING", position, ready: current === "READY" || current === "PLAYING" || current === "PAUSED" ? 4 : current === "IDLE" ? 1 : 0 }; },
        seek(seconds: number) { seek(seconds); },
        selectTrack() {},
        supportsPausedStart: true,
        tracks: () => [],
    };
    if (tizenAvPlayLease && tizenAvPlayLease !== lease) {
        try { tizenAvPlayLease.dispose(); } catch {}
    }
    tizenAvPlayLease = lease;
    if (media?.style) media.style.visibility = "hidden";
    if (surface?.style) surface.style.backgroundColor = "transparent";
    if (document.body?.style) document.body.style.backgroundColor = "transparent";
    if (document.documentElement?.style) document.documentElement.style.backgroundColor = "transparent";
    try { avplay.close(); } catch {}
    try {
        avplay.open(request.url);
        setTizenAvPlayRect(avplay);
        if (typeof avplay.setDisplayMethod === "function") {
            try { avplay.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX"); } catch {}
        }
        avplay.setListener(listener);
        avplay.prepareAsync(startPrepared, (error: unknown) => { console.error("[Samsung AVPlay] prepare failed", error); fire("error"); });
    } catch (error) {
        console.error("[Samsung AVPlay] open failed", error);
        fire("error");
    }
    return lease;
}
function installTizenAvPlayEngine(): void {
    const transport = (window as any).__ottCoreTransport;
    if (!transport || typeof transport.configure !== "function" || !getTizenAvPlay()) return;
    transport.configure({
        engine: createTizenAvPlayEngine,
        fullscreen() {
            const avplay = getTizenAvPlay();
            if (!avplay || !tizenAvPlayLease) return;
            window.setTimeout(() => { if (tizenAvPlayLease) setTizenAvPlayRect(avplay); }, 0);
        },
    });
    console.log("[stb] Samsung AVPlay engine registered");
}
installTizenAvPlayEngine();
