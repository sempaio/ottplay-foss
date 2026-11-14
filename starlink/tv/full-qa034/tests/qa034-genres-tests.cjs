const assert = require('node:assert/strict');
const Genres = require('../app/genres.js');

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
