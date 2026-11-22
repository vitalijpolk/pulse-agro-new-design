// Визначення культури за текстом (slug, назва, теги) — для блоку заявки, схожих статей і товарів у статтях.
// Ключі збігаються з category у товарах (src/content/products/*.json).
export const CROP_PATTERNS: Record<string, RegExp> = {
  corn: /kukurudz|corn|кукурудз/i,
  sunflower: /sonyash|sunflower|соняшн/i,
  soy: /soy|соя|сої/i,
  wheat: /pshenyt|wheat|пшениц/i,
  barley: /yachmen|barley|ячмін|ячмен/i,
  rapeseed: /raps|ripak|ryapak|rapeseed|ріпак|рапс/i,
  pea: /peas|horokh|горох/i,
};

export function detectCrops(text: string): string[] {
  return Object.keys(CROP_PATTERNS).filter((crop) => CROP_PATTERNS[crop].test(text));
}
