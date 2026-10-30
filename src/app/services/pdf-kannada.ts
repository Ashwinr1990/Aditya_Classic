import type { jsPDF } from 'jspdf';
import type { CellHookData, Styles } from 'jspdf-autotable';

// jsPDF has no Kannada font, and even with one it can't join Kannada letters into syllables.
// So Kannada text is drawn by the browser on a canvas, which joins them properly, and placed as an image
// (compressed, otherwise jsPDF stores the pixels raw).
// Text without Kannada is left to jsPDF as before.

const PX_PER_PT = 3; // canvas pixels per point (216 dpi), so the text stays sharp when printed
const MM_PER_PX = 25.4 / 72 / PX_PER_PT;
const FONTS = '"Nirmala UI", "Noto Sans Kannada", "Tunga", "Kannada Sangam MN", sans-serif';

type TextStyle = { size: number; fontStyle: string; color: string };
type Rendered = { url: string; alias: string; width: number; height: number; baseline: number };

const rendered = new Map<string, Rendered>();

export function hasKannada(text: string): boolean {
  return /[ಀ-೿]/.test(text);
}

/** Like doc.text(text, x, y, { align }), using the document's current font size, style and colour. */
export function kannadaText(doc: jsPDF, text: string, x: number, y: number, align: 'left' | 'center' | 'right' = 'left') {
  const r = render(text, { size: doc.getFontSize(), fontStyle: doc.getFont().fontStyle, color: doc.getTextColor() });
  const left = align === 'center' ? x - r.width / 2 : align === 'right' ? x - r.width : x;
  doc.addImage(r.url, 'PNG', left, y - r.baseline, r.width, r.height, r.alias, 'FAST');
}

/**
 * autoTable hooks that draw Kannada cells as images: the cell is sized for the image and left empty for jsPDF.
 * Pass the table's own didParseCell, which runs first so its style changes apply to the image too.
 */
export function kannadaCells(didParseCell?: (data: CellHookData) => void) {
  const images = new WeakMap<object, Rendered>();
  return {
    didParseCell: (data: CellHookData) => {
      didParseCell?.(data);
      const text = data.cell.text.join(' ');
      if (!hasKannada(text)) return;
      const s = data.cell.styles;
      const r = render(text, { size: s.fontSize, fontStyle: s.fontStyle, color: cssColor(s.textColor) });
      images.set(data.cell, r);
      data.cell.text = [''];
      s.minCellWidth = Math.max(s.minCellWidth || 0, r.width + data.cell.padding('horizontal'));
      // The image's top and bottom are mostly empty room for vowel signs, so it may overlap the padding
      s.minCellHeight = Math.max(s.minCellHeight || 0, r.height + 1);
    },
    didDrawCell: (data: CellHookData) => {
      const r = images.get(data.cell);
      if (!r) return;
      const cell = data.cell;
      // A long name in a fixed-width column is shrunk to fit
      const scale = Math.min(1, (cell.width - cell.padding('horizontal')) / r.width);
      const w = r.width * scale;
      const h = r.height * scale;
      const x =
        cell.styles.halign === 'right' ? cell.x + cell.width - cell.padding('right') - w
        : cell.styles.halign === 'center' ? cell.x + (cell.width - w) / 2
        : cell.x + cell.padding('left');
      data.doc.addImage(r.url, 'PNG', x, cell.y + (cell.height - h) / 2, w, h, r.alias, 'FAST');
    },
  };
}

function render(text: string, style: TextStyle): Rendered {
  const alias = `kn|${style.size}|${style.fontStyle}|${style.color}|${text}`;
  const cached = rendered.get(alias);
  if (cached) return cached;
  const px = style.size * PX_PER_PT;
  const font = `${style.fontStyle.includes('italic') ? 'italic ' : ''}${style.fontStyle.includes('bold') ? 'bold ' : ''}${px}px ${FONTS}`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  // Room above for vowel signs and below for the consonants written under a letter
  const ascent = Math.ceil(px * 1.15);
  const descent = Math.ceil(px * 0.6);
  canvas.width = Math.ceil(ctx.measureText(text).width) + 2;
  canvas.height = ascent + descent;
  ctx.font = font; // resizing the canvas resets it
  ctx.fillStyle = style.color;
  ctx.fillText(text, 1, ascent);
  const r = {
    url: canvas.toDataURL('image/png'),
    alias,
    width: canvas.width * MM_PER_PX,
    height: canvas.height * MM_PER_PX,
    baseline: ascent * MM_PER_PX,
  };
  rendered.set(alias, r);
  return r;
}

function cssColor(color: Styles['textColor']): string {
  if (Array.isArray(color)) return `rgb(${color.join(',')})`;
  if (typeof color === 'number') return `rgb(${color},${color},${color})`;
  return typeof color === 'string' ? color : '#000';
}
