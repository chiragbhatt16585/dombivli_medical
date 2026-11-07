<?php
declare(strict_types=1);

/**
 * Route Mobile OTP API.
 * Generate: GET {base}/OtpApi/otpgenerate
 * Verify:   GET {base}/OtpApi/checkotp
 * Docs: https://developer.rmlconnect.net/route-mobile-project/reference/generateotp
 */
function sms_config(): array
{
    $sms = app_config()['sms'];
    $length = (int) $sms['otp_length'];
    $expiry = (int) $sms['otp_expiry'];
    if ($length < 4) {
        $length = 4;
    }
    if ($length > 8) {
        $length = 8;
    }
    if ($expiry < 60) {
        $expiry = 60;
    }
    if ($expiry > 1800) {
        $expiry = 1800;
    }
    $sms['otp_length'] = $length;
    $sms['otp_expiry'] = $expiry;
    return $sms;
}

function sms_mode(): string
{
    $sms = sms_config();
    $hasAny = $sms['username'] !== '' || $sms['password'] !== '' || $sms['sender'] !== '';
    $ready = $sms['username'] !== '' && $sms['password'] !== '' && $sms['sender'] !== '';
    if ($ready) {
        return 'routemobile';
    }
    if ($hasAny) {
        return 'incomplete';
    }
    return app_debug() ? 'local' : 'unconfigured';
}

function sms_status_payload(): array
{
    $sms = sms_config();
    return [
        'provider' => 'routemobile',
        'mode' => sms_mode(),
        'sender' => $sms['sender'],
        'otp_length' => $sms['otp_length'],
        'otp_expiry_seconds' => $sms['otp_expiry'],
        'base_url' => $sms['base_url'],
    ];
}

function sms_send_otp(string $mobile): array
{
    $mode = sms_mode();
    if ($mode === 'incomplete') {
        json_error('RouteMobile username, password, and sender ID must all be set in .env.', 503);
    }
    if ($mode === 'unconfigured') {
        json_error('RouteMobile is not configured. Add RM_USERNAME, RM_PASSWORD, and RM_SENDER.', 503);
    }

    $recent = db()->prepare(
        'SELECT created_at FROM otp_requests WHERE mobile = ? ORDER BY id DESC LIMIT 1'
    );
    $recent->execute([$mobile]);
    $last = $recent->fetchColumn();
    if ($last && strtotime((string) $last) > time() - 30) {
        json_error('Please wait 30 seconds before requesting another OTP.', 429);
    }

    $count = db()->prepare(
        'SELECT COUNT(*) FROM otp_requests
         WHERE mobile = ? AND success = 1 AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)'
    );
    $count->execute([$mobile]);
    if ((int) $count->fetchColumn() >= 5) {
        json_error('Too many OTP requests. Try again in an hour.', 429);
    }

    $sms = sms_config();
    if (!str_contains($sms['message'], '%m')) {
        json_error('RM_MESSAGE must contain %m. RouteMobile replaces that with the OTP.', 500);
    }

    if ($mode === 'local') {
        $otp = str_pad((string) random_int(0, (10 ** $sms['otp_length']) - 1), $sms['otp_length'], '0', STR_PAD_LEFT);
        $message = str_replace('%m', $otp, $sms['message']);
        $stmt = db()->prepare(
            'INSERT INTO otp_requests
                (mobile, channel, otp_hash, provider_code, provider_body, success, expires_at)
             VALUES (?, "local", ?, "local", "local", 1, DATE_ADD(NOW(), INTERVAL ? SECOND))'
        );
        $stmt->execute([$mobile, password_hash($otp, PASSWORD_DEFAULT), $sms['otp_expiry']]);
        sms_log($mobile, $message, 'local', 'logged', null, null);
        return [
            'mobile' => $mobile,
            'expires_in' => $sms['otp_expiry'],
            'mode' => 'local',
        ];
    }

    $query = [
        'username=' . rawurlencode($sms['username']),
        'password=' . rawurlencode($sms['password']),
        'msisdn=' . rawurlencode('91' . $mobile),
        'msg=' . rawurlencode($sms['message']),
        'source=' . rawurlencode($sms['sender']),
        'otplen=' . $sms['otp_length'],
        'exptime=' . $sms['otp_expiry'],
        'tagname=' . rawurlencode('dma-login'),
    ];
    $body = rm_http_get($sms['base_url'] . '/OtpApi/otpgenerate?' . implode('&', $query));
    $code = rm_code($body);
    $success = $code === '1701';
    $messageId = '';
    if ($success && preg_match('/[:|]([A-Za-z0-9]+)\s*$/', $body, $match)) {
        $messageId = $match[1];
    }
    $stmt = db()->prepare(
        'INSERT INTO otp_requests
            (mobile, channel, provider_code, provider_body, message_id, success, expires_at)
         VALUES (?, "routemobile", ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))'
    );
    $stmt->execute([
        $mobile,
        substr($code, 0, 16),
        substr(trim($body), 0, 250),
        $messageId !== '' ? $messageId : null,
        $success ? 1 : 0,
        $sms['otp_expiry'],
    ]);
    sms_log(
        $mobile,
        $sms['message'],
        'routemobile',
        $success ? 'sent' : 'failed',
        $code,
        $messageId !== '' ? $messageId : null
    );
    if (!$success) {
        json_error(rm_generate_error($code), $code === '1703' ? 401 : 502);
    }
    return [
        'mobile' => $mobile,
        'expires_in' => $sms['otp_expiry'],
        'mode' => 'routemobile',
    ];
}

function sms_log(string $mobile, string $message, string $provider, string $status, ?string $code, ?string $messageId): void
{
    $sender = trim((string) sms_config()['sender']);
    if ($sender === '') {
        $sender = 'LOCAL';
    }
    db()->prepare(
        'INSERT INTO sms_messages (mobile, sender, message, provider, status, provider_code, provider_message_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $mobile,
        substr($sender, 0, 20),
        $message,
        $provider,
        $status,
        $code !== null ? substr($code, 0, 16) : null,
        $messageId,
    ]);
}

function sms_verify_otp(string $mobile, string $otp): void
{
    $attempts = db()->prepare(
        'SELECT COUNT(*) FROM otp_attempts
         WHERE mobile = ? AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)'
    );
    $attempts->execute([$mobile]);
    if ((int) $attempts->fetchColumn() >= 8) {
        json_error('Too many incorrect attempts. Request a new OTP in a few minutes.', 429);
    }
    db()->prepare('INSERT INTO otp_attempts (mobile) VALUES (?)')->execute([$mobile]);

    $stmt = db()->prepare(
        'SELECT * FROM otp_requests
         WHERE mobile = ? AND success = 1 AND consumed_at IS NULL AND expires_at > NOW()
         ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([$mobile]);
    $request = $stmt->fetch();
    if (!$request) {
        json_error('OTP not found or expired. Request a new one.', 422);
    }

    if ($request['channel'] === 'local') {
        $valid = is_string($request['otp_hash']) && password_verify($otp, $request['otp_hash']);
        if (!$valid) {
            json_error('That OTP is incorrect.', 422);
        }
        db()->prepare('UPDATE otp_requests SET consumed_at = NOW() WHERE id = ?')->execute([(int) $request['id']]);
        return;
    }

    $sms = sms_config();
    $url = $sms['base_url'] . '/OtpApi/checkotp?' . implode('&', [
        'username=' . rawurlencode($sms['username']),
        'password=' . rawurlencode($sms['password']),
        'msisdn=' . rawurlencode('91' . $mobile),
        'otp=' . rawurlencode($otp),
    ]);
    $body = rm_http_get($url);
    $code = rm_code($body);
    if ($code === '101') {
        db()->prepare('UPDATE otp_requests SET consumed_at = NOW() WHERE id = ?')->execute([(int) $request['id']]);
        return;
    }
    if (in_array($code, ['102', '103', '104'], true)) {
        db()->prepare('UPDATE otp_requests SET consumed_at = NOW() WHERE id = ?')->execute([(int) $request['id']]);
    }
    json_error(rm_verify_error($code), $code === '1703' ? 401 : 422);
}

function rm_http_get(string $url): string
{
    if (!function_exists('curl_init')) {
        json_error('PHP cURL is required to call RouteMobile.', 500);
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_FAILONERROR => false,
    ]);
    $body = curl_exec($ch);
    $errno = curl_errno($ch);
    $error = curl_error($ch);
    curl_close($ch);
    if ($body === false || $errno !== 0) {
        error_log('RouteMobile request failed: ' . $error);
        json_error('Could not reach RouteMobile. Try again in a moment.', 502);
    }
    return trim((string) $body);
}

function rm_code(string $body): string
{
    if (preg_match('/^(\d+)/', trim($body), $match)) {
        return $match[1];
    }
    return trim($body);
}

function rm_generate_error(string $code): string
{
    return match ($code) {
        '1702' => 'RouteMobile rejected the OTP request because a parameter was missing.',
        '1703' => 'RouteMobile username or password was rejected.',
        '1705' => 'The SMS template must contain %m so RouteMobile can insert the OTP.',
        '1706' => 'RouteMobile rejected this mobile number.',
        '1707' => 'RouteMobile rejected the sender ID. Check RM_SENDER.',
        '1710', '1715' => 'RouteMobile had an internal error. Do not retry the same SMS immediately.',
        '1025' => 'The RouteMobile account has no SMS credit.',
        '1032' => 'This number is on DND, so the OTP could not be sent.',
        '1033' => 'Sender ID or message does not match the registered DLT template.',
        '1035' => 'This number has opted out of SMS.',
        '1042' => 'This number explicitly blocked promotional SMS.',
        default => 'RouteMobile could not send the OTP (code ' . $code . ').',
    };
}

function rm_verify_error(string $code): string
{
    return match ($code) {
        '102' => 'This OTP has expired. Request a new one.',
        '103' => 'OTP not found. Request a new one.',
        '104' => 'No OTP was sent to this number. Request a new one.',
        '1702' => 'Enter the numeric OTP from the SMS.',
        '1703' => 'RouteMobile username or password was rejected.',
        '1706' => 'RouteMobile rejected this mobile number.',
        default => 'That OTP could not be verified (code ' . $code . ').',
    };
}
