/**
 * Spells a name written in English letters in Kannada script, the way names are commonly
 * written in Karnataka (e.g. "Shwetha" → ಶ್ವೇತ, "Basavaraju" → ಬಸವರಾಜು).
 *
 * English spelling doesn't say whether a vowel is long, or which of two similar letters is meant
 * (ತ/ಟ, ನ/ಣ, ಶ/ಷ), so some names come out wrong. People and guards can have their Kannada
 * spelling saved instead; this is only the fallback.
 */
export function toKannada(text: string): string {
  let out = cache.get(text);
  if (out === undefined) {
    // Text already in Kannada (or another script) is left alone.
    out = /^[\x00-\x7F]*$/.test(text) ? text.replace(/[A-Za-z]+/g, word) : text;
    cache.set(text, out);
  }
  return out;
}

const cache = new Map<string, string>();

// Whole words that the rules below get wrong.
const WORDS: Record<string, string> = {
  rao: 'ರಾವ್',
  sai: 'ಸಾಯಿ',
  pai: 'ಪೈ',
  rai: 'ರೈ',
  gowda: 'ಗೌಡ',
  singh: 'ಸಿಂಗ್',
  shah: 'ಶಾ',
  khan: 'ಖಾನ್',
  patil: 'ಪಾಟೀಲ್',
  bhat: 'ಭಟ್',
  bhatt: 'ಭಟ್',
  hegde: 'ಹೆಗಡೆ',
  kamath: 'ಕಾಮತ್',
  nayak: 'ನಾಯಕ್',
  naik: 'ನಾಯ್ಕ್',
  naidu: 'ನಾಯ್ಡು',
  iyer: 'ಅಯ್ಯರ್',
  iyengar: 'ಅಯ್ಯಂಗಾರ್',
  desai: 'ದೇಸಾಯಿ',
  kulkarni: 'ಕುಲಕರ್ಣಿ',
  deshpande: 'ದೇಶಪಾಂಡೆ',
  shastri: 'ಶಾಸ್ತ್ರಿ',
  venkatesh: 'ವೆಂಕಟೇಶ್',
  anand: 'ಆನಂದ್',
  kavya: 'ಕಾವ್ಯ',
  surya: 'ಸೂರ್ಯ',
  mohammed: 'ಮೊಹಮ್ಮದ್',
  mohammad: 'ಮೊಹಮ್ಮದ್',
  syed: 'ಸೈಯದ್',
  john: 'ಜಾನ್',
  mary: 'ಮೇರಿ',
  joseph: 'ಜೋಸೆಫ್',
  thomas: 'ಥಾಮಸ್',
  george: 'ಜಾರ್ಜ್',
  david: 'ಡೇವಿಡ್',
  peter: 'ಪೀಟರ್',
};

// Initials such as the "K" in "K Ramesh" are read out as letter names.
export const LETTERS: Record<string, string> = {
  a: 'ಎ', b: 'ಬಿ', c: 'ಸಿ', d: 'ಡಿ', e: 'ಇ', f: 'ಎಫ್', g: 'ಜಿ', h: 'ಎಚ್', i: 'ಐ', j: 'ಜೆ', k: 'ಕೆ', l: 'ಎಲ್',
  m: 'ಎಂ', n: 'ಎನ್', o: 'ಒ', p: 'ಪಿ', q: 'ಕ್ಯೂ', r: 'ಆರ್', s: 'ಎಸ್', t: 'ಟಿ', u: 'ಯು', v: 'ವಿ', w: 'ಡಬ್ಲ್ಯೂ',
  x: 'ಎಕ್ಸ್', y: 'ವೈ', z: 'ಜೆಡ್',
};

/*
 * English spelling → an exact spelling the converter reads. Lowercase letters keep their usual
 * reading; capitals mark what plain English can't say:
 *   A I U = long vowels, E O = long e/o, ĕ ŏ = short e/o (plain e/o are guessed), R = ಋ,
 *   T D N L S = ಟ ಡ ಣ ಳ ಷ, thh = ಥ.
 */
const RESPELL: [RegExp, string][] = [
  // Common name parts whose sounds the letters don't show
  [/^(sh?ri)/, 'shrI'],
  [/(^|a|n)raj/, '$1rAj'],
  [/^naga/, 'nAga'],
  [/kumar/, 'kumAr'],
  [/prasad/, 'prasAd'],
  [/prakash/, 'prakAsh'],
  [/ganesh/, 'gaNEsh'],
  [/shekh?ar/, 'shEkhar'],
  [/karjun/, 'kArjun'],
  [/swath/, 'swAth'],
  [/swam[iy]$/, 'swAmi'],
  [/murth[iy]$/, 'mUrthi'],
  [/nath(a?)$/, 'nAthh$1'],
  [/rth(?![iy])/, 'rthh'],
  [/^veena$/, 'vINA'],
  [/^(kir|ar|var)an$/, '$1aN'],
  [/^(ar|var)un$/, '$1uN'],
  [/^praveen$/, 'pravIN'],
  [/aiah$/, 'ayya'],
  [/ish$/, 'Ish'],
  // ಋ in Krishna, Hrithik, Amrutha, Pruthvi, Vrinda (but ಪ್ರಿಯಾ, ಶ್ರುತಿ)
  [/kr[iu](?=[a-z])/g, 'kR'],
  [/^hr[iu]/, 'hR'],
  [/([mbv])r[iu](?=[a-z])/g, '$1R'],
  [/([ptd])ru(?=[a-z])/g, '$1R'],
  // ಷ
  [/rsh/g, 'rS'],
  [/shn/g, 'SN'],
  [/sht/g, 'ST'],
  [/osh$/, 'OS'],
  // ಟ್ಟ / ಡ್ಡ (but ದತ್ತ, ಉತ್ತಮ್, ಸಿದ್ದ, ಸಿದ್ಧಾರ್ಥ)
  [/(?<!^(?:da|u))tt/g, 'TT'],
  [/(?<!^si)dd(?!h)/g, 'DD'],
  // Long vowels and diphthongs
  [/aa/g, 'A'],
  [/(ee|ii)/g, 'I'],
  [/(oo|uu)/g, 'U'],
  [/ou/g, 'au'],
  [/ow(?![aeiou])/g, 'au'],
  [/x/g, 'ks'],
  // A final y after a consonant is the vowel i (Shetty, Swamy)
  [/([^aeiouAEIOU])y$/, '$1i'],
];

// Longest first, so "chh" wins over "ch" and "ch" over "c"
const CONSONANTS: [string, string][] = ([
  ['ksh', 'ಕ್ಷ'], ['chh', 'ಛ'], ['thh', 'ಥ'],
  ['kh', 'ಖ'], ['gh', 'ಘ'], ['ch', 'ಚ'], ['jh', 'ಝ'], ['Th', 'ಠ'], ['Dh', 'ಢ'], ['th', 'ತ'], ['dh', 'ಧ'],
  ['ph', 'ಫ'], ['bh', 'ಭ'], ['sh', 'ಶ'],
  ['k', 'ಕ'], ['g', 'ಗ'], ['c', 'ಕ'], ['j', 'ಜ'], ['T', 'ಟ'], ['D', 'ಡ'], ['N', 'ಣ'], ['t', 'ತ'], ['d', 'ದ'],
  ['n', 'ನ'], ['p', 'ಪ'], ['b', 'ಬ'], ['m', 'ಮ'], ['y', 'ಯ'], ['r', 'ರ'], ['l', 'ಲ'], ['L', 'ಳ'], ['v', 'ವ'],
  ['w', 'ವ'], ['S', 'ಷ'], ['s', 'ಸ'], ['h', 'ಹ'], ['f', 'ಫ'], ['z', 'ಜ'], ['q', 'ಕ'],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length);

// [letter, vowel sign after a consonant]
const VOWELS: Record<string, [string, string]> = {
  ai: ['ಐ', 'ೈ'], au: ['ಔ', 'ೌ'],
  a: ['ಅ', ''], A: ['ಆ', 'ಾ'], i: ['ಇ', 'ಿ'], I: ['ಈ', 'ೀ'], u: ['ಉ', 'ು'], U: ['ಊ', 'ೂ'], R: ['ಋ', 'ೃ'],
  ĕ: ['ಎ', 'ೆ'], E: ['ಏ', 'ೇ'], ŏ: ['ಒ', 'ೊ'], O: ['ಓ', 'ೋ'],
};
const VOWEL_KEYS = Object.keys(VOWELS).sort((a, b) => b.length - a.length);

const VIRAMA = '್';
const ANUSVARA = 'ಂ';
// n or m before one of these (after a vowel) is written ಂ: Ranjini → ರಂಜಿನಿ, Sampath → ಸಂಪತ್
const NASAL_BEFORE = /^(k|g|c|j|t|d|p|b|s|S|T|D|f|z|q|h)/;

type Token = { c: string; text: string } | { v: string };

function word(original: string): string {
  const w = original.toLowerCase();
  if (w.length === 1) return LETTERS[w];
  if (WORDS[w]) return WORDS[w];
  let spelled = w;
  for (const [pattern, replacement] of RESPELL) spelled = spelled.replace(pattern, replacement);
  return render(tokenize(spelled));
}

function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  outer: while (i < s.length) {
    for (const v of [...VOWEL_KEYS, 'e', 'o']) {
      if (s.startsWith(v, i)) {
        tokens.push({ v });
        i += v.length;
        continue outer;
      }
    }
    for (const [latin, kannada] of CONSONANTS) {
      if (s.startsWith(latin, i)) {
        tokens.push({ c: kannada, text: latin });
        i += latin.length;
        continue outer;
      }
    }
    i++; // anything else is dropped
  }
  return tokens;
}

/** Plain e/o: short before two consonants (Shetty, Venkatesh) or at the end, long otherwise (Ramesh, Mohan). */
function vowelLength(tokens: Token[], at: number, letter: 'e' | 'o'): string {
  let consonants = 0;
  let i = at + 1;
  while (i < tokens.length && 'c' in tokens[i]) {
    consonants++;
    i++;
  }
  const short = consonants >= 2 || i === at + 1 && i === tokens.length;
  return letter === 'e' ? (short ? 'ĕ' : 'E') : short ? 'ŏ' : 'O';
}

function render(tokens: Token[]): string {
  let out = '';
  let afterVowel = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if ('c' in token) {
      const next = tokens[i + 1];
      if (afterVowel && (token.text === 'n' || token.text === 'm') && next && 'c' in next && NASAL_BEFORE.test(next.text)) {
        out += ANUSVARA;
        afterVowel = false;
        continue;
      }
      out += token.c;
      if (next && 'v' in next) {
        out += VOWELS[vowel(tokens, i + 1)][1];
        i++;
        afterVowel = true;
      } else {
        out += VIRAMA;
        afterVowel = false;
      }
    } else {
      const v = vowel(tokens, i);
      if (afterVowel) {
        // Two vowels in a row are joined by ಯ or ವ: Sonia → ಸೋನಿಯ, Ruan → ರುವನ್
        const prev = tokens[i - 1];
        const glide = 'v' in prev && /^[uUoOŏ]|au/.test(prev.v) ? 'ವ' : 'ಯ';
        out += glide + VOWELS[v][1];
      } else {
        out += VOWELS[v][0];
      }
      afterVowel = true;
    }
  }
  return out;
}

function vowel(tokens: Token[], at: number): string {
  const v = (tokens[at] as { v: string }).v;
  return v === 'e' || v === 'o' ? vowelLength(tokens, at, v) : v;
}
