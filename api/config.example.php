<?php
// Copy this file to config.php (not committed to git) and fill in real values.
// In CI, config.php is written from the PHP_API_CONFIG GitHub Secret instead.

return [
    // SMTP credentials for the mailbox that sends order notifications.
    // Hostinger: hPanel -> Emails -> the mailbox you created (e.g. info@pulse-agro.com).
    'smtp_host' => 'smtp.hostinger.com',
    'smtp_port' => 465,
    'smtp_user' => 'info@pulse-agro.com',
    'smtp_pass' => 'CHANGE_ME',

    // Where order notifications are sent (can be the same as smtp_user).
    'notify_email' => 'info@pulse-agro.com',

    // Optional: Telegram notifications. Leave empty to disable.
    'telegram_bot_token' => '',
    'telegram_chat_id' => '',
];
