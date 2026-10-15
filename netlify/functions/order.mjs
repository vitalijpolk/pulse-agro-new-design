// Заявка з форми «Замовити» на сторінці товару → повідомлення в Telegram.
// Netlify Function, доступна за адресою /api/order.
// Токен бота і ID чату задаються в Netlify: Site configuration → Environment variables
//   TELEGRAM_BOT_TOKEN — токен від @BotFather
//   TELEGRAM_CHAT_ID   — ID чату або групи, куди надсилати заявки

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

const clean = (v, max) => String(v ?? '').trim().slice(0, max);

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, message: 'Method not allowed' });

  let data;
  try {
    data = await req.json();
  } catch {
    return json(400, { ok: false, message: 'Invalid request body' });
  }

  // Захист від ботів: приховане поле має бути порожнім, а форма — заповнюватися хоча б 3 секунди.
  // Ботам відповідаємо «успіхом», щоб вони не підбирали обхід.
  const startedAt = Number(data.startedAt);
  if (data.company || (startedAt && Date.now() - startedAt < 3000)) return json(200, { ok: true });

  const name = clean(data.name, 200);
  const phone = clean(data.phone, 50);
  const product = clean(data.product, 300);
  const slug = clean(data.slug, 200);
  const tier = clean(data.tier, 100);
  const qty = clean(data.qty, 10) || '1';
  const comment = clean(data.comment, 2000);

  if (!name || !phone || !product) {
    return json(400, { ok: false, message: "Заповніть ім'я і телефон" });
  }
  if (phone.replace(/\D/g, '').length < 9) {
    return json(400, { ok: false, message: 'Перевірте номер телефону' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('order: TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT_ID не задані');
    return json(500, { ok: false, message: 'Не вдалося відправити. Зателефонуйте нам: +38 (097) 312-53-18' });
  }

  const time = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
  const text = [
    '🌻 Нова заявка з сайту pulse-agro.com',
    '',
    `Товар: ${product}`,
    tier ? `Варіант: ${tier}` : null,
    `Кількість: ${qty}`,
    '',
    `Ім'я: ${name}`,
    `Телефон: ${phone}`,
    comment ? `Коментар: ${comment}` : null,
    '',
    slug ? `Сторінка: https://pulse-agro.com/product/${slug}/` : null,
    `Час: ${time}`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!res.ok) {
      console.error('order: Telegram error', res.status, await res.text());
      throw new Error('telegram');
    }
  } catch {
    return json(502, { ok: false, message: 'Не вдалося відправити. Зателефонуйте нам: +38 (097) 312-53-18' });
  }

  return json(200, { ok: true, message: "Дякуємо! Ми зв'яжемося з вами найближчим часом." });
};

export const config = { path: '/api/order' };
