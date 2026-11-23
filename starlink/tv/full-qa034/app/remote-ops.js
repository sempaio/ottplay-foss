/* Samsung QA036: read-only M81 announcements and Samsung release metadata.
 * This app does NOT download or install WGT files: Tizen package installation
 * requires platform-level privilege, unavailable to normal TV web apps. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.StarlinkRemoteOps = factory();
}(this, function () {
    'use strict';
    function compareVersion(a, b) {
        var left = String(a || '').split('.'), right = String(b || '').split('.');
        if (!/^\d+\.\d+\.\d+$/.test(String(a || '')) || !/^\d+\.\d+\.\d+$/.test(String(b || ''))) return 0;
        for (var i = 0; i < 3; i++) {
            var d = Number(left[i]) - Number(right[i]);
            if (d) return d > 0 ? 1 : -1;
        }
        return 0;
    }
    function samsungRelease(response, packageId, currentVersion) {
        var release = response && response.update;
        if (!release || typeof release !== 'object' || Array.isArray(release)) return null;
        if (release.package_id !== packageId || compareVersion(release.version, currentVersion) <= 0) return null;
        if (typeof release.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(release.sha256)) return null;
        if (typeof release.wgt_url !== 'string' || !/^https:\/\/[^/@\s]+(?:\/[^@\s]*)?\.wgt(?:\?[^@\s]*)?$/i.test(release.wgt_url)) return null;
        return {
            version: release.version,
            notes: typeof release.notes === 'string' ? release.notes.slice(0, 500) : ''
        };
    }
    function create(options) {
        var base = String(options.base || '').replace(/\/+$/, '');
        var active = false, interval = null, requests = [], seenAnnouncements = {}, seenRelease = '';
        function request(path, callback) {
            if (!/^https:\/\/[^\/@\s]+$/i.test(base)) return;
            var xhr = new XMLHttpRequest(), completed = false;
            try {
                xhr.open('GET', base + path, true);
                xhr.timeout = 8000;
                requests.push(xhr);
                function finish(data) {
                    if (completed) return;
                    completed = true;
                    var at = requests.indexOf(xhr);
                    if (at >= 0) requests.splice(at, 1);
                    if (active && data) callback(data);
                }
                xhr.onload = function () {
                    if (xhr.status !== 200) return finish(null);
                    try { finish(JSON.parse(xhr.responseText)); } catch (_) { finish(null); }
                };
                xhr.onerror = xhr.ontimeout = xhr.onabort = function () { finish(null); };
                xhr.send();
            } catch (_) {
                var at = requests.indexOf(xhr);
                if (at >= 0) requests.splice(at, 1);
            }
        }
        function check() {
            if (!active || !options.canCheck()) return;
            request('/app/announcements/active', function (data) {
                var a = data && data.announcement;
                if (!a || typeof a !== 'object' || !Number.isSafeInteger(a.id) || a.id < 1) return;
                if (seenAnnouncements[a.id] || typeof a.title !== 'string' || typeof a.message !== 'string') return;
                seenAnnouncements[a.id] = true;
                options.onNotice({
                    kind: 'announcement',
                    title: a.title.slice(0, 150),
                    message: a.message.slice(0, 4000)
                });
            });
            request('/app/samsung/updates/latest?package_id=' + encodeURIComponent(options.packageId), function (data) {
                var release = samsungRelease(data, options.packageId, options.version);
                if (!release || release.version === seenRelease) return;
                seenRelease = release.version;
                options.onNotice({
                    kind: 'update',
                    title: 'Nova versão Samsung ' + release.version,
                    message: (release.notes ? release.notes + '\n\n' : '') +
                        'Nova versão detectada. A atualização do WGT deve ser instalada pelo canal oficial Samsung ou pelo instalador autorizado (2APP/Tizen Studio). O aplicativo não instala arquivos WGT sozinho.'
                });
            });
        }
        return {
            start: function () {
                if (active) return;
                active = true;
                check();
                interval = setInterval(check, 15 * 60 * 1000);
            },
            stop: function () {
                active = false;
                if (interval !== null) clearInterval(interval);
                interval = null;
                requests.slice().forEach(function (xhr) { try { xhr.abort(); } catch (_) {} });
                requests = [];
            },
            check: check
        };
    }
    return { create: create, compareVersion: compareVersion, samsungRelease: samsungRelease };
}));