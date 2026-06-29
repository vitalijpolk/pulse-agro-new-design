<?php
// Replaces WooCommerce add-to-cart -> checkout -> payment: visitor submits a
// request from the product page, we notify the owner, payment/delivery is
// arranged manually afterwards exactly like on the old site (see
// /pay-delivery-terms/). No cart, no accounts, no payment gateway.

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function respond(bool $ok, string $message = ''): void
{
    http_response_code($ok ? 200 : 400);
    echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Method not allowed');
}

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    respond(false, 'Server misconfigured');
}
$config = require $configPath;

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    respond(false, 'Invalid request body');
}

// Honeypot: real visitors never fill this hidden field.
if (!empty($data['company'])) {
    respond(true); // pretend success so bots don't learn anything
}

$name = trim((string)($data['name'] ?? ''));
$phone = trim((string)($data['phone'] ?? ''));
$product = trim((string)($data['product'] ?? ''));
$slug = trim((string)($data['slug'] ?? ''));
$qty = trim((string)($data['qty'] ?? '1'));
$tier = trim((string)($data['tier'] ?? ''));
$comment = trim((string)($data['comment'] ?? ''));

if ($name === '' || $phone === '' || $product === '') {
    respond(false, "Заповніть ім'я, телефон і товар");
}
if (mb_strlen($name) > 200 || mb_strlen($phone) > 50 || mb_strlen($comment) > 2000) {
    respond(false, 'Текст занадто довгий');
}

// --- Simple flat-file rate limit: max 5 requests per 10 minutes per IP ---
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rateLimitFile = sys_get_temp_dir() . '/pulse-agro-order-ratelimit.json';
$now = time();
$windowSeconds = 600;
$maxPerWindow = 5;

$fp = fopen($rateLimitFile, 'c+');
if ($fp && flock($fp, LOCK_EX)) {
    $contents = stream_get_contents($fp);
    $log = json_decode($contents ?: '{}', true);
    if (!is_array($log)) {
        $log = [];
    }
    $timestamps = array_filter($log[$ip] ?? [], fn($t) => $t > $now - $windowSeconds);
    if (count($timestamps) >= $maxPerWindow) {
        flock($fp, LOCK_UN);
        fclose($fp);
        respond(false, 'Занадто багато запитів. Спробуйте пізніше або зателефонуйте нам.');
    }
    $timestamps[] = $now;
    $log[$ip] = array_values($timestamps);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($log));
    flock($fp, LOCK_UN);
    fclose($fp);
}

// --- Build the message ---
$lines = [
    "Нова заявка з сайту pulse-agro.com",
    "Товар: {$product}" . ($slug !== '' ? " (/product/{$slug}/)" : ''),
    $tier !== '' ? "Варіант: {$tier}" : null,
    "Кількість: {$qty}",
    "Ім'я: {$name}",
    "Телефон: {$phone}",
    $comment !== '' ? "Коментар: {$comment}" : null,
];
$messageText = implode("\n", array_filter($lines, fn($l) => $l !== null));

$mailSent = false;
require_once __DIR__ . '/vendor/phpmailer/src/Exception.php';
require_once __DIR__ . '/vendor/phpmailer/src/PHPMailer.php';
require_once __DIR__ . '/vendor/phpmailer/src/SMTP.php';

try {
    $mail = new PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = $config['smtp_host'];
    $mail->Port = $config['smtp_port'];
    $mail->SMTPAuth = true;
    $mail->Username = $config['smtp_user'];
    $mail->Password = $config['smtp_pass'];
    $mail->SMTPSecure = $config['smtp_port'] === 465
        ? PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
        : PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    $mail->CharSet = 'UTF-8';

    $mail->setFrom($config['smtp_user'], 'Pulse Agro — сайт');
    $mail->addAddress($config['notify_email']);
    $mail->addReplyTo($config['smtp_user']);
    $mail->Subject = "Заявка: {$product}";
    $mail->Body = $messageText;

    $mail->send();
    $mailSent = true;
} catch (\Throwable $e) {
    error_log('order.php mail error: ' . $e->getMessage());
}

// --- Optional Telegram notification (best-effort, doesn't block response) ---
if (!empty($config['telegram_bot_token']) && !empty($config['telegram_chat_id'])) {
    $url = "https://api.telegram.org/bot{$config['telegram_bot_token']}/sendMessage";
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => [
            'chat_id' => $config['telegram_chat_id'],
            'text' => $messageText,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
    ]);
    curl_exec($ch);
    curl_close($ch);
}

if ($mailSent) {
    respond(true, "Дякуємо! Ми зв'яжемося з вами найближчим часом.");
}
respond(false, 'Не вдалося відправити заявку. Зателефонуйте нам напряму.');
