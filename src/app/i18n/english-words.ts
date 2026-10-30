import { LETTERS, toKannada } from './transliterate';

/**
 * Kannada for an item or expense written in English, without any online service: each word is looked up
 * in a list of words common in apartment upkeep, written the way Kannada speakers write them
 * ("Lan cable cctv" → ಲ್ಯಾನ್ ಕೇಬಲ್ ಸಿಸಿಟಿವಿ). Other words are spelled out by sound.
 * Shown until (or instead of, if it isn't set up) Claude's translation.
 */
export function englishToKannada(text: string): string {
  let out = cache.get(text);
  if (out === undefined) {
    out = text
      .replace(/[A-Za-z]+/g, englishWord)
      .replace(/ {2,}/g, ' ')
      .trim();
    cache.set(text, out);
  }
  return out;
}

const cache = new Map<string, string>();

// Zero-width non-joiner: keeps a word ending in ್ from fusing with the next part (ಕವರ್‌ಗಳು, not ಕವರ್ಗಳು)
const Z = '‌';

// Small English words Kannada does without
const DROPPED = new Set(['a', 'an', 'the', 'of', 'for', 'to']);

const WORDS: Record<string, string> = {
  // Cleaning
  water: 'ವಾಟರ್', mop: 'ಮಾಪ್', broom: 'ಪೊರಕೆ', brush: 'ಬ್ರಷ್', bucket: 'ಬಕೆಟ್', cleaning: 'ಕ್ಲೀನಿಂಗ್',
  cleaner: 'ಕ್ಲೀನರ್', clean: 'ಕ್ಲೀನ್', phenyl: 'ಫಿನೈಲ್', acid: 'ಆಸಿಡ್', soap: 'ಸೋಪು', liquid: 'ಲಿಕ್ವಿಡ್',
  bleaching: 'ಬ್ಲೀಚಿಂಗ್', powder: 'ಪೌಡರ್', detergent: 'ಡಿಟರ್ಜೆಂಟ್', duster: 'ಡಸ್ಟರ್', wiper: 'ವೈಪರ್',
  scrubber: 'ಸ್ಕ್ರಬರ್', sponge: 'ಸ್ಪಾಂಜ್', cloth: 'ಬಟ್ಟೆ', dustbin: `ಡಸ್ಟ್${Z}ಬಿನ್`, garbage: 'ಕಸ',
  bag: 'ಬ್ಯಾಗ್', cover: 'ಕವರ್', gloves: 'ಗ್ಲೌಸ್', mask: 'ಮಾಸ್ಕ್', sanitizer: 'ಸ್ಯಾನಿಟೈಸರ್',
  housekeeping: `ಹೌಸ್${Z}ಕೀಪಿಂಗ್`,
  // Electrical and CCTV
  extension: `ಎಕ್ಸ್${Z}ಟೆನ್ಶನ್`, box: 'ಬಾಕ್ಸ್', cctv: 'ಸಿಸಿಟಿವಿ', lan: 'ಲ್ಯಾನ್', cable: 'ಕೇಬಲ್', camera: 'ಕ್ಯಾಮೆರಾ',
  dvr: 'ಡಿವಿಆರ್', router: 'ರೂಟರ್', wifi: 'ವೈಫೈ', internet: 'ಇಂಟರ್ನೆಟ್', bulb: 'ಬಲ್ಬ್', light: 'ಲೈಟ್',
  lamp: 'ದೀಪ', tube: 'ಟ್ಯೂಬ್', led: `ಎಲ್${Z}ಇಡಿ`, fan: 'ಫ್ಯಾನ್', switch: 'ಸ್ವಿಚ್', wire: 'ವೈರ್', wiring: 'ವೈರಿಂಗ್',
  board: 'ಬೋರ್ಡ್', socket: 'ಸಾಕೆಟ್', plug: 'ಪ್ಲಗ್', fuse: 'ಫ್ಯೂಸ್', mcb: 'ಎಂಸಿಬಿ', earthing: 'ಅರ್ಥಿಂಗ್',
  battery: 'ಬ್ಯಾಟರಿ', inverter: 'ಇನ್ವರ್ಟರ್', ups: 'ಯುಪಿಎಸ್', generator: 'ಜನರೇಟರ್', diesel: 'ಡೀಸೆಲ್',
  electrician: 'ಎಲೆಕ್ಟ್ರಿಷಿಯನ್', electrical: 'ಎಲೆಕ್ಟ್ರಿಕಲ್', remote: 'ರಿಮೋಟ್', torch: 'ಟಾರ್ಚ್', bell: 'ಬೆಲ್',
  intercom: `ಇಂಟರ್${Z}ಕಾಮ್`, tv: 'ಟಿವಿ',
  // Plumbing and water supply
  pipe: 'ಪೈಪ್', tap: 'ಟ್ಯಾಪ್', motor: 'ಮೋಟಾರ್', pump: 'ಪಂಪ್', tank: 'ಟ್ಯಾಂಕ್', sump: 'ಸಂಪ್',
  borewell: `ಬೋರ್${Z}ವೆಲ್`, valve: 'ವಾಲ್ವ್', meter: 'ಮೀಟರ್', plumber: 'ಪ್ಲಂಬರ್', plumbing: 'ಪ್ಲಂಬಿಂಗ್',
  can: 'ಕ್ಯಾನ್', drinking: 'ಕುಡಿಯುವ', purifier: 'ಪ್ಯೂರಿಫೈಯರ್', ro: `ಆರ್${Z}ಒ`, filter: 'ಫಿಲ್ಟರ್',
  cartridge: 'ಕಾರ್ಟ್ರಿಡ್ಜ್',
  // Building and repairs
  repair: 'ರಿಪೇರಿ', repairs: 'ರಿಪೇರಿ', service: 'ಸರ್ವಿಸ್', servicing: 'ಸರ್ವಿಸಿಂಗ್', paint: 'ಪೇಂಟ್',
  painting: 'ಪೇಂಟಿಂಗ್', carpenter: 'ಕಾರ್ಪೆಂಟರ್', cement: 'ಸಿಮೆಂಟ್', sand: 'ಮರಳು', tiles: 'ಟೈಲ್ಸ್',
  glass: 'ಗ್ಲಾಸ್', door: 'ಬಾಗಿಲು', window: 'ಕಿಟಕಿ', wall: 'ಗೋಡೆ', floor: 'ನೆಲ', roof: 'ಛಾವಣಿ',
  terrace: 'ಟೆರೇಸ್', stairs: 'ಮೆಟ್ಟಿಲು', staircase: 'ಮೆಟ್ಟಿಲು', gate: 'ಗೇಟ್', lock: 'ಲಾಕ್', key: 'ಕೀ',
  lift: 'ಲಿಫ್ಟ್', ladder: 'ಏಣಿ', rope: 'ಹಗ್ಗ', nail: 'ಮೊಳೆ', screw: 'ಸ್ಕ್ರೂ', tape: 'ಟೇಪ್', tool: 'ಉಪಕರಣ',
  material: 'ಸಾಮಗ್ರಿ', oil: 'ಎಣ್ಣೆ', grease: 'ಗ್ರೀಸ್', parking: 'ಪಾರ್ಕಿಂಗ್', compound: 'ಕಾಂಪೌಂಡ್',
  toilet: 'ಶೌಚಾಲಯ', bathroom: `ಬಾತ್${Z}ರೂಮ್`, room: 'ರೂಮ್', hall: 'ಹಾಲ್',
  // Garden and pests
  garden: 'ಗಾರ್ಡನ್', plant: 'ಗಿಡ', pot: 'ಕುಂಡ', soil: 'ಮಣ್ಣು', fertilizer: 'ಗೊಬ್ಬರ', flower: 'ಹೂವು',
  mosquito: 'ಸೊಳ್ಳೆ', pest: 'ಕೀಟ', control: 'ಕಂಟ್ರೋಲ್', spray: 'ಸ್ಪ್ರೇ', cockroach: 'ಜಿರಳೆ', rat: 'ಇಲಿ',
  // Office, events and staff
  notice: 'ನೋಟಿಸ್', print: 'ಪ್ರಿಂಟ್', printing: 'ಪ್ರಿಂಟಿಂಗ್', xerox: 'ಜೆರಾಕ್ಸ್', stationery: 'ಸ್ಟೇಷನರಿ',
  pen: 'ಪೆನ್', register: 'ರಿಜಿಸ್ಟರ್', book: 'ಪುಸ್ತಕ', file: 'ಫೈಲ್', festival: 'ಹಬ್ಬ', pooja: 'ಪೂಜೆ',
  puja: 'ಪೂಜೆ', decoration: 'ಅಲಂಕಾರ', sweets: 'ಸಿಹಿ ತಿಂಡಿ', snacks: 'ತಿಂಡಿ', tea: 'ಟೀ', coffee: 'ಕಾಫಿ',
  security: 'ಸೆಕ್ಯುರಿಟಿ', salary: 'ಸಂಬಳ', advance: 'ಅಡ್ವಾನ್ಸ್', uniform: 'ಯೂನಿಫಾರ್ಮ್', chair: 'ಕುರ್ಚಿ',
  table: 'ಟೇಬಲ್', labour: 'ಕೂಲಿ', labor: 'ಕೂಲಿ', charge: 'ಚಾರ್ಜ್', charges: 'ಚಾರ್ಜ್', fee: 'ಶುಲ್ಕ',
  fees: 'ಶುಲ್ಕ', rent: 'ಬಾಡಿಗೆ', bill: 'ಬಿಲ್', item: 'ವಸ್ತು', maintenance: 'ನಿರ್ವಹಣೆ',
  // Describing words
  new: 'ಹೊಸ', old: 'ಹಳೆಯ', big: 'ದೊಡ್ಡ', small: 'ಸಣ್ಣ', and: 'ಮತ್ತು', with: 'ಜೊತೆ',
};

function englishWord(original: string): string {
  const w = original.toLowerCase();
  if (WORDS[w]) return WORDS[w];
  if (DROPPED.has(w)) return '';
  // Plurals: covers → ಕವರ್‌ಗಳು, boxes → ಬಾಕ್ಸ್‌ಗಳು
  const singular = w.endsWith('es') && WORDS[w.slice(0, -2)] ? w.slice(0, -2) : w.endsWith('s') ? w.slice(0, -1) : '';
  if (singular && WORDS[singular]) return plural(WORDS[singular]);
  // Short capitals like "AC" or "HDD" are read letter by letter
  if (original.length <= 4 && original === original.toUpperCase()) {
    return [...w].map(c => LETTERS[c]).reduce((out, part) => out + (out.endsWith('್') ? Z : '') + part, '');
  }
  return toKannada(original);
}

function plural(kannada: string): string {
  return kannada + (kannada.endsWith('್') ? Z : '') + 'ಗಳು';
}
