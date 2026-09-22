// Only adapt known self-descriptions; never rewrite arbitrary nouns or user drafts.
const adjectives = ['contento', 'enfadado', 'nervioso', 'tranquilo', 'sorprendido', 'aburrido', 'preocupado', 'emocionado', 'solo', 'cansado', 'mareado', 'seguro', 'ocupado', 'listo'];
export function personalForm(text, form = 'masculine') {
  if (form !== 'feminine') return text;
  const endings = adjectives.join('|');
  return text.replace(new RegExp(`(\\b(?:estoy|me siento|no estoy|aún no estoy|^un poco)\\s+(?:(?:muy|totalmente|un poco)\\s+)?)(${endings})\\b`, 'gi'), (_, prefix, adjective) => prefix + adjective.slice(0, -1) + 'a');
}

// Conservative, local suggestions for common board constructions. The user accepts them.
export function suggestSentence(segments) {
  if (segments.length < 2 || !segments.every(item => item.pictogram || item.connector)) return '';
  const original = segments.map(item => item.text).join(' ');
  if (/[.!?¿¡]/.test(original)) return '';
  let text = original.toLocaleLowerCase('es');
  text = text.replace(/\bir (baño|parque|colegio|trabajo|hospital|restaurante|salón)\b/g, 'ir al $1')
    .replace(/\bir (tienda|cocina|calle)\b/g, 'ir a la $1')
    .replace(/\bir casa\b/g, 'ir a casa')
    .replace(/\ba el\b/g, 'al').replace(/\bde el\b/g, 'del');
  if (text === original.toLocaleLowerCase('es')) return '';
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1) + '.';
}
