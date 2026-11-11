/* STARLINK Samsung: Xtream contracts adapted from the beta5/QA8 Android sources. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.StarlinkCatalog = factory();
}(this, function () {
    'use strict';
    var types = { live: ['get_live_categories', 'get_live_streams', 'live'], vod: ['get_vod_categories', 'get_vod_streams', 'movie'], series: ['get_series_categories', 'get_series', 'series'] };
    function origin(value) {
        var text = String(value || '').replace(/^\s+|\s+$/g, '').replace(/\/+$/, '');
        return /^https?:\/\/[^\s\/?#@\\]+$/i.test(text) ? text : '';
    }
    function http(value) { return typeof value === 'string' && /^https?:\/\/[^\s@\\]+$/i.test(value) ? value : ''; }
    function query(account, action, key, id) {
        if (!origin(account.server)) throw new Error('Servidor inválido.');
        var out = account.server + '/player_api.php?username=' + encodeURIComponent(account.username) + '&password=' + encodeURIComponent(account.password);
        if (action) out += '&action=' + encodeURIComponent(action);
        if (key) out += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(id);
        return out;
    }
    function media(account, kind, row) {
        var direct = http(row.direct_source || row.stream_url || row.url);
        if (direct) return direct;
        var id = row.stream_id || row.id;
        if (!id || !/^\d+$/.test(String(id))) return '';
        var ext = String(row.container_extension || (kind === 'live' ? 'm3u8' : 'mp4'));
        if (!/^[a-zA-Z0-9]{1,10}$/.test(ext)) return '';
        return account.server + '/' + types[kind][2] + '/' + encodeURIComponent(account.username) + '/' + encodeURIComponent(account.password) + '/' + id + '.' + ext;
    }
    function episodes(data) {
        var groups = data && data.episodes, result = [];
        if (!groups || typeof groups !== 'object') return result;
        Object.keys(groups).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (season) {
            if (!Array.isArray(groups[season])) return;
            groups[season].slice().sort(function (a, b) { return Number(a.episode_num || 0) - Number(b.episode_num || 0); }).forEach(function (row) {
                if (!row || (!row.id && !row.stream_id && !http(row.direct_source || row.stream_url || row.url))) return;
                var copy = {};
                Object.keys(row).forEach(function (key) { copy[key] = row[key]; });
                copy.name = 'T' + (row.season || season) + ' · E' + (row.episode_num || '?') + ' · ' + (row.title || 'Episódio');
                result.push(copy);
            });
        });
        return result;
    }
    return { types: types, origin: origin, http: http, query: query, media: media, episodes: episodes };
}));
