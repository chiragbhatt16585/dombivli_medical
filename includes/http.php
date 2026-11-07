<?php
declare(strict_types=1);

function send_cors(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
}

function json_ok(mixed $data = null, int $status = 200, array $extra = []): void
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(array_merge(['ok' => true, 'data' => $data], $extra), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(string $message, int $status = 400, array $extra = []): void
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(array_merge(['ok' => false, 'error' => $message], $extra), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_error('Send a JSON body.', 400);
    }
    return $data;
}

function input(): array
{
    $type = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
    if (str_contains($type, 'application/json')) {
        return request_json();
    }
    return $_POST;
}

function bearer_token(): ?string
{
    $header = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if ($header === '' && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $header = (string) ($headers['Authorization'] ?? $headers['authorization'] ?? '');
    }
    if (preg_match('/^Bearer\s+(\S+)$/i', $header, $match)) {
        return $match[1];
    }
    return null;
}

function normalize_mobile(string $raw): ?string
{
    $digits = preg_replace('/\D+/', '', $raw) ?? '';
    if (str_starts_with($digits, '91') && strlen($digits) === 12) {
        $digits = substr($digits, 2);
    }
    if (str_starts_with($digits, '0') && strlen($digits) === 11) {
        $digits = substr($digits, 1);
    }
    if (!preg_match('/^[6-9]\d{9}$/', $digits)) {
        return null;
    }
    return $digits;
}

function require_mobile(array $in): string
{
    $mobile = normalize_mobile((string) ($in['mobile'] ?? ''));
    if ($mobile === null) {
        json_error('Enter a valid 10-digit Indian mobile number.', 422);
    }
    return $mobile;
}

function nullable_string(mixed $value, int $max): ?string
{
    $text = trim((string) $value);
    if ($text === '') {
        return null;
    }
    if (mb_strlen($text) > $max) {
        json_error('One of the fields is too long.', 422);
    }
    return $text;
}

function bounded_string(mixed $value, string $label, int $min, int $max): string
{
    $text = trim((string) $value);
    $length = mb_strlen($text);
    if ($length < $min || $length > $max) {
        json_error($label . ' must be between ' . $min . ' and ' . $max . ' characters.', 422);
    }
    return $text;
}

function optional_text(mixed $value, string $label, int $max): string
{
    $text = trim((string) $value);
    if (mb_strlen($text) > $max) {
        json_error($label . ' must be under ' . $max . ' characters.', 422);
    }
    return $text;
}

function optional_phone(mixed $value, string $label): string
{
    $phone = trim((string) $value);
    if ($phone === '') {
        return '';
    }
    if (normalize_mobile($phone) === null && !preg_match('/^[0-9+\-\s]{8,20}$/', $phone)) {
        json_error('Enter a valid ' . $label . '.', 422);
    }
    return $phone;
}

function optional_email(mixed $value): string
{
    $email = trim((string) $value);
    if ($email === '') {
        return '';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 160) {
        json_error('Enter a valid email address.', 422);
    }
    return $email;
}

function optional_http_url(mixed $value): ?string
{
    $url = trim((string) $value);
    if ($url === '') {
        return null;
    }
    if (
        strlen($url) > 500
        || filter_var($url, FILTER_VALIDATE_URL) === false
        || !preg_match('#^https?://#i', $url)
    ) {
        json_error('Link must be a full http or https URL.', 422);
    }
    return $url;
}

function optional_date(mixed $value, string $label): ?string
{
    $text = trim((string) $value);
    if ($text === '') {
        return null;
    }
    $date = DateTime::createFromFormat('Y-m-d', $text);
    if ($date === false || $date->format('Y-m-d') !== $text) {
        json_error('Enter a valid date for ' . $label . '.', 422);
    }
    return $text;
}

function flag_value(mixed $value, bool $default = true): int
{
    if ($value === null || $value === '') {
        return $default ? 1 : 0;
    }
    return in_array((string) $value, ['1', 'true', 'on', 'yes'], true) ? 1 : 0;
}

function media_url(?string $path): ?string
{
    if ($path === null || $path === '') {
        return null;
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '');
    if ($host === '') {
        $host = (string) parse_url((string) app_config()['url'], PHP_URL_HOST);
    }
    return ($https ? 'https' : 'http') . '://' . $host . '/' . ltrim($path, '/');
}

function store_upload(string $field, string $folder): ?string
{
    if (!isset($_FILES[$field]) || !is_array($_FILES[$field])) {
        return null;
    }
    $file = $_FILES[$field];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        json_error('The file could not be uploaded.', 400);
    }
    if (($file['size'] ?? 0) > 5 * 1024 * 1024) {
        json_error('File must be under 5 MB.', 422);
    }
    $ext = upload_extension((string) $file['tmp_name'], $folder === 'complaints');
    if ($ext === null) {
        json_error(
            $folder === 'complaints'
                ? 'Upload a JPG, PNG, WEBP, GIF, or PDF.'
                : 'Upload a JPG, PNG, WEBP, or GIF image.',
            422
        );
    }
    if (!in_array($folder, ['flyers', 'complaints', 'branding', 'members'], true)) {
        json_error('Invalid upload folder.', 500);
    }
    $name = bin2hex(random_bytes(16)) . '.' . $ext;
    $dir = base_path('uploads/' . $folder);
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        json_error('Could not store the image.', 500);
    }
    $dest = $dir . '/' . $name;
    if (!move_uploaded_file((string) $file['tmp_name'], $dest)) {
        json_error('Could not store the image.', 500);
    }
    return 'uploads/' . $folder . '/' . $name;
}

function upload_extension(string $tmp, bool $allowPdf): ?string
{
    $info = @getimagesize($tmp);
    if ($info !== false) {
        return match ($info[2]) {
            IMAGETYPE_JPEG => 'jpg',
            IMAGETYPE_PNG => 'png',
            IMAGETYPE_WEBP => 'webp',
            IMAGETYPE_GIF => 'gif',
            default => null,
        };
    }
    if (!$allowPdf) {
        return null;
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($tmp);
    $head = (string) file_get_contents($tmp, false, null, 0, 5);
    if ($mime === 'application/pdf' && str_starts_with($head, '%PDF-')) {
        return 'pdf';
    }
    return null;
}

function delete_upload(?string $path): void
{
    if ($path === null || $path === '') {
        return;
    }
    if (!preg_match('#^uploads/(flyers|complaints|branding|members)/[A-Za-z0-9]+\.(jpg|png|webp|gif|pdf)$#', $path)) {
        return;
    }
    $full = base_path($path);
    if (is_file($full)) {
        unlink($full);
    }
}

function association_row(): array
{
    $row = db()->query('SELECT * FROM settings WHERE id = 1')->fetch();
    if (!$row) {
        return [
            'association_name' => 'Dombivali Medical Association',
            'tagline' => 'For medical stores in Dombivali',
            'copyright' => '',
            'logo_path' => null,
            'support_mobile' => '',
            'whatsapp' => '',
            'support_email' => '',
            'address' => '',
            'office_hours' => '',
        ];
    }
    return $row;
}

function association_payload(?array $row = null): array
{
    $row ??= association_row();
    return [
        'name' => (string) $row['association_name'],
        'tagline' => (string) ($row['tagline'] ?? ''),
        'copyright' => (string) ($row['copyright'] ?? ''),
        'logo_url' => media_url($row['logo_path'] ?? null),
        'support_mobile' => (string) ($row['support_mobile'] ?? ''),
        'whatsapp' => (string) ($row['whatsapp'] ?? ''),
        'support_email' => (string) ($row['support_email'] ?? ''),
        'address' => (string) ($row['address'] ?? ''),
        'office_hours' => (string) ($row['office_hours'] ?? ''),
    ];
}

function member_payload(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'owner_name' => (string) $row['owner_name'],
        'shop_name' => (string) $row['shop_name'],
        'partner2_name' => member_text($row, 'partner2_name'),
        'partner3_name' => member_text($row, 'partner3_name'),
        'mobile' => (string) $row['mobile'],
        'email' => (string) $row['email'],
        'address' => (string) $row['address'],
        'residential_address' => member_text($row, 'residential_address'),
        'partner2_address' => member_text($row, 'partner2_address'),
        'partner3_address' => member_text($row, 'partner3_address'),
        'licence_f20' => member_text($row, 'licence_f20'),
        'licence_f20c' => member_text($row, 'licence_f20c'),
        'licence_f21' => member_text($row, 'licence_f21'),
        'licence_f21b' => member_text($row, 'licence_f21b'),
        'drug_licence_no' => member_text($row, 'drug_licence_no'),
        'details_complete' => trim((string) ($row['shop_name'] ?? '')) !== ''
            && trim((string) ($row['drug_licence_no'] ?? '')) !== ''
            && !empty($row['photo_path']),
        'qualified_person_name' => member_text($row, 'qualified_person_name'),
        'pharmacist_reg_no' => $row['pharmacist_reg_no'] !== null ? (string) $row['pharmacist_reg_no'] : '',
        'qualified_person_address' => member_text($row, 'qualified_person_address'),
        'qualified_person_phone' => member_text($row, 'qualified_person_phone'),
        'qualified_person2_name' => member_text($row, 'qualified_person2_name'),
        'qualified_person2_reg' => member_text($row, 'qualified_person2_reg'),
        'qualified_person2_address' => member_text($row, 'qualified_person2_address'),
        'qualified_person2_phone' => member_text($row, 'qualified_person2_phone'),
        'photo_url' => media_url($row['photo_path'] ?? null),
        'status' => (string) $row['status'],
        'last_login_at' => $row['last_login_at'],
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'] ?? null,
    ];
}

function member_text(array $row, string $key): string
{
    return isset($row[$key]) && $row[$key] !== null ? (string) $row[$key] : '';
}

function admin_payload(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'name' => (string) $row['name'],
        'username' => (string) $row['username'],
        'last_login_at' => $row['last_login_at'],
    ];
}

function complaint_payload(array $row, bool $withMember = false): array
{
    $payload = [
        'id' => (int) $row['id'],
        'member_id' => (int) $row['member_id'],
        'category_id' => isset($row['category_id']) && $row['category_id'] !== null ? (int) $row['category_id'] : null,
        'category_name' => (string) ($row['category_name'] ?? ''),
        'title' => (string) $row['title'],
        'details' => (string) $row['details'],
        'photo_url' => media_url($row['photo_path'] ?? null),
        'status' => (string) $row['status'],
        'status_name' => (string) ($row['status_name'] ?? ''),
        'admin_reply' => $row['admin_reply'] !== null ? (string) $row['admin_reply'] : '',
        'replied_at' => $row['replied_at'],
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
    ];
    if ($withMember) {
        $payload['member'] = [
            'id' => (int) $row['member_id'],
            'owner_name' => (string) ($row['owner_name'] ?? ''),
            'shop_name' => (string) ($row['shop_name'] ?? ''),
            'mobile' => (string) ($row['mobile'] ?? ''),
            'drug_licence_no' => (string) ($row['drug_licence_no'] ?? ''),
        ];
    }
    return $payload;
}

function notification_payload(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'complaint_id' => $row['complaint_id'] !== null ? (int) $row['complaint_id'] : null,
        'title' => (string) $row['title'],
        'body' => (string) $row['body'],
        'read_at' => $row['read_at'],
        'created_at' => $row['created_at'],
    ];
}

function complaint_category_payload(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'name' => (string) $row['name'],
        'sort_order' => (int) $row['sort_order'],
        'is_active' => (bool) $row['is_active'],
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
    ];
}

function complaint_status_payload(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'code' => (string) $row['code'],
        'name' => (string) $row['name'],
        'sort_order' => (int) $row['sort_order'],
        'is_active' => (bool) $row['is_active'],
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
    ];
}

function flyer_payload(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'title' => (string) $row['title'],
        'image_url' => media_url((string) $row['image_path']),
        'link_url' => $row['link_url'] !== null ? (string) $row['link_url'] : '',
        'starts_on' => $row['starts_on'],
        'ends_on' => $row['ends_on'],
        'is_active' => (bool) $row['is_active'],
        'sort_order' => (int) $row['sort_order'],
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
    ];
}

function is_duplicate(Throwable $e, string $key): bool
{
    return $e instanceof PDOException
        && (string) $e->getCode() === '23000'
        && str_contains($e->getMessage(), $key);
}
