// Прайс на насіння 2026 (за PDF від власника, 14.10.2026).
// Ціни в таблиці на сайті беруться з карток товарів (priceTiers), тут — лише склад і порядок рядків.
// ФАО — з карток товарів: у PDF у Бентоти помилково вказано ФАО 320, власник підтвердив 250.

export const PRICE_LIST_PDF = '/files/prais-pulse-agro-2026.pdf';
export const PRICE_LIST_UPDATED = '14.10.2026';

export type PriceListTier = 'ekonom' | 'standart' | 'ekstra';

export interface PriceListRow {
  slug: string;
  name: string;
  note?: string;
}

export interface PriceListTable {
  category: string;
  title: string;
  tiers: PriceListTier[];
  noteLabel?: string;
  packaging: string;
  groups: { title?: string; rows: PriceListRow[] }[];
}

export const TIER_LABELS: Record<PriceListTier, string> = {
  ekonom: 'Економ',
  standart: 'Стандарт',
  ekstra: 'Екстра',
};

export const PRICE_LIST: PriceListTable[] = [
  {
    category: 'sunflower',
    title: 'Насіння соняшнику 2026',
    tiers: ['ekonom', 'standart', 'ekstra'],
    packaging:
      'Насіння інкрустоване (тіаметоксам, тирам та металаксил-М) та упаковане в паперові 3-шарові мішки по 1 посівній одиниці (150 тис. насінин).',
    groups: [
      {
        title: 'Гібриди під технологію Clearfield (Євролайтнінг)',
        rows: [
          { slug: 'strajk', name: 'Страйк' },
          { slug: 'silena', name: 'Сілена', note: 'Clearfield Plus' },
        ],
      },
      {
        title: 'Гібриди під технологію ExpressSun (Гранстар)',
        rows: [
          { slug: 'arkona', name: 'Аркона' },
          { slug: 'sonora', name: 'Сонора' },
          { slug: 'kejt', name: 'Кейт', note: 'високоолеїновий' },
        ],
      },
      {
        title: 'Гібриди під класичну технологію',
        rows: [{ slug: 'gibryd-sonyashnyka-ampara', name: 'Ампара' }],
      },
    ],
  },
  {
    category: 'corn',
    title: 'Насіння кукурудзи 2026',
    tiers: ['standart', 'ekstra'],
    noteLabel: 'ФАО',
    packaging:
      'Насіння інкрустоване (тіаметоксам, флудиоксоніл) та упаковане в паперові 3-шарові мішки по 1 посівній одиниці (80 000 насінин).',
    groups: [
      {
        rows: [
          { slug: 'mirissa', name: 'Мірісса', note: '280' },
          { slug: 'bentota', name: 'Бентота', note: '250' },
          { slug: 'tavira', name: 'Тавіра', note: '320' },
          { slug: 'hotyn', name: 'ДН Хотин', note: '280' },
          { slug: 'piviha', name: 'ДН Півіха', note: '180' },
          { slug: 'hortyczya', name: 'ДН Хортиця', note: '240' },
        ],
      },
    ],
  },
];

export function findPriceListTable(slug: string): PriceListTable | undefined {
  return PRICE_LIST.find((t) => t.groups.some((g) => g.rows.some((r) => r.slug === slug)));
}
