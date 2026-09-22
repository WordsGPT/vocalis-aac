import test from 'node:test';
import assert from 'node:assert/strict';
import { personalForm, suggestSentence } from '../src/utils/spanish.js';
const tiles = (...words) => words.map(text => ({ text, pictogram: 1 }));
test('offers prepositions without modifying original tiles', () => {
  const input = tiles('Yo', 'Quiero', 'Ir', 'Baño');
  assert.equal(suggestSentence(input), 'Yo quiero ir al baño.');
  assert.equal(input[3].text, 'Baño');
  assert.equal(suggestSentence(tiles('Quiero', 'Ir', 'Casa')), 'Quiero ir a casa.');
  assert.equal(suggestSentence(tiles('Quiero', 'Ir', 'Tienda')), 'Quiero ir a la tienda.');
});
test('does not rewrite typed messages or already complete phrases', () => {
  assert.equal(suggestSentence([{ text: 'Quiero ir baño' }]), '');
  assert.equal(suggestSentence(tiles('Estoy bien.', 'Gracias')), '');
  assert.equal(suggestSentence(tiles('Quiero', 'Agua')), '');
});
test('adapts self-description without changing objects or other people', () => {
  assert.equal(personalForm('Estoy cansado.', 'feminine'), 'Estoy cansada.');
  assert.equal(personalForm('Me siento solo.', 'feminine'), 'Me siento sola.');
  assert.equal(personalForm('Aún no estoy muy seguro.', 'feminine'), 'Aún no estoy muy segura.');
  assert.equal(personalForm('Mi hermano está cansado. Está frío.', 'feminine'), 'Mi hermano está cansado. Está frío.');
  assert.equal(personalForm('Él está un poco cansado.', 'feminine'), 'Él está un poco cansado.');
  assert.equal(personalForm('Un poco cansado hoy.', 'feminine'), 'Un poco cansada hoy.');
  assert.equal(personalForm('Estoy cansado.', 'masculine'), 'Estoy cansado.');
});
