<?php
declare(strict_types=1);

function api_health(): void
{
    json_ok([
        'service' => 'dombivali-medical',
        'sms' => sms_mode(),
    ]);
}

function public_association(): void
{
    json_ok(association_payload());
}

function public_complaint_categories(): void
{
    $rows = db()->query(
        'SELECT * FROM complaint_categories WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    )->fetchAll();
    json_ok(array_map('complaint_category_payload', $rows));
}

function public_complaint_statuses(): void
{
    $rows = db()->query(
        'SELECT * FROM complaint_statuses WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    )->fetchAll();
    json_ok(array_map('complaint_status_payload', $rows));
}

function public_flyers(): void
{
    $rows = db()->query(
        'SELECT * FROM flyers
         WHERE is_active = 1
           AND (starts_on IS NULL OR starts_on <= CURDATE())
           AND (ends_on IS NULL OR ends_on >= CURDATE())
         ORDER BY sort_order ASC, id DESC'
    )->fetchAll();
    json_ok(array_map('flyer_payload', $rows));
}

function auth_purpose(array $in): string
{
    $purpose = (string) ($in['purpose'] ?? 'login');
    if (!in_array($purpose, ['login', 'register'], true)) {
        json_error('Choose sign in or sign up.', 422);
    }
    return $purpose;
}

function auth_otp_send(): void
{
    $in = request_json();
    $mobile = require_mobile($in);
    $purpose = auth_purpose($in);
    $stmt = db()->prepare('SELECT status FROM members WHERE mobile = ? LIMIT 1');
    $stmt->execute([$mobile]);
    $status = $stmt->fetchColumn();
    if ($purpose === 'login') {
        if ($status === false) {
            json_error('No account found for this mobile number. Sign up first.', 404);
        }
        if ($status === 'deactivated') {
            json_error('This account is deactivated and cannot sign in.', 403);
        }
        if ($status === 'blocked') {
            json_error('This number is blocked. Contact the association.', 403);
        }
    } else {
        if ($status === 'deactivated') {
            json_error('This account is deactivated and cannot be registered again.', 403);
        }
        if ($status !== false) {
            json_error('This mobile number is already registered. Sign in instead.', 409);
        }
    }
    $sent = sms_send_otp($mobile);
    $sent['purpose'] = $purpose;
    json_ok($sent);
}

function auth_otp_verify(): void
{
    $in = request_json();
    $mobile = require_mobile($in);
    $purpose = auth_purpose($in);
    $otp = trim((string) ($in['otp'] ?? ''));
    if (!preg_match('/^\d{4,8}$/', $otp)) {
        json_error('Enter the OTP from the SMS.', 422);
    }
    sms_verify_otp($mobile, $otp);

    $stmt = db()->prepare('SELECT * FROM members WHERE mobile = ? LIMIT 1');
    $stmt->execute([$mobile]);
    $member = $stmt->fetch();
    if ($purpose === 'register') {
        if ($member && $member['status'] === 'deactivated') {
            json_error('This account is deactivated and cannot be registered again.', 403);
        }
        if ($member) {
            json_error('This mobile number is already registered. Sign in instead.', 409);
        }
        db()->prepare(
            "DELETE FROM api_tokens WHERE subject_type = 'registration' AND mobile = ?"
        )->execute([$mobile]);
        $registration = issue_token('registration', 0, $mobile, 15 * 60);
        json_ok([
            'needs_profile' => true,
            'registration_token' => $registration,
            'mobile' => $mobile,
        ]);
    }

    if (!$member) {
        json_error('No account found for this mobile number. Sign up first.', 404);
    }
    if ($member['status'] === 'deactivated') {
        json_error('This account is deactivated and cannot sign in.', 403);
    }
    if ($member['status'] === 'blocked') {
        json_error('This number is blocked. Contact the association.', 403);
    }
    db()->prepare('UPDATE members SET last_login_at = NOW() WHERE id = ?')->execute([(int) $member['id']]);
    $member['last_login_at'] = date('Y-m-d H:i:s');
    $token = issue_token('member', (int) $member['id'], $mobile, 30 * 24 * 3600);
    json_ok([
        'needs_profile' => false,
        'token' => $token,
        'member' => member_payload($member),
    ]);
}

function auth_register(): void
{
    $auth = require_registration();
    $mobile = (string) $auth['mobile'];
    $in = input();
    $name = bounded_string($in['owner_name'] ?? '', 'Name', 2, 120);
    $email = optional_email($in['email'] ?? '');
    if ($email === '') {
        json_error('Enter an email address.', 422);
    }

    $exists = db()->prepare('SELECT id FROM members WHERE mobile = ? LIMIT 1');
    $exists->execute([$mobile]);
    if ($exists->fetch()) {
        json_error('This mobile number is already registered. Sign in instead.', 409);
    }

    try {
        $stmt = db()->prepare(
            'INSERT INTO members (owner_name, shop_name, mobile, email, address, drug_licence_no, office_bearers, status, last_login_at)
             VALUES (?, "", ?, ?, "", NULL, ?, "pending", NOW())'
        );
        $stmt->execute([$name, $mobile, $email, office_bearers_json()]);
        $id = (int) db()->lastInsertId();
    } catch (PDOException $e) {
        member_write_error($e);
        throw $e;
    }

    db()->prepare(
        "DELETE FROM api_tokens WHERE subject_type = 'registration' AND mobile = ?"
    )->execute([$mobile]);
    $token = issue_token('member', $id, $mobile, 30 * 24 * 3600);
    $member = db()->prepare('SELECT * FROM members WHERE id = ?');
    $member->execute([$id]);
    json_ok([
        'token' => $token,
        'member' => member_payload($member->fetch()),
    ], 201);
}

function auth_logout(): void
{
    forget_current_token();
    json_ok(['signed_out' => true]);
}

function member_me(): void
{
    json_ok(member_payload(require_member(), true));
}

function member_application_pdf(): void
{
    adopt_download_token();
    send_application_pdf(require_member());
}

function member_update(): void
{
    $member = require_member();
    $in = input();
    reject_licence_change($member, $in);
    if ($member['status'] !== 'approved' && empty($member['photo_path']) && !member_has_new_photo()) {
        json_error('Upload a passport-size photo of the shop owner.', 422);
    }
    save_member_fields((int) $member['id'], $in, false);
    save_member_photo((int) $member['id'], $member['photo_path'] ?? null, false);
    $stmt = db()->prepare('SELECT * FROM members WHERE id = ?');
    $stmt->execute([(int) $member['id']]);
    json_ok(member_payload($stmt->fetch(), true));
}

function member_complaints(): void
{
    $member = require_member();
    $stmt = db()->prepare(
        'SELECT c.*, cat.name AS category_name, st.name AS status_name
         FROM complaints c
         LEFT JOIN complaint_categories cat ON cat.id = c.category_id
         LEFT JOIN complaint_statuses st ON st.code = c.status
         WHERE c.member_id = ?
         ORDER BY c.id DESC'
    );
    $stmt->execute([(int) $member['id']]);
    json_ok(array_map(static fn (array $row): array => complaint_payload($row), $stmt->fetchAll()));
}

function member_complaint_show(int $id): void
{
    $member = require_member();
    $stmt = db()->prepare(
        'SELECT c.*, cat.name AS category_name, st.name AS status_name
         FROM complaints c
         LEFT JOIN complaint_categories cat ON cat.id = c.category_id
         LEFT JOIN complaint_statuses st ON st.code = c.status
         WHERE c.id = ? AND c.member_id = ?
         LIMIT 1'
    );
    $stmt->execute([$id, (int) $member['id']]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Complaint not found.', 404);
    }
    json_ok(complaint_payload($row));
}

function member_complaint_create(): void
{
    $member = require_approved_member();
    $in = input();
    $category = active_complaint_category((int) ($in['category_id'] ?? 0));
    $title = bounded_string($in['title'] ?? '', 'Subject', 5, 160);
    $details = bounded_string($in['details'] ?? '', 'Description', 10, 5000);
    $photo = store_upload('photo', 'complaints');
    $stmt = db()->prepare(
        'INSERT INTO complaints (member_id, category_id, title, details, photo_path, status)
         VALUES (?, ?, ?, ?, ?, "submitted")'
    );
    $stmt->execute([(int) $member['id'], (int) $category['id'], $title, $details, $photo]);
    $id = (int) db()->lastInsertId();
    json_ok(complaint_payload(complaint_row_for_member($id, (int) $member['id'])), 201);
}

function member_complaint_close(int $id): void
{
    $member = require_approved_member();
    $row = complaint_row_for_member($id, (int) $member['id']);
    if ((string) $row['status'] !== 'resolved') {
        $status = complaint_status_row('resolved');
        if (!$status || !(int) $status['is_active']) {
            json_error('Closing tickets is not available right now.', 422);
        }
        db()->prepare('UPDATE complaints SET status = ? WHERE id = ? AND member_id = ?')->execute([
            'resolved',
            $id,
            (int) $member['id'],
        ]);
    }
    json_ok(complaint_payload(complaint_row_for_member($id, (int) $member['id'])));
}

function member_notifications(): void
{
    $member = require_member();
    $stmt = db()->prepare(
        'SELECT * FROM member_notifications WHERE member_id = ? ORDER BY id DESC LIMIT 30'
    );
    $stmt->execute([(int) $member['id']]);
    json_ok(array_map('notification_payload', $stmt->fetchAll()));
}

function member_notifications_read(): void
{
    $member = require_member();
    $in = request_json();
    $sql = 'UPDATE member_notifications SET read_at = NOW() WHERE member_id = ? AND read_at IS NULL';
    $params = [(int) $member['id']];
    if (!empty($in['complaint_id'])) {
        $sql .= ' AND complaint_id = ?';
        $params[] = (int) $in['complaint_id'];
    } elseif (!empty($in['id'])) {
        $sql .= ' AND id = ?';
        $params[] = (int) $in['id'];
    }
    db()->prepare($sql)->execute($params);
    json_ok(['read' => true]);
}

function admin_login(): void
{
    $in = request_json();
    $username = trim((string) ($in['username'] ?? ''));
    $password = (string) ($in['password'] ?? '');
    if ($username === '' || $password === '') {
        json_error('Enter username and password.', 422);
    }
    $stmt = db()->prepare('SELECT * FROM admins WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $admin = $stmt->fetch();
    $hash = $admin['password_hash'] ?? '$2y$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    if (!$admin || !(int) $admin['is_active'] || !password_verify($password, (string) $hash)) {
        json_error('Invalid username or password.', 401);
    }
    db()->prepare('UPDATE admins SET last_login_at = NOW() WHERE id = ?')->execute([(int) $admin['id']]);
    $admin['last_login_at'] = date('Y-m-d H:i:s');
    $token = issue_token('admin', (int) $admin['id'], null, 7 * 24 * 3600);
    $payload = admin_payload($admin);
    $payload['permission_catalog'] = permission_catalog();
    json_ok([
        'token' => $token,
        'admin' => $payload,
    ]);
}

function admin_me(): void
{
    $payload = admin_payload(require_admin());
    $payload['permission_catalog'] = permission_catalog();
    json_ok($payload);
}

function admin_staff_list(): void
{
    require_any_permission(['staff.view', 'staff.manage']);
    $rows = db()->query('SELECT * FROM admins ORDER BY id ASC')->fetchAll();
    json_ok(array_map('admin_payload', $rows));
}

function admin_staff_create(): void
{
    $actor = require_permission('staff.manage');
    $in = request_json();
    $fields = staff_fields($in, true, null);
    guard_staff_change($actor, null, $fields);
    try {
        db()->prepare(
            'INSERT INTO admins (name, username, password_hash, role, permissions, is_active) VALUES (?, ?, ?, ?, ?, ?)'
        )->execute([
            $fields['name'],
            $fields['username'],
            password_hash($fields['password'], PASSWORD_DEFAULT),
            $fields['role'],
            $fields['permissions_json'],
            $fields['is_active'],
        ]);
    } catch (PDOException $e) {
        if (is_duplicate($e, 'uq_admins_username')) {
            json_error('That username is already used.', 422);
        }
        throw $e;
    }
    json_ok(admin_payload(staff_row((int) db()->lastInsertId())), 201);
}

function admin_staff_update(int $id): void
{
    $actor = require_permission('staff.manage');
    $existing = staff_row($id);
    $in = request_json();
    $fields = staff_fields($in, false, $existing);
    guard_staff_change($actor, $existing, $fields);
    try {
        if ($fields['password'] !== '') {
            db()->prepare(
                'UPDATE admins SET name = ?, username = ?, password_hash = ?, role = ?, permissions = ?, is_active = ? WHERE id = ?'
            )->execute([
                $fields['name'],
                $fields['username'],
                password_hash($fields['password'], PASSWORD_DEFAULT),
                $fields['role'],
                $fields['permissions_json'],
                $fields['is_active'],
                $id,
            ]);
        } else {
            db()->prepare(
                'UPDATE admins SET name = ?, username = ?, role = ?, permissions = ?, is_active = ? WHERE id = ?'
            )->execute([
                $fields['name'],
                $fields['username'],
                $fields['role'],
                $fields['permissions_json'],
                $fields['is_active'],
                $id,
            ]);
        }
    } catch (PDOException $e) {
        if (is_duplicate($e, 'uq_admins_username')) {
            json_error('That username is already used.', 422);
        }
        throw $e;
    }
    json_ok(admin_payload(staff_row($id)));
}

function staff_row(int $id): array
{
    $stmt = db()->prepare('SELECT * FROM admins WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Staff member not found.', 404);
    }
    return $row;
}

function staff_fields(array $in, bool $create, ?array $existing): array
{
    $username = strtolower(trim((string) ($in['username'] ?? '')));
    if (!preg_match('/^[a-z][a-z0-9._]{2,59}$/', $username)) {
        json_error('Username must be 3 to 60 letters, numbers, dots, or underscores.', 422);
    }
    $role = (string) ($in['role'] ?? ($existing['role'] ?? 'staff'));
    if (!in_array($role, ['superadmin', 'administrator', 'staff'], true)) {
        json_error('Choose Staff, Administrator, or Super admin.', 422);
    }
    $password = (string) ($in['password'] ?? '');
    if ($create || $password !== '') {
        if (strlen($password) < 8 || strlen($password) > 72) {
            json_error('Password must be 8 to 72 characters.', 422);
        }
    }
    $permissionKeys = permission_keys_from_input($in);
    return [
        'name' => bounded_string($in['name'] ?? '', 'Name', 2, 120),
        'username' => $username,
        'password' => $password,
        'role' => $role,
        'permission_keys' => $permissionKeys,
        'permissions_json' => staff_permission_json($role, $permissionKeys),
        'is_active' => flag_value($in['is_active'] ?? '1', true),
    ];
}

function guard_staff_change(array $actor, ?array $existing, array $fields): void
{
    if ($fields['role'] === 'superadmin' && ($actor['role'] ?? '') !== 'superadmin') {
        json_error('Only a super admin can assign that role.', 403);
    }
    if ($fields['role'] === 'administrator' && !in_array((string) ($actor['role'] ?? ''), ['superadmin', 'administrator'], true)) {
        json_error('Only a super admin or an administrator can assign that role.', 403);
    }
    if ($existing && ($existing['role'] ?? '') === 'superadmin' && ($actor['role'] ?? '') !== 'superadmin') {
        json_error('Only a super admin can change a super admin account.', 403);
    }
    if ($existing && ($existing['role'] ?? '') === 'administrator' && !in_array((string) ($actor['role'] ?? ''), ['superadmin', 'administrator'], true)) {
        json_error('Only a super admin or an administrator can change an administrator account.', 403);
    }
    if ($fields['role'] === 'staff') {
        foreach ($fields['permission_keys'] as $key) {
            if (!admin_can($actor, $key)) {
                json_error('You can only give rights that your account already has.', 422);
            }
        }
    }
    if ($existing && (int) $actor['id'] === (int) $existing['id'] && !$fields['is_active']) {
        json_error('You cannot deactivate your own account.', 422);
    }
    if (!$existing) {
        return;
    }
    $wasSuper = (string) $existing['role'] === 'superadmin' && (int) $existing['is_active'] === 1;
    $staysSuper = $fields['role'] === 'superadmin' && $fields['is_active'];
    if ($wasSuper && !$staysSuper) {
        $stmt = db()->prepare("SELECT COUNT(*) FROM admins WHERE role = 'superadmin' AND is_active = 1 AND id <> ?");
        $stmt->execute([(int) $existing['id']]);
        if ((int) $stmt->fetchColumn() === 0) {
            json_error('Keep at least one active super admin.', 422);
        }
    }
}

function admin_password(): void
{
    $admin = require_admin();
    $in = request_json();
    $current = (string) ($in['current_password'] ?? '');
    $next = (string) ($in['new_password'] ?? '');
    if (!password_verify($current, (string) $admin['password_hash'])) {
        json_error('Current password is incorrect.', 422);
    }
    if (strlen($next) < 8 || strlen($next) > 72) {
        json_error('New password must be 8 to 72 characters.', 422);
    }
    db()->prepare('UPDATE admins SET password_hash = ? WHERE id = ?')->execute([
        password_hash($next, PASSWORD_DEFAULT),
        (int) $admin['id'],
    ]);
    json_ok(['updated' => true]);
}

function admin_dashboard(): void
{
    $admin = require_permission('dashboard.view');
    $members = admin_can($admin, 'members.view');
    $complaintsAllowed = admin_can($admin, 'complaints.view');
    $flyers = admin_can($admin, 'flyers.view');
    $counts = [
        'members' => (int) db()->query('SELECT COUNT(*) FROM members')->fetchColumn(),
        'pending_members' => (int) db()->query("SELECT COUNT(*) FROM members WHERE status = 'pending'")->fetchColumn(),
        'open_complaints' => (int) db()->query(
            "SELECT COUNT(*) FROM complaints WHERE status IN ('submitted','in_progress','under_review')"
        )->fetchColumn(),
        'active_flyers' => (int) db()->query(
            'SELECT COUNT(*) FROM flyers
             WHERE is_active = 1
               AND (starts_on IS NULL OR starts_on <= CURDATE())
               AND (ends_on IS NULL OR ends_on >= CURDATE())'
        )->fetchColumn(),
    ];
    $pending = db()->query(
        "SELECT * FROM members WHERE status = 'pending' ORDER BY created_at ASC LIMIT 8"
    )->fetchAll();
    $complaints = db()->query(
        complaint_admin_select() . "
         WHERE c.status IN ('submitted','in_progress','under_review')
         ORDER BY c.created_at ASC
         LIMIT 8"
    )->fetchAll();
    json_ok([
        'access' => [
            'members' => $members,
            'complaints' => $complaintsAllowed,
            'flyers' => $flyers,
        ],
        'counts' => [
            'members' => $members ? $counts['members'] : 0,
            'pending_members' => $members ? $counts['pending_members'] : 0,
            'open_complaints' => $complaintsAllowed ? $counts['open_complaints'] : 0,
            'active_flyers' => $flyers ? $counts['active_flyers'] : 0,
        ],
        'pending_members' => $members ? array_map('member_payload', $pending) : [],
        'open_complaints' => $complaintsAllowed ? array_map(
            static fn (array $row): array => complaint_payload($row, true),
            $complaints
        ) : [],
    ]);
}

function admin_members(): void
{
    require_any_permission(['members.view', 'members.edit', 'members.status', 'members.deactivate', 'members.pdf']);
    $status = (string) ($_GET['status'] ?? '');
    $q = trim((string) ($_GET['q'] ?? ''));
    $sql = 'SELECT * FROM members WHERE 1 = 1';
    $params = [];
    if (in_array($status, ['pending', 'approved', 'rejected', 'blocked', 'deactivated'], true)) {
        $sql .= ' AND status = ?';
        $params[] = $status;
    }
    if ($q !== '') {
        $sql .= ' AND (owner_name LIKE ? OR shop_name LIKE ? OR mobile LIKE ? OR drug_licence_no LIKE ?
            OR licence_f20 LIKE ? OR licence_f20c LIKE ? OR licence_f21 LIKE ? OR licence_f21b LIKE ?
            OR qualified_person_name LIKE ?
            OR EXISTS (
                SELECT 1 FROM member_licence_history h
                WHERE h.member_id = members.id AND h.licence_no LIKE ?
            ))';
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like, $like, $like, $like, $like, $like, $like, $like);
    }
    $sql .= ' ORDER BY created_at DESC LIMIT 200';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    json_ok(array_map('member_payload', $stmt->fetchAll()));
}

function admin_member_create(): void
{
    require_permission('members.create');
    $in = input();
    $mobile = require_mobile($in);
    $profile = member_profile_from_input($in, true, null);
    $images = prepare_licence_images(null, $profile);
    $profile = array_merge($profile, $images['columns']);
    $photo = store_upload('photo', 'members');
    try {
        $id = insert_member($profile, $mobile, 'approved', $photo, false);
    } catch (PDOException $e) {
        delete_upload($photo);
        foreach ($images['created'] as $path) {
            delete_upload($path);
        }
        member_write_error($e);
        throw $e;
    }
    $row = db()->prepare('SELECT * FROM members WHERE id = ?');
    $row->execute([$id]);
    json_ok(member_payload($row->fetch(), true), 201);
}

function admin_member_show(int $id): void
{
    require_any_permission(['members.view', 'members.edit', 'members.status', 'members.deactivate', 'members.pdf']);
    $stmt = db()->prepare('SELECT * FROM members WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Member not found.', 404);
    }
    json_ok(member_payload($row, true));
}

function admin_member_application_pdf(int $id): void
{
    adopt_download_token();
    require_permission('members.pdf');
    $stmt = db()->prepare('SELECT * FROM members WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Member not found.', 404);
    }
    send_application_pdf($row);
}

function adopt_download_token(): void
{
    if (bearer_token() !== null) {
        return;
    }
    $token = trim((string) ($_GET['token'] ?? ''));
    if ($token === '' || !preg_match('/\A[a-f0-9]{64}\z/', $token)) {
        return;
    }
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
}

function admin_member_update(int $id): void
{
    $stmt = db()->prepare('SELECT * FROM members WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_error('Member not found.', 404);
    }
    $in = input();
    $statusOnly = array_key_exists('status', $in) && count(array_diff(array_keys($in), ['status'])) === 0;
    if ($statusOnly) {
        require_permission('members.status');
    } else {
        require_permission('members.edit');
        if (array_key_exists('status', $in) && (string) $in['status'] !== (string) $existing['status']) {
            require_permission('members.status');
        }
    }
    if ($existing['status'] === 'deactivated' && array_key_exists('status', $in) && (string) $in['status'] !== 'deactivated') {
        json_error('A deactivated account cannot sign in again.', 422);
    }
    save_member_fields($id, $in, true);
    save_member_photo($id, $existing['photo_path'] ?? null, false);
    $stmt->execute([$id]);
    json_ok(member_payload($stmt->fetch(), true));
}

function admin_member_deactivate(int $id): void
{
    require_permission('members.deactivate');
    $stmt = db()->prepare('SELECT * FROM members WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        json_error('Member not found.', 404);
    }
    db()->prepare("UPDATE members SET status = 'deactivated' WHERE id = ?")->execute([$id]);
    db()->prepare("DELETE FROM api_tokens WHERE subject_type = 'member' AND subject_id = ?")->execute([$id]);
    $stmt->execute([$id]);
    json_ok(member_payload($stmt->fetch()));
}

function admin_complaints(): void
{
    require_any_permission(['complaints.view', 'complaints.update']);
    $status = (string) ($_GET['status'] ?? '');
    $sql = complaint_admin_select() . ' WHERE 1 = 1';
    $params = [];
    if ($status !== '') {
        if (!complaint_status_row($status)) {
            json_error('Choose a valid complaint status.', 422);
        }
        $sql .= ' AND c.status = ?';
        $params[] = $status;
    }
    $sql .= ' ORDER BY c.created_at DESC LIMIT 200';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    json_ok(array_map(static fn (array $row): array => complaint_payload($row, true), $stmt->fetchAll()));
}

function admin_complaint_show(int $id): void
{
    require_any_permission(['complaints.view', 'complaints.update']);
    $row = admin_complaint_row($id);
    json_ok(complaint_payload($row, true));
}

function admin_complaint_update(int $id): void
{
    $admin = require_permission('complaints.update');
    $existing = admin_complaint_row($id);
    $in = request_json();
    $status = (string) ($in['status'] ?? $existing['status']);
    $statusRow = complaint_status_row($status);
    if (!$statusRow || (!(int) $statusRow['is_active'] && $status !== (string) $existing['status'])) {
        json_error('Choose a valid complaint status.', 422);
    }
    $reply = array_key_exists('admin_reply', $in)
        ? trim((string) $in['admin_reply'])
        : (string) ($existing['admin_reply'] ?? '');
    if (mb_strlen($reply) > 5000) {
        json_error('Reply must be under 5000 characters.', 422);
    }
    $replyValue = $reply === '' ? null : $reply;
    $repliedAt = $replyValue === null ? null : date('Y-m-d H:i:s');
    $repliedBy = $replyValue === null ? null : (int) $admin['id'];
    if ($replyValue !== null && $replyValue === (string) ($existing['admin_reply'] ?? '') && $existing['replied_at']) {
        $repliedAt = $existing['replied_at'];
        $repliedBy = $existing['replied_by'] !== null ? (int) $existing['replied_by'] : null;
    }
    db()->prepare(
        'UPDATE complaints
         SET status = ?, admin_reply = ?, replied_at = ?, replied_by = ?
         WHERE id = ?'
    )->execute([$status, $replyValue, $repliedAt, $repliedBy, $id]);
    $notes = [];
    if ($status !== (string) $existing['status']) {
        $notes[] = 'Status is now ' . $statusRow['name'] . '.';
    }
    $previousReply = (string) ($existing['admin_reply'] ?? '');
    if ($replyValue !== null && $replyValue !== $previousReply) {
        $notes[] = 'The association sent a reply.';
    }
    if ($notes) {
        notify_member(
            (int) $existing['member_id'],
            $id,
            (string) $existing['title'],
            implode(' ', $notes)
        );
    }
    json_ok(complaint_payload(admin_complaint_row($id), true));
}

function admin_complaint_categories(): void
{
    require_any_permission(['categories.view', 'categories.manage']);
    $rows = db()->query('SELECT * FROM complaint_categories ORDER BY sort_order ASC, id ASC')->fetchAll();
    json_ok(array_map('complaint_category_payload', $rows));
}

function admin_complaint_category_create(): void
{
    require_permission('categories.manage');
    $fields = complaint_category_fields(request_json());
    try {
        $stmt = db()->prepare(
            'INSERT INTO complaint_categories (name, sort_order, is_active) VALUES (?, ?, ?)'
        );
        $stmt->execute([$fields['name'], $fields['sort_order'], $fields['is_active']]);
    } catch (PDOException $e) {
        if (is_duplicate($e, 'uq_complaint_categories_name')) {
            json_error('That category name already exists.', 409);
        }
        throw $e;
    }
    json_ok(complaint_category_payload(complaint_category_row((int) db()->lastInsertId())), 201);
}

function admin_complaint_category_update(int $id): void
{
    require_permission('categories.manage');
    complaint_category_row($id);
    $fields = complaint_category_fields(request_json());
    try {
        db()->prepare(
            'UPDATE complaint_categories SET name = ?, sort_order = ?, is_active = ? WHERE id = ?'
        )->execute([$fields['name'], $fields['sort_order'], $fields['is_active'], $id]);
    } catch (PDOException $e) {
        if (is_duplicate($e, 'uq_complaint_categories_name')) {
            json_error('That category name already exists.', 409);
        }
        throw $e;
    }
    json_ok(complaint_category_payload(complaint_category_row($id)));
}

function admin_complaint_statuses(): void
{
    require_any_permission(['statuses.view', 'statuses.manage', 'complaints.view', 'complaints.update']);
    $rows = db()->query('SELECT * FROM complaint_statuses ORDER BY sort_order ASC, id ASC')->fetchAll();
    json_ok(array_map('complaint_status_payload', $rows));
}

function admin_complaint_status_create(): void
{
    require_permission('statuses.manage');
    $fields = complaint_status_fields(request_json(), true);
    try {
        $stmt = db()->prepare(
            'INSERT INTO complaint_statuses (code, name, sort_order, is_active) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$fields['code'], $fields['name'], $fields['sort_order'], $fields['is_active']]);
    } catch (PDOException $e) {
        if (is_duplicate($e, 'uq_complaint_statuses_code')) {
            json_error('That status code already exists.', 409);
        }
        throw $e;
    }
    json_ok(complaint_status_payload(complaint_status_row($fields['code'])), 201);
}

function admin_complaint_status_update(int $id): void
{
    require_permission('statuses.manage');
    $existing = complaint_status_by_id($id);
    $fields = complaint_status_fields(request_json(), false, $existing);
    if ($existing['code'] === 'submitted' && !$fields['is_active']) {
        json_error('Submitted is the starting status and must stay available.', 422);
    }
    db()->prepare(
        'UPDATE complaint_statuses SET name = ?, sort_order = ?, is_active = ? WHERE id = ?'
    )->execute([$fields['name'], $fields['sort_order'], $fields['is_active'], $id]);
    json_ok(complaint_status_payload(complaint_status_by_id($id)));
}

function admin_flyers(): void
{
    require_any_permission(['flyers.view', 'flyers.edit', 'flyers.delete']);
    $rows = db()->query('SELECT * FROM flyers ORDER BY sort_order ASC, id DESC')->fetchAll();
    json_ok(array_map('flyer_payload', $rows));
}

function admin_flyer_show(int $id): void
{
    require_any_permission(['flyers.view', 'flyers.edit']);
    json_ok(flyer_payload(admin_flyer_row($id)));
}

function admin_flyer_create(): void
{
    $admin = require_permission('flyers.create');
    $fields = flyer_fields_from_input(input(), true);
    $image = store_upload('image', 'flyers');
    if ($image === null) {
        json_error('Upload the flyer image.', 422);
    }
    db()->prepare(
        'INSERT INTO flyers (title, image_path, link_url, starts_on, ends_on, is_active, sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $fields['title'],
        $image,
        $fields['link_url'],
        $fields['starts_on'],
        $fields['ends_on'],
        $fields['is_active'],
        $fields['sort_order'],
        (int) $admin['id'],
    ]);
    json_ok(flyer_payload(admin_flyer_row((int) db()->lastInsertId())), 201);
}

function admin_flyer_update(int $id): void
{
    require_permission('flyers.edit');
    $existing = admin_flyer_row($id);
    $fields = flyer_fields_from_input(input(), false, $existing);
    $image = store_upload('image', 'flyers');
    if ($image !== null) {
        delete_upload((string) $existing['image_path']);
    } else {
        $image = (string) $existing['image_path'];
    }
    db()->prepare(
        'UPDATE flyers
         SET title = ?, image_path = ?, link_url = ?, starts_on = ?, ends_on = ?, is_active = ?, sort_order = ?
         WHERE id = ?'
    )->execute([
        $fields['title'],
        $image,
        $fields['link_url'],
        $fields['starts_on'],
        $fields['ends_on'],
        $fields['is_active'],
        $fields['sort_order'],
        $id,
    ]);
    json_ok(flyer_payload(admin_flyer_row($id)));
}

function admin_flyer_delete(int $id): void
{
    require_permission('flyers.delete');
    $existing = admin_flyer_row($id);
    db()->prepare('DELETE FROM flyers WHERE id = ?')->execute([$id]);
    delete_upload((string) $existing['image_path']);
    json_ok(['deleted' => true]);
}

function admin_sms(): void
{
    require_permission('sms.view');
    $q = trim((string) ($_GET['q'] ?? ''));
    $sql = 'SELECT * FROM sms_messages WHERE 1 = 1';
    $params = [];
    if ($q !== '') {
        $sql .= ' AND (mobile LIKE ? OR message LIKE ? OR sender LIKE ?)';
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like);
    }
    $sql .= ' ORDER BY id DESC LIMIT 200';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    json_ok(array_map(static function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'mobile' => (string) $row['mobile'],
            'sender' => (string) $row['sender'],
            'message' => (string) $row['message'],
            'provider' => (string) $row['provider'],
            'status' => (string) $row['status'],
            'provider_code' => $row['provider_code'] !== null ? (string) $row['provider_code'] : '',
            'provider_message_id' => $row['provider_message_id'] !== null ? (string) $row['provider_message_id'] : '',
            'created_at' => $row['created_at'],
        ];
    }, $stmt->fetchAll()));
}

function admin_settings_get(): void
{
    require_any_permission(['settings.view', 'settings.edit']);
    json_ok([
        'association' => association_payload(),
        'sms' => sms_status_payload(),
    ]);
}

function admin_settings_save(): void
{
    require_permission('settings.edit');
    $in = input();
    $name = bounded_string($in['name'] ?? '', 'Site name', 3, 160);
    $tagline = optional_text($in['tagline'] ?? '', 'Tagline', 255);
    $copyright = optional_text($in['copyright'] ?? '', 'Copyright', 255);
    $supportMobile = optional_phone($in['support_mobile'] ?? '', 'phone number');
    $whatsapp = optional_phone($in['whatsapp'] ?? '', 'WhatsApp number');
    $supportEmail = optional_email($in['support_email'] ?? '');
    $address = optional_text($in['address'] ?? '', 'Address', 500);
    $officeHours = optional_text($in['office_hours'] ?? '', 'Office hours', 255);
    $officeBearers = office_bearers_from_input($in);
    $current = association_row();
    $logo = store_upload('logo', 'branding');
    $removeLogo = flag_value($in['remove_logo'] ?? '0', false) === 1;
    if ($logo !== null) {
        delete_upload($current['logo_path'] ?? null);
    } elseif ($removeLogo) {
        delete_upload($current['logo_path'] ?? null);
        $logo = null;
    } else {
        $logo = $current['logo_path'] ?? null;
    }
    db()->prepare(
        'UPDATE settings
         SET association_name = ?, tagline = ?, copyright = ?, logo_path = ?,
             support_mobile = ?, whatsapp = ?, support_email = ?, address = ?, office_hours = ?,
             office_bearers = ?
         WHERE id = 1'
    )->execute([$name, $tagline, $copyright, $logo, $supportMobile, $whatsapp, $supportEmail, $address, $officeHours, $officeBearers]);
    json_ok(association_payload());
}

function office_bearers_from_input(array $in): string
{
    $roles = [
        'president' => 'President',
        'secretary' => 'Hon. Gen. Secretary',
        'treasurer' => 'Treasurer',
        'zonal' => 'Zonal Leader',
    ];
    $out = [];
    foreach ($roles as $key => $label) {
        $optional = $key === 'zonal';
        $name = $optional
            ? (nullable_string($in[$key . '_name'] ?? '', 120) ?? '')
            : bounded_string($in[$key . '_name'] ?? '', $label . ' name', 2, 120);
        $title = $optional
            ? optional_text($in[$key . '_title'] ?? '', $label . ' designation', 80)
            : bounded_string($in[$key . '_title'] ?? '', $label . ' designation', 2, 80);
        if ($optional && $title === '') {
            $title = 'Zonal Leader';
        }
        $out[$key] = [
            'name' => $name,
            'title' => $title,
            'mobile' => optional_phone($in[$key . '_mobile'] ?? '', $label . ' mobile'),
        ];
    }
    return json_encode($out, JSON_UNESCAPED_UNICODE);
}

function licence_value(mixed $value): ?string
{
    $text = strtoupper(trim((string) $value));
    if ($text === '') {
        return null;
    }
    if (mb_strlen($text) < 3 || mb_strlen($text) > 40) {
        json_error('Enter a valid drug licence number (3 to 40 characters).', 422);
    }
    return $text;
}

function member_profile_from_input(array $in, bool $asAdmin, ?array $existing): array
{
    $locked = !$asAdmin && (($existing['status'] ?? '') === 'approved');
    $licences = [];
    foreach (licence_forms() as $form) {
        $numberKey = $form['number'];
        $expiresKey = $form['expires'];
        if (!array_key_exists($numberKey, $in) && $existing !== null) {
            $number = stored_licence($existing[$numberKey] ?? null);
        } else {
            $number = licence_value($in[$numberKey] ?? '');
        }
        if (!array_key_exists($expiresKey, $in) && $existing !== null) {
            $expires = stored_date($existing[$expiresKey] ?? null);
        } else {
            $expires = licence_expiry($in[$expiresKey] ?? '', $form['label'], $number !== null && !$locked);
        }
        if ($number === null && $expires !== null) {
            json_error('Enter the ' . $form['label'] . ' number for that expiry date.', 422);
        }
        $licences[$numberKey] = $number;
        $licences[$expiresKey] = $number === null ? null : $expires;
    }
    if ($licences['licence_f20'] === null && $licences['licence_f20c'] === null && $licences['licence_f21'] === null && $licences['licence_f21b'] === null) {
        $legacy = licence_value($in['drug_licence_no'] ?? '');
        if ($legacy !== null) {
            $licences['licence_f20'] = $legacy;
            if ($licences['licence_f20_expires'] === null && !$locked) {
                $licences['licence_f20_expires'] = licence_expiry($in['licence_f20_expires'] ?? '', 'Form 20 – Retail Allopathic', true);
            }
        }
    }
    $primary = $licences['licence_f20'] ?? $licences['licence_f20c'] ?? $licences['licence_f21'] ?? $licences['licence_f21b'];
    if ($primary === null) {
        json_error('Enter at least one drug licence number: Form 20, 20C, 21, or 21B.', 422);
    }

    $partner2 = nullable_string($in['partner2_name'] ?? '', 120);
    $partner3 = nullable_string($in['partner3_name'] ?? '', 120);
    $partner2Address = nullable_string($in['partner2_address'] ?? '', 500);
    $partner3Address = nullable_string($in['partner3_address'] ?? '', 500);
    if ($partner2 === null && $partner2Address !== null) {
        json_error('Enter the name of partner 2.', 422);
    }
    if ($partner2 !== null && $partner2Address === null) {
        json_error('Enter the residential address of partner 2.', 422);
    }
    if ($partner3 === null && $partner3Address !== null) {
        json_error('Enter the name of partner 3.', 422);
    }
    if ($partner3 !== null && $partner3Address === null) {
        json_error('Enter the residential address of partner 3.', 422);
    }

    $qpName = trim((string) ($in['qualified_person_name'] ?? ''));
    $qpReg = nullable_string($in['pharmacist_reg_no'] ?? '', 40);
    $qpAddress = trim((string) ($in['qualified_person_address'] ?? ''));
    $qpPhone = optional_phone($in['qualified_person_phone'] ?? '', 'qualified person phone');
    if ($qpName === '' || $qpReg === null || $qpAddress === '' || $qpPhone === '') {
        json_error('Enter the qualified person name, registration number, address, and phone.', 422);
    }

    $qp2Name = nullable_string($in['qualified_person2_name'] ?? '', 120);
    $qp2Reg = nullable_string($in['qualified_person2_reg'] ?? '', 40);
    $qp2Address = nullable_string($in['qualified_person2_address'] ?? '', 500);
    $qp2PhoneRaw = trim((string) ($in['qualified_person2_phone'] ?? ''));
    $qp2Phone = $qp2PhoneRaw === '' ? null : optional_phone($qp2PhoneRaw, 'second qualified person phone');
    $qp2Filled = count(array_filter([$qp2Name, $qp2Reg, $qp2Address, $qp2Phone], static fn (?string $value): bool => $value !== null && $value !== ''));
    if ($qp2Filled > 0 && $qp2Filled < 4) {
        json_error('For a second qualified person, enter the name, registration number, address, and phone.', 422);
    }

    return [
        'owner_name' => bounded_string($in['owner_name'] ?? '', 'Proprietor name', 2, 120),
        'shop_name' => bounded_string($in['shop_name'] ?? '', 'Name of the firm', 2, 160),
        'email' => optional_email($in['email'] ?? ''),
        'address' => bounded_string($in['address'] ?? '', 'Address of the firm', 5, 500),
        'partner2_name' => $partner2,
        'partner3_name' => $partner3,
        'residential_address' => bounded_string($in['residential_address'] ?? '', 'Residential address', 5, 500),
        'partner2_address' => $partner2Address,
        'partner3_address' => $partner3Address,
        'licence_f20' => $licences['licence_f20'],
        'licence_f20_expires' => $licences['licence_f20_expires'],
        'licence_f20c' => $licences['licence_f20c'],
        'licence_f20c_expires' => $licences['licence_f20c_expires'],
        'licence_f21' => $licences['licence_f21'],
        'licence_f21_expires' => $licences['licence_f21_expires'],
        'licence_f21b' => $licences['licence_f21b'],
        'licence_f21b_expires' => $licences['licence_f21b_expires'],
        'drug_licence_no' => $primary,
        'qualified_person_name' => bounded_string($qpName, 'Qualified person name', 2, 120),
        'pharmacist_reg_no' => $qpReg,
        'qualified_person_address' => bounded_string($qpAddress, 'Qualified person address', 5, 500),
        'qualified_person_phone' => $qpPhone,
        'qualified_person2_name' => $qp2Name,
        'qualified_person2_reg' => $qp2Reg,
        'qualified_person2_address' => $qp2Address,
        'qualified_person2_phone' => $qp2Phone,
    ];
}

function licence_expiry(mixed $value, string $label, bool $required): ?string
{
    $text = trim((string) $value);
    if ($text === '') {
        if ($required) {
            json_error('Enter the expiry date for ' . $label . '.', 422);
        }
        return null;
    }
    return optional_date($text, $label . ' expiry');
}

function licence_file_selected(string $field): bool
{
    return isset($_FILES[$field]) && (int) ($_FILES[$field]['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
}

function reject_licence_change(array $member, array $in): void
{
    if (($member['status'] ?? '') !== 'approved') {
        return;
    }
    foreach (licence_forms() as $form) {
        if (array_key_exists($form['number'], $in)) {
            $next = licence_value($in[$form['number']]);
            $current = stored_licence($member[$form['number']] ?? null);
            if ($next !== $current) {
                json_error('After approval, only the association can change the drug licences.', 422);
            }
        }
        if (array_key_exists($form['expires'], $in)) {
            $next = licence_expiry($in[$form['expires']], $form['label'], false);
            $current = stored_date($member[$form['expires']] ?? null);
            if ($next !== $current) {
                json_error('After approval, only the association can change the drug licences.', 422);
            }
        }
        if (licence_file_selected($form['file'])) {
            json_error('After approval, only the association can change the drug licences.', 422);
        }
    }
}

function prepare_licence_images(?array $existing, array $profile): array
{
    foreach (licence_forms() as $form) {
        if (licence_file_selected($form['file']) && $profile[$form['number']] === null) {
            json_error('Enter the ' . $form['label'] . ' number before uploading its copy.', 422);
        }
    }
    $columns = [];
    $created = [];
    foreach (licence_forms() as $form) {
        $newNo = $profile[$form['number']];
        $oldNo = stored_licence($existing[$form['number']] ?? null);
        $oldImage = trim((string) ($existing[$form['image']] ?? ''));
        $oldImage = $oldImage === '' ? null : $oldImage;
        $upload = licence_file_selected($form['file']) ? store_upload($form['file'], 'licences') : null;
        if ($upload !== null) {
            $created[] = $upload;
        }
        if ($newNo === null) {
            $columns[$form['image']] = null;
        } elseif ($upload !== null) {
            $columns[$form['image']] = $upload;
        } elseif ($oldNo !== $newNo) {
            $columns[$form['image']] = null;
        } else {
            $columns[$form['image']] = $oldImage;
        }
    }
    return ['columns' => $columns, 'created' => $created];
}

function archive_replaced_licences(int $memberId, array $existing, array $profile, array $images): void
{
    $insert = db()->prepare(
        'INSERT INTO member_licence_history (member_id, form_code, licence_no, expires_on, image_path, status, replaced_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())'
    );
    foreach (licence_forms() as $code => $form) {
        $oldNo = stored_licence($existing[$form['number']] ?? null);
        if ($oldNo === null) {
            continue;
        }
        $newNo = $profile[$form['number']];
        $oldExpires = stored_date($existing[$form['expires']] ?? null);
        $newExpires = $profile[$form['expires']];
        $oldImage = trim((string) ($existing[$form['image']] ?? ''));
        $oldImage = $oldImage === '' ? null : $oldImage;
        $newImage = $images['columns'][$form['image']] ?? null;
        $numberChanged = $oldNo !== $newNo;
        $expiryChanged = $oldExpires !== null && $oldExpires !== $newExpires;
        $imageReplaced = $oldImage !== null && $newImage !== $oldImage;
        if (!$numberChanged && !$expiryChanged && !$imageReplaced) {
            continue;
        }
        $insert->execute([
            $memberId,
            $code,
            $oldNo,
            $oldExpires,
            $oldImage,
            $newNo === null ? 'removed' : 'updated',
        ]);
    }
}

function member_has_new_photo(): bool
{
    return isset($_FILES['photo']) && (int) ($_FILES['photo']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK;
}

function save_member_photo(int $id, ?string $current, bool $required): void
{
    $photo = store_upload('photo', 'members');
    if ($photo === null) {
        if ($required) {
            json_error('Upload a passport-size photo of the shop owner.', 422);
        }
        return;
    }
    delete_upload($current);
    db()->prepare('UPDATE members SET photo_path = ? WHERE id = ?')->execute([$photo, $id]);
}

function insert_member(array $profile, string $mobile, string $status, ?string $photo, bool $stampLogin): int
{
    $columns = [
        'owner_name', 'shop_name', 'email', 'address',
        'partner2_name', 'partner3_name',
        'residential_address', 'partner2_address', 'partner3_address',
        'licence_f20', 'licence_f20_expires', 'licence_f20_image',
        'licence_f20c', 'licence_f20c_expires', 'licence_f20c_image',
        'licence_f21', 'licence_f21_expires', 'licence_f21_image',
        'licence_f21b', 'licence_f21b_expires', 'licence_f21b_image',
        'drug_licence_no',
        'qualified_person_name', 'pharmacist_reg_no', 'qualified_person_address', 'qualified_person_phone',
        'qualified_person2_name', 'qualified_person2_reg', 'qualified_person2_address', 'qualified_person2_phone',
        'mobile', 'status', 'photo_path', 'office_bearers',
    ];
    $params = [];
    $bearers = office_bearers_json();
    foreach ($columns as $column) {
        if ($column === 'mobile') {
            $params[] = $mobile;
        } elseif ($column === 'status') {
            $params[] = $status;
        } elseif ($column === 'photo_path') {
            $params[] = $photo;
        } elseif ($column === 'office_bearers') {
            $params[] = $bearers;
        } else {
            $params[] = $profile[$column];
        }
    }
    $placeholders = implode(', ', array_fill(0, count($columns), '?'));
    $sql = 'INSERT INTO members (' . implode(', ', $columns) . ($stampLogin ? ', last_login_at' : '') . ') VALUES (' . $placeholders . ($stampLogin ? ', NOW()' : '') . ')';
    db()->prepare($sql)->execute($params);
    return (int) db()->lastInsertId();
}

function member_write_error(PDOException $e): void
{
    if (is_duplicate($e, 'uq_members_mobile')) {
        json_error('This mobile number is already registered.', 409);
    }
    if (is_duplicate($e, 'uq_members_')) {
        json_error('This drug licence number is already registered.', 409);
    }
}

function save_member_fields(int $id, array $in, bool $asAdmin): void
{
    $stmt = db()->prepare('SELECT * FROM members WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_error('Member not found.', 404);
    }
    $application = [
        'owner_name', 'shop_name', 'email', 'address', 'residential_address',
        'licence_f20', 'licence_f20_expires', 'licence_f20c', 'licence_f20c_expires',
        'licence_f21', 'licence_f21_expires', 'licence_f21b', 'licence_f21b_expires',
        'drug_licence_no', 'qualified_person_name', 'pharmacist_reg_no',
    ];
    $hasApplication = false;
    foreach ($application as $key) {
        if (array_key_exists($key, $in)) {
            $hasApplication = true;
            break;
        }
    }
    foreach (licence_forms() as $form) {
        if (licence_file_selected($form['file'])) {
            $hasApplication = true;
            break;
        }
    }
    $sets = [];
    $params = [];
    $profile = null;
    $images = ['columns' => [], 'created' => []];
    if ($hasApplication) {
        $profile = member_profile_from_input($in, $asAdmin, $existing);
        $images = prepare_licence_images($existing, $profile);
        foreach (array_merge($profile, $images['columns']) as $key => $value) {
            $sets[] = $key . ' = ?';
            $params[] = $value;
        }
    }
    if ($asAdmin && array_key_exists('mobile', $in)) {
        $sets[] = 'mobile = ?';
        $params[] = require_mobile($in);
    }
    if ($asAdmin && array_key_exists('status', $in)) {
        $status = (string) $in['status'];
        if (!in_array($status, ['pending', 'approved', 'rejected', 'blocked', 'deactivated'], true)) {
            json_error('Choose a valid membership status.', 422);
        }
        $sets[] = 'status = ?';
        $params[] = $status;
    }
    if ($sets === []) {
        json_error('Nothing to update.', 422);
    }
    $params[] = $id;
    $db = db();
    try {
        $db->beginTransaction();
        if ($profile !== null) {
            archive_replaced_licences($id, $existing, $profile, $images);
        }
        $db->prepare('UPDATE members SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        foreach ($images['created'] as $path) {
            delete_upload($path);
        }
        if ($e instanceof PDOException) {
            member_write_error($e);
        }
        throw $e;
    }
}

function flyer_fields_from_input(array $in, bool $create, ?array $existing = null): array
{
    $starts = array_key_exists('starts_on', $in) || $create
        ? optional_date($in['starts_on'] ?? '', 'start date')
        : ($existing['starts_on'] ?? null);
    $ends = array_key_exists('ends_on', $in) || $create
        ? optional_date($in['ends_on'] ?? '', 'end date')
        : ($existing['ends_on'] ?? null);
    if ($starts !== null && $ends !== null && $ends < $starts) {
        json_error('End date must be on or after the start date.', 422);
    }
    if (array_key_exists('sort_order', $in) || $create) {
        $sort = (int) ($in['sort_order'] ?? 0);
        if ($sort < 0 || $sort > 9999) {
            json_error('Sort order must be between 0 and 9999.', 422);
        }
    } else {
        $sort = (int) ($existing['sort_order'] ?? 0);
    }
    $active = array_key_exists('is_active', $in) || $create
        ? flag_value($in['is_active'] ?? '1', true)
        : (int) ($existing['is_active'] ?? 1);
    return [
        'title' => bounded_string($in['title'] ?? ($existing['title'] ?? ''), 'Title', 2, 160),
        'link_url' => array_key_exists('link_url', $in) || $create
            ? optional_http_url($in['link_url'] ?? '')
            : ($existing['link_url'] ?? null),
        'starts_on' => $starts,
        'ends_on' => $ends,
        'is_active' => $active,
        'sort_order' => $sort,
    ];
}

function complaint_admin_select(): string
{
    return 'SELECT c.*, m.owner_name, m.shop_name, m.mobile, m.drug_licence_no,
            cat.name AS category_name, st.name AS status_name
            FROM complaints c
            JOIN members m ON m.id = c.member_id
            LEFT JOIN complaint_categories cat ON cat.id = c.category_id
            LEFT JOIN complaint_statuses st ON st.code = c.status';
}

function complaint_row_for_member(int $id, int $memberId): array
{
    $stmt = db()->prepare(
        'SELECT c.*, cat.name AS category_name, st.name AS status_name
         FROM complaints c
         LEFT JOIN complaint_categories cat ON cat.id = c.category_id
         LEFT JOIN complaint_statuses st ON st.code = c.status
         WHERE c.id = ? AND c.member_id = ?
         LIMIT 1'
    );
    $stmt->execute([$id, $memberId]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Complaint not found.', 404);
    }
    return $row;
}

function active_complaint_category(int $id): array
{
    $stmt = db()->prepare('SELECT * FROM complaint_categories WHERE id = ? AND is_active = 1 LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Choose a complaint category.', 422);
    }
    return $row;
}

function notify_member(int $memberId, int $complaintId, string $title, string $body): void
{
    db()->prepare(
        'INSERT INTO member_notifications (member_id, complaint_id, title, body) VALUES (?, ?, ?, ?)'
    )->execute([
        $memberId,
        $complaintId,
        mb_substr($title, 0, 160),
        mb_substr($body, 0, 500),
    ]);
}

function complaint_category_row(int $id): array
{
    $stmt = db()->prepare('SELECT * FROM complaint_categories WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Category not found.', 404);
    }
    return $row;
}

function complaint_category_fields(array $in): array
{
    $sort = (int) ($in['sort_order'] ?? 0);
    if ($sort < 0 || $sort > 9999) {
        json_error('Sort order must be between 0 and 9999.', 422);
    }
    return [
        'name' => bounded_string($in['name'] ?? '', 'Category name', 3, 160),
        'sort_order' => $sort,
        'is_active' => flag_value($in['is_active'] ?? '1', true),
    ];
}

function complaint_status_row(string $code): array|false
{
    $stmt = db()->prepare('SELECT * FROM complaint_statuses WHERE code = ? LIMIT 1');
    $stmt->execute([$code]);
    return $stmt->fetch();
}

function complaint_status_by_id(int $id): array
{
    $stmt = db()->prepare('SELECT * FROM complaint_statuses WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Status not found.', 404);
    }
    return $row;
}

function complaint_status_fields(array $in, bool $create, ?array $existing = null): array
{
    $sort = (int) ($in['sort_order'] ?? 0);
    if ($sort < 0 || $sort > 9999) {
        json_error('Sort order must be between 0 and 9999.', 422);
    }
    $code = $create
        ? strtolower(trim((string) ($in['code'] ?? '')))
        : (string) $existing['code'];
    if ($create && !preg_match('/^[a-z][a-z0-9_]{1,39}$/', $code)) {
        json_error('Status code must be 2 to 40 letters, numbers, or underscores.', 422);
    }
    return [
        'code' => $code,
        'name' => bounded_string($in['name'] ?? '', 'Status name', 3, 80),
        'sort_order' => $sort,
        'is_active' => flag_value($in['is_active'] ?? '1', true),
    ];
}

function admin_complaint_row(int $id): array
{
    $stmt = db()->prepare(complaint_admin_select() . ' WHERE c.id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Complaint not found.', 404);
    }
    return $row;
}

function admin_flyer_row(int $id): array
{
    $stmt = db()->prepare('SELECT * FROM flyers WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Flyer not found.', 404);
    }
    return $row;
}
