<?php
declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';
require dirname(__DIR__) . '/includes/routes.php';

send_cors();

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($method === 'HEAD') {
    $method = 'GET';
}

$uri = rawurldecode((string) (parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?? '/'));
if (!str_starts_with($uri, '/api')) {
    json_error('Not found.', 404);
}
$path = '/' . trim(substr($uri, 4), '/');
if ($path !== '/') {
    $path = rtrim($path, '/') ?: '/';
}

$routes = [
    ['GET', '/health', 'api_health'],
    ['GET', '/association', 'public_association'],
    ['GET', '/flyers', 'public_flyers'],
    ['GET', '/complaint-categories', 'public_complaint_categories'],
    ['GET', '/complaint-statuses', 'public_complaint_statuses'],
    ['POST', '/auth/otp/send', 'auth_otp_send'],
    ['POST', '/auth/otp/verify', 'auth_otp_verify'],
    ['POST', '/auth/register', 'auth_register'],
    ['POST', '/auth/logout', 'auth_logout'],
    ['GET', '/me/application', 'member_application_pdf'],
    ['GET', '/me', 'member_me'],
    ['PUT', '/me', 'member_update'],
    ['PATCH', '/me', 'member_update'],
    ['POST', '/me', 'member_update'],
    ['GET', '/complaints', 'member_complaints'],
    ['POST', '/complaints', 'member_complaint_create'],
    ['GET', '/complaints/{id}', 'member_complaint_show'],
    ['POST', '/complaints/{id}/close', 'member_complaint_close'],
    ['GET', '/notifications', 'member_notifications'],
    ['POST', '/notifications/read', 'member_notifications_read'],
    ['POST', '/admin/login', 'admin_login'],
    ['POST', '/admin/logout', 'auth_logout'],
    ['GET', '/admin/me', 'admin_me'],
    ['GET', '/admin/staff', 'admin_staff_list'],
    ['POST', '/admin/staff', 'admin_staff_create'],
    ['PATCH', '/admin/staff/{id}', 'admin_staff_update'],
    ['POST', '/admin/password', 'admin_password'],
    ['GET', '/admin/dashboard', 'admin_dashboard'],
    ['GET', '/admin/members', 'admin_members'],
    ['POST', '/admin/members', 'admin_member_create'],
    ['GET', '/admin/members/{id}/application', 'admin_member_application_pdf'],
    ['GET', '/admin/members/{id}', 'admin_member_show'],
    ['PATCH', '/admin/members/{id}', 'admin_member_update'],
    ['POST', '/admin/members/{id}', 'admin_member_update'],
    ['DELETE', '/admin/members/{id}', 'admin_member_deactivate'],
    ['GET', '/admin/complaints', 'admin_complaints'],
    ['GET', '/admin/complaints/{id}', 'admin_complaint_show'],
    ['PATCH', '/admin/complaints/{id}', 'admin_complaint_update'],
    ['GET', '/admin/complaint-categories', 'admin_complaint_categories'],
    ['POST', '/admin/complaint-categories', 'admin_complaint_category_create'],
    ['PATCH', '/admin/complaint-categories/{id}', 'admin_complaint_category_update'],
    ['GET', '/admin/complaint-statuses', 'admin_complaint_statuses'],
    ['POST', '/admin/complaint-statuses', 'admin_complaint_status_create'],
    ['PATCH', '/admin/complaint-statuses/{id}', 'admin_complaint_status_update'],
    ['GET', '/admin/flyers', 'admin_flyers'],
    ['POST', '/admin/flyers', 'admin_flyer_create'],
    ['GET', '/admin/flyers/{id}', 'admin_flyer_show'],
    ['POST', '/admin/flyers/{id}', 'admin_flyer_update'],
    ['DELETE', '/admin/flyers/{id}', 'admin_flyer_delete'],
    ['GET', '/admin/sms', 'admin_sms'],
    ['GET', '/admin/settings', 'admin_settings_get'],
    ['POST', '/admin/settings', 'admin_settings_save'],
];

foreach ($routes as [$routeMethod, $pattern, $handler]) {
    if ($routeMethod !== $method) {
        continue;
    }
    $regex = '#^' . preg_replace('#\{([A-Za-z_]+)\}#', '(?P<$1>[0-9]+)', $pattern) . '$#';
    if (!preg_match($regex, $path, $matches)) {
        continue;
    }
    $args = [];
    foreach ($matches as $key => $value) {
        if (is_string($key)) {
            $args[] = (int) $value;
        }
    }
    $handler(...$args);
    exit;
}

json_error('Not found.', 404);
