<?php
declare(strict_types=1);

function permission_catalog(): array
{
    return [
        ['group' => 'Dashboard', 'items' => [
            ['key' => 'dashboard.view', 'label' => 'View dashboard'],
        ]],
        ['group' => 'Members', 'items' => [
            ['key' => 'members.view', 'label' => 'View members'],
            ['key' => 'members.create', 'label' => 'Add member'],
            ['key' => 'members.edit', 'label' => 'Edit member details'],
            ['key' => 'members.status', 'label' => 'Approve, reject, or block'],
            ['key' => 'members.deactivate', 'label' => 'Deactivate member'],
            ['key' => 'members.pdf', 'label' => 'View and download application PDF'],
        ]],
        ['group' => 'Complaints', 'items' => [
            ['key' => 'complaints.view', 'label' => 'View complaints'],
            ['key' => 'complaints.update', 'label' => 'Reply and change status'],
        ]],
        ['group' => 'Complaint categories', 'items' => [
            ['key' => 'categories.view', 'label' => 'View categories'],
            ['key' => 'categories.manage', 'label' => 'Add and edit categories'],
        ]],
        ['group' => 'Complaint status', 'items' => [
            ['key' => 'statuses.view', 'label' => 'View statuses'],
            ['key' => 'statuses.manage', 'label' => 'Add and edit statuses'],
        ]],
        ['group' => 'Flyers', 'items' => [
            ['key' => 'flyers.view', 'label' => 'View flyers'],
            ['key' => 'flyers.create', 'label' => 'Add flyer'],
            ['key' => 'flyers.edit', 'label' => 'Edit flyer'],
            ['key' => 'flyers.delete', 'label' => 'Delete flyer'],
        ]],
        ['group' => 'SMS', 'items' => [
            ['key' => 'sms.view', 'label' => 'View SMS log'],
        ]],
        ['group' => 'Site settings', 'items' => [
            ['key' => 'settings.view', 'label' => 'View site settings'],
            ['key' => 'settings.edit', 'label' => 'Change site settings'],
        ]],
        ['group' => 'Admin manager', 'items' => [
            ['key' => 'staff.view', 'label' => 'View staff'],
            ['key' => 'staff.manage', 'label' => 'Add and edit staff and their rights'],
        ]],
    ];
}

function permission_keys(): array
{
    $keys = [];
    foreach (permission_catalog() as $group) {
        foreach ($group['items'] as $item) {
            $keys[] = $item['key'];
        }
    }
    return $keys;
}

function admin_permission_keys(array $admin): array
{
    if (in_array((string) ($admin['role'] ?? 'staff'), ['superadmin', 'administrator'], true)) {
        return permission_keys();
    }
    $raw = $admin['permissions'] ?? null;
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        $raw = is_array($decoded) ? $decoded : [];
    }
    if (!is_array($raw)) {
        return [];
    }
    $known = array_flip(permission_keys());
    $keys = [];
    foreach ($raw as $key) {
        $key = (string) $key;
        if (isset($known[$key])) {
            $keys[$key] = true;
        }
    }
    return array_keys($keys);
}

function admin_can(array $admin, string $key): bool
{
    return in_array($key, admin_permission_keys($admin), true);
}

function require_permission(string $key): array
{
    $admin = require_admin();
    if (!admin_can($admin, $key)) {
        json_error('You do not have permission for this.', 403);
    }
    return $admin;
}

function require_any_permission(array $keys): array
{
    $admin = require_admin();
    foreach ($keys as $key) {
        if (admin_can($admin, $key)) {
            return $admin;
        }
    }
    json_error('You do not have permission for this.', 403);
}

function permission_keys_from_input(array $in): array
{
    $raw = $in['permissions'] ?? [];
    if (!is_array($raw)) {
        return [];
    }
    $known = array_flip(permission_keys());
    $keys = [];
    foreach ($raw as $key) {
        $key = (string) $key;
        if (isset($known[$key])) {
            $keys[$key] = true;
        }
    }
    return array_keys($keys);
}

function staff_permission_json(string $role, array $keys): ?string
{
    if ($role === 'superadmin' || $role === 'administrator') {
        return null;
    }
    return json_encode(array_values($keys), JSON_UNESCAPED_UNICODE);
}
