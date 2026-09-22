import test from 'node:test';
import assert from 'node:assert/strict';
import { composeSentence, personalForm, spokenTile, suggestSentence } from '../src/utils/spanish.js';
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
  assert.equal(composeSentence(tiles('Quiero', 'Agua')), 'Quiero agua');
});
test('conjugates pronoun and verb in the displayed and spoken sentence', () => {
  assert.equal(composeSentence(tiles('Nosotros', 'Quiero')), 'Nosotros queremos');
  assert.equal(spokenTile(tiles('Nosotros'), { text: 'Quiero', pictogram: 1 }), 'queremos');
  assert.equal(composeSentence(tiles('Nosotros', 'Quiero', 'Ir', 'Baño')), 'Nosotros queremos ir al baño');
  assert.equal(composeSentence(tiles('Tú', 'No', 'Puedo')), 'Tú no puedes');
  assert.equal(composeSentence(tiles('Yo', 'Ir', 'Casa')), 'Yo voy a casa');
  assert.equal(composeSentence(tiles('Nosotros', 'Jugar')), 'Nosotros jugamos');
  assert.equal(composeSentence([{ text: 'Nosotros quiero' }]), 'Nosotros quiero');
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
