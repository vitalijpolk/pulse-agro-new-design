# Pulse Agro — сайт

Статичний сайт на Astro, що замінює WordPress/WooCommerce. Контент (товари, статті) — файли в `src/content/`, які редагуються прямо в коді.

## Команди

| Команда | Дія |
| :--- | :--- |
| `npm install` | Встановити залежності |
| `npm run dev` | Дев-сервер на `localhost:4321` |
| `npm run build` | Збірка в `./dist/` |
| `npm run preview` | Прогляд збірки локально |
| `node scripts/scrape-content.mjs` | Одноразовий парсер старого сайту (products+posts), `... products` або `... posts` — лише одна частина |

## Структура контенту

- `src/content/products/{slug}.json` — товари (ціни по тиерах, характеристики, виробник/технологія як slug-посилання на довідники)
- `src/content/posts/{slug}.md` — статті блогу
- `src/content/pages/*.md` — статичні сторінки (контакти, про компанію, доставка і оплата)
- `src/content/manufacturers.json`, `technologies.json` — довідники для фільтрів на сторінках категорій

## Заявки з сайту ("Замовити")

Форма на сторінці товару шле POST на `/api/order.php` (PHP, без бази даних) — лист на email + опційно Telegram. Реальних онлайн-платежів немає, оплата і доставка узгоджуються вручну, як і раніше.

Перед деплоєм скопіюйте `api/config.example.php` → `api/config.php` і заповніть SMTP-дані (локально для ручного тесту). В CI цей файл пишеться з GitHub Secret `PHP_API_CONFIG`.

## Деплой

`.github/workflows/deploy.yml`: пуш у `main` → лінт PHP → збірка Astro → FTPS-деплой на Hostinger (`public_html`). Потрібні GitHub Secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `PHP_API_CONFIG`.
