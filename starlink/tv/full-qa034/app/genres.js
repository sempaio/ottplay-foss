/* STARLINK Samsung QA034: generos visiveis apenas quando informados pelo catalogo. ES5/Tizen. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.StarlinkGenres = factory();
}(this, function () {
    'use strict';
    var rules = [
        ['Ação', /\b(acao|action|acoes)\b/],
        ['Investigação', /\b(investigacao|investigation|crime|criminal|detective|detetive|misterio|mystery|policial)\b/],
        ['Suspense', /\b(suspense|thriller)\b/],
        ['Drama', /\b(drama|dramatic|dramatico)\b/],
        ['Comédia', /\b(comedia|comedy|sitcom|humor)\b/],
        ['Documentário', /\b(documentario|documentary|documentaries|docuseries|docu.series)\b/],
        ['Aventura', /\b(aventura|adventure)\b/],
        ['Ficção científica', /\b(ficcao cientifica|sci.fi|science fiction)\b/],
        ['Terror', /\b(terror|horror)\b/],
        ['Romance', /\b(romance|romantic|romantico)\b/],
        ['Animação', /\b(animacao|animation|anime|animated)\b/]
    ];
    function normalize(value) {
        return String(value || '').toLowerCase()
            .replace(/[áàâãä]/g, 'a').replace(/[éèêë]/g, 'e')
            .replace(/[íìîï]/g, 'i').replace(/[óòôõö]/g, 'o')
            .replace(/[úùûü]/g, 'u').replace(/ç/g, 'c')
            .replace(/[^a-z0-9]+/g, ' ').replace(/^\s+|\s+$/g, '');
    }
    function names(value) {
        if (Array.isArray(value)) {
            return value.map(function (x) { return typeof x === 'object' && x ? (x.name || x.title || '') : x; }).join(' ');
        }
        return typeof value === 'string' ? value : '';
    }
    function classify(row) {
        if (!row || typeof row !== 'object') return ['Sem gênero'];
        var metadata = names(row.genre) || names(row.genres) || names(row.genre_names);
        // category_name so e usado se for um genero identificavel, nunca como provedor.
        var source = normalize(metadata || names(row.category_name));
        var found = [];
        rules.forEach(function (rule) { if (rule[1].test(source)) found.push(rule[0]); });
        return found.length ? found : ['Sem gênero'];
    }
    function tags(row) {
        if (row && Array.isArray(row._genres)) return row._genres;
        return classify(row);
    }
    function matches(row, label) {
        return !label || label === 'Todos os gêneros' || tags(row).indexOf(label) >= 0;
    }
    function options(rows) {
        var present = {};
        (rows || []).forEach(function (row) {
            tags(row).forEach(function (tag) { present[tag] = true; });
        });
        var choices = ['Todos os gêneros'];
        rules.forEach(function (rule) { if (present[rule[0]]) choices.push(rule[0]); });
        if (present['Sem gênero']) choices.push('Sem gênero');
        return choices;
    }
    return { classify: classify, matches: matches, options: options };
}));
