<?php
declare(strict_types=1);

function issue_token(string $type, int $subjectId, ?string $mobile, int $ttlSeconds): string
{
    $token = bin2hex(random_bytes(32));
    $stmt = db()->prepare(
        'INSERT INTO api_tokens (token_hash, subject_type, subject_id, mobile, expires_at)
         VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))'
    );
    $stmt->execute([hash('sha256', $token), $type, $subjectId, $mobile, $ttlSeconds]);
    return $token;
}

function current_auth(): ?array
{
    static $cached = false;
    static $row = null;
    if ($cached) {
        return $row;
    }
    $cached = true;
    db()->exec('DELETE FROM api_tokens WHERE expires_at < NOW()');
    $token = bearer_token();
    if ($token === null) {
        return null;
    }
    $stmt = db()->prepare(
        'SELECT * FROM api_tokens WHERE token_hash = ? AND expires_at > NOW() LIMIT 1'
    );
    $stmt->execute([hash('sha256', $token)]);
    $found = $stmt->fetch();
    $row = $found ?: null;
    return $row;
}

function forget_current_token(): void
{
    $auth = current_auth();
    if (!$auth) {
        return;
    }
    db()->prepare('DELETE FROM api_tokens WHERE id = ?')->execute([(int) $auth['id']]);
}

function require_admin(): array
{
    $auth = current_auth();
    if (!$auth || $auth['subject_type'] !== 'admin') {
        json_error('Admin sign-in required.', 401);
    }
    $stmt = db()->prepare('SELECT * FROM admins WHERE id = ? AND is_active = 1 LIMIT 1');
    $stmt->execute([(int) $auth['subject_id']]);
    $admin = $stmt->fetch();
    if (!$admin) {
        json_error('Admin sign-in required.', 401);
    }
    return $admin;
}

function require_member(): array
{
    $auth = current_auth();
    if (!$auth || $auth['subject_type'] !== 'member') {
        json_error('Member sign-in required.', 401);
    }
    $stmt = db()->prepare('SELECT * FROM members WHERE id = ? LIMIT 1');
    $stmt->execute([(int) $auth['subject_id']]);
    $member = $stmt->fetch();
    if (!$member) {
        json_error('Member sign-in required.', 401);
    }
    if ($member['status'] === 'deactivated') {
        json_error('This account is deactivated and cannot sign in.', 401);
    }
    if ($member['status'] === 'blocked') {
        json_error('This membership is blocked. Contact the association.', 401);
    }
    return $member;
}

function require_superadmin(): array
{
    $admin = require_admin();
    if (($admin['role'] ?? 'staff') !== 'superadmin') {
        json_error('Only a super admin can manage staff.', 403);
    }
    return $admin;
}

function require_approved_member(): array
{
    $member = require_member();
    if ($member['status'] !== 'approved') {
        json_error('Your membership is not approved yet. Complaints open after the association checks your drug licence.', 403);
    }
    return $member;
}

function require_registration(): array
{
    $auth = current_auth();
    if (!$auth || $auth['subject_type'] !== 'registration' || trim((string) $auth['mobile']) === '') {
        json_error('Verify your mobile number again.', 401);
    }
    return $auth;
}
