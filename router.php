<?php
declare(strict_types=1);

$path = rawurldecode((string) (parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?? '/'));
$path = '/' . trim($path, '/');
if ($path !== '/') {
    $path = rtrim($path, '/') ?: '/';
}

if (
    str_contains($path, '..')
    || $path === '/router.php'
    || str_starts_with($path, '/includes')
    || str_starts_with($path, '/config')
    || str_starts_with($path, '/database')
    || str_ends_with($path, '.env')
    || str_ends_with($path, '.sql')
) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Not found';
    return true;
}

$full = __DIR__ . ($path === '/' ? '' : $path);
if ($path !== '/' && is_file($full)) {
    $ext = strtolower(pathinfo($full, PATHINFO_EXTENSION));
    $types = ['js' => 'text/javascript; charset=utf-8', 'css' => 'text/css; charset=utf-8', 'html' => 'text/html; charset=utf-8'];
    if (isset($types[$ext])) {
        header('Content-Type: ' . $types[$ext]);
        header('Cache-Control: no-cache');
        readfile($full);
        return true;
    }
    return false;
}

if (str_starts_with($path, '/api')) {
    require __DIR__ . '/api/index.php';
    return true;
}

$serve = static function (string $file): void {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    readfile($file);
};

if ($path === '/admin') {
    $serve(__DIR__ . '/admin/index.html');
    return true;
}
if ($path === '/' || $path === '/member') {
    $serve(__DIR__ . '/member/index.html');
    return true;
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo 'Not found';
return true;
