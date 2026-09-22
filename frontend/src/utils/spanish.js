// Only adapt known self-descriptions; never rewrite arbitrary nouns or user drafts.
const adjectives = ['contento', 'enfadado', 'nervioso', 'tranquilo', 'sorprendido', 'aburrido', 'preocupado', 'emocionado', 'solo', 'cansado', 'mareado', 'seguro', 'ocupado', 'listo'];
export function personalForm(text, form = 'masculine') {
  if (form !== 'feminine') return text;
  const endings = adjectives.join('|');
  return text.replace(new RegExp(`(\\b(?:estoy|me siento|no estoy|aún no estoy|^un poco)\\s+(?:(?:muy|totalmente|un poco)\\s+)?)(${endings})\\b`, 'gi'), (_, prefix, adjective) => prefix + adjective.slice(0, -1) + 'a');
}

const irregular = {
  quiero: ['quiero', 'quieres', 'queremos'],
  necesito: ['necesito', 'necesitas', 'necesitamos'],
  puedo: ['puedo', 'puedes', 'podemos'],
  tengo: ['tengo', 'tienes', 'tenemos'],
  ir: ['voy', 'vas', 'vamos'],
  venir: ['vengo', 'vienes', 'venimos'],
  hacer: ['hago', 'haces', 'hacemos'],
  dar: ['doy', 'das', 'damos'],
  poner: ['pongo', 'pones', 'ponemos'],
  salir: ['salgo', 'sales', 'salimos'],
  jugar: ['juego', 'juegas', 'jugamos'],
  cerrar: ['cierro', 'cierras', 'cerramos'],
  empezar: ['empiezo', 'empiezas', 'empezamos'],
  elegir: ['elijo', 'eliges', 'elegimos'],
  dormir: ['duermo', 'duermes', 'dormimos'],
  coger: ['cojo', 'coges', 'cogemos'],
};

const subjects = { yo: 0, 'tú': 1, nosotros: 2 };
const boardVerbs = new Set([
  ...Object.keys(irregular), 'jugar', 'mirar', 'escuchar', 'hablar', 'comprar',
  'trabajar', 'estudiar', 'abrir', 'cerrar', 'coger', 'esperar', 'elegir',
  'cambiar', 'empezar', 'terminar', 'descansar', 'comer', 'beber', 'caminar',
  'leer', 'escribir', 'dormir', 'quitar',
]);

export function verbForSubject(verb, subject) {
  const person = subjects[subject?.toLocaleLowerCase('es')];
  if (person === undefined) return verb;
  const lower = verb.toLocaleLowerCase('es');
  if (irregular[lower]) return irregular[lower][person];
  if (!/^(?:[a-záéíóúñ]+)(?:ar|er|ir)$/.test(lower)) return verb;
  const ending = lower.slice(-2);
  const stem = lower.slice(0, -2);
  const endings = {
    ar: ['o', 'as', 'amos'],
    er: ['o', 'es', 'emos'],
    ir: ['o', 'es', 'imos'],
  };
  return stem + endings[ending][person];
}

function wordForSubject(segments, index) {
  if (!boardVerbs.has(segments[index].text.toLocaleLowerCase('es'))) return segments[index].text;
  const previous = segments.slice(0, index).filter(item => item.text.toLocaleLowerCase('es') !== 'no');
  if (previous.length !== 1) return segments[index].text;
  return verbForSubject(segments[index].text, previous[0].text);
}

export function spokenTile(segments, tile) {
  return wordForSubject([...segments, tile], segments.length);
}

// Compose known board words; preserve free text and complete phrases exactly.
export function composeSentence(segments) {
  if (!segments.length) return '';
  const original = segments.map(item => item.text).join(' ');
  if (segments.some(item => !item.pictogram && !item.connector) ||
      segments.some(item => /[.!?¿¡]/.test(item.text))) return original;

  const words = segments.map((item, index) => {
    const conjugated = wordForSubject(segments, index);
    return item.pictogram === 9837 ? conjugated : conjugated.toLocaleLowerCase('es');
  });
  let text = words.join(' ');
  text = text.replace(/\b(ir|voy|vas|vamos) (baño|parque|colegio|trabajo|hospital|restaurante|salón)\b/gi, '$1 al $2')
    .replace(/\b(ir|voy|vas|vamos) (tienda|cocina|calle)\b/gi, '$1 a la $2')
    .replace(/\b(ir|voy|vas|vamos) casa\b/gi, '$1 a casa')
    .replace(/\ba el\b/gi, 'al').replace(/\bde el\b/gi, 'del');
  if (text === original) return original;
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1);
}

export function suggestSentence(segments) {
  const composed = composeSentence(segments);
  const original = segments.map(item => item.text).join(' ');
  return composed !== original ? composed + '.' : '';
}
