const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = {module: {exports: {}}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../app/genres.js'),'utf8'), sandbox);
const api = sandbox.module.exports;
const Genres = {
  classify(row) { return JSON.parse(JSON.stringify(api.classify(row))); },
  options(rows) { return JSON.parse(JSON.stringify(api.options(rows))); },
  matches(row, genre) { return api.matches(row, genre); }
};

assert.deepEqual(Genres.classify({ genre: 'Action, Crime, Suspense' }), ['Ação', 'Investigação', 'Suspense']);
assert.deepEqual(Genres.classify({ genres: ['Drama', 'Comedy', 'Documentary'] }), ['Drama', 'Comédia', 'Documentário']);
assert.deepEqual(Genres.classify({ genre: 'Ação e aventura' }), ['Ação', 'Aventura']);
assert.deepEqual(Genres.classify({ genre: '', category_name: 'SÉRIES | CLARO VÍDEO' }), ['Sem gênero']);
assert.deepEqual(Genres.classify({ category_name: 'Suspense' }), ['Suspense']);
assert.deepEqual(Genres.classify({}), ['Sem gênero']);

const choices = Genres.options([
  { genre: 'Comedy, Drama' },
  { genre: 'Action' },
  { category_name: 'SÉRIES | PROVEDOR' }
]);
assert.deepEqual(choices, ['Todos os gêneros', 'Ação', 'Drama', 'Comédia', 'Sem gênero']);
assert.equal(Genres.matches({ genre: 'Comedy, Drama' }, 'Drama'), true);
assert.equal(Genres.matches({ genre: 'Comedy, Drama' }, 'Suspense'), false);
assert.equal(Genres.matches({ genre: '' }, 'Sem gênero'), true);

console.log('QA034_GENRES: 9 validações aprovadas');
