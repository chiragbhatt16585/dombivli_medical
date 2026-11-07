<?php
declare(strict_types=1);

return [
    'debug' => env('APP_DEBUG', '0') === '1',
    'url' => rtrim(env('APP_URL', 'http://127.0.0.1:8080'), '/'),
    'db' => [
        'host' => env('DB_HOST', '127.0.0.1'),
        'port' => env('DB_PORT', '3306'),
        'name' => env('DB_NAME', 'dombivali_medical'),
        'user' => env('DB_USER', 'travelworld'),
        'pass' => env('DB_PASS', 'travelworld'),
        'charset' => 'utf8mb4',
    ],
    'sms' => [
        'base_url' => rtrim(env('RM_BASE_URL', 'https://api.rmlconnect.net'), '/'),
        'username' => env('RM_USERNAME', ''),
        'password' => env('RM_PASSWORD', ''),
        'sender' => env('RM_SENDER', ''),
        'otp_length' => (int) env('RM_OTP_LENGTH', '6'),
        'otp_expiry' => (int) env('RM_OTP_EXPIRY', '300'),
        'message' => env(
            'RM_MESSAGE',
            'Your Dombivali Medical Association login OTP is %m. It is valid for 5 minutes. Do not share this OTP.'
        ),
    ],
];
