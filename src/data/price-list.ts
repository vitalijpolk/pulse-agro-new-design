// Прайс на насіння 2026 (за PDF від власника, 14.10.2026).
// Ціни в таблиці на сайті беруться з карток товарів (priceTiers), тут — лише склад і порядок рядків.
// ФАО — з карток товарів: у PDF у Бентоти помилково вказано ФАО 320, власник підтвердив 250.
// Кукурудза — як у прайсі Арт-Агро: окрема колонка для фракції «маса 1000 зерен до 200 г» (одна ціна на всі
// гібриди, об'єднана клітинка) і звичайна ціна. Гібриди — за зростанням ФАО. ДН-гібриди в прайс не входять
// (на сайті лишаються).

export const PRICE_LIST_PDF = '/files/prais-pulse-agro-2026.pdf';
export const PRICE_LIST_UPDATED = '14.10.2026';

export type PriceListTier = 'ekonom' | 'standart' | 'ekstra' | 'light' | 'default';

export interface PriceListRow {
  slug: string;
  name: string;
  note?: string;
}

export interface PriceListTable {
  category: string;
  title: string;
  tiers: PriceListTier[];
  // Колонки, де ціна однакова для всіх рядків, — показати однією об'єднаною клітинкою
  mergeTiers?: PriceListTier[];
  noteLabel?: string;
  packaging: string;
  extraNote?: string;
  groups: { title?: string; rows: PriceListRow[] }[];
}

export const TIER_LABELS: Record<PriceListTier, string> = {
  ekonom: 'Економ',
  standart: 'Стандарт',
  ekstra: 'Екстра',
  light: 'Маса 1000 зерен до 200 г',
  default: 'Маса 1000 зерен від 200 г',
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
    tiers: ['light', 'default'],
    mergeTiers: ['light'],
    noteLabel: 'ФАО',
    packaging:
      'Насіння інкрустоване (тіаметоксам, флудиоксоніл) та упаковане в паперові 3-шарові мішки по 1 посівній одиниці (80 000 насінин).',
    groups: [
      {
        rows: [
          { slug: 'bentota', name: 'Бентота', note: '250' },
          { slug: 'mirissa', name: 'Мірісса', note: '280' },
          { slug: 'tavira', name: 'Тавіра', note: '320' },
        ],
      },
    ],
  },
];

export function findPriceListTable(slug: string): PriceListTable | undefined {
  return PRICE_LIST.find((t) => t.groups.some((g) => g.rows.some((r) => r.slug === slug)));
}
