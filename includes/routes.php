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
            'INSERT INTO members (owner_name, shop_name, mobile, email, address, drug_licence_no, status, last_login_at)
             VALUES (?, "", ?, ?, "", NULL, "pending", NOW())'
        );
        $stmt->execute([$name, $mobile, $email]);
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
    json_ok(member_payload(require_member()));
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
    json_ok(member_payload($stmt->fetch()));
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
    json_ok([
        'token' => $token,
        'admin' => admin_payload($admin),
    ]);
}

function admin_me(): void
{
    json_ok(admin_payload(require_admin()));
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
    require_admin();
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
        'counts' => $counts,
        'pending_members' => array_map('member_payload', $pending),
        'open_complaints' => array_map(
            static fn (array $row): array => complaint_payload($row, true),
            $complaints
        ),
    ]);
}

function admin_members(): void
{
    require_admin();
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
            OR qualified_person_name LIKE ?)';
        $like = '%' . $q . '%';
        array_push($params, $like, $like, $like, $like, $like, $like, $like, $like, $like);
    }
    $sql .= ' ORDER BY created_at DESC LIMIT 200';
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    json_ok(array_map('member_payload', $stmt->fetchAll()));
}

function admin_member_create(): void
{
    require_admin();
    $in = input();
    $mobile = require_mobile($in);
    $profile = member_profile_from_input($in, true);
    $photo = store_upload('photo', 'members');
    try {
        $id = insert_member($profile, $mobile, 'approved', $photo, false);
    } catch (PDOException $e) {
        delete_upload($photo);
        member_write_error($e);
        throw $e;
    }
    $row = db()->prepare('SELECT * FROM members WHERE id = ?');
    $row->execute([$id]);
    json_ok(member_payload($row->fetch()), 201);
}

function admin_member_show(int $id): void
{
    require_admin();
    $stmt = db()->prepare('SELECT * FROM members WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        json_error('Member not found.', 404);
    }
    json_ok(member_payload($row));
}

function admin_member_application_pdf(int $id): void
{
    adopt_download_token();
    require_admin();
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
    require_admin();
    $stmt = db()->prepare('SELECT * FROM members WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch();
    if (!$existing) {
        json_error('Member not found.', 404);
    }
    $in = input();
    if ($existing['status'] === 'deactivated' && array_key_exists('status', $in) && (string) $in['status'] !== 'deactivated') {
        json_error('A deactivated account cannot sign in again.', 422);
    }
    save_member_fields($id, $in, true);
    save_member_photo($id, $existing['photo_path'] ?? null, false);
    $stmt->execute([$id]);
    json_ok(member_payload($stmt->fetch()));
}

function admin_member_deactivate(int $id): void
{
    require_admin();
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
    require_admin();
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
    require_admin();
    $row = admin_complaint_row($id);
    json_ok(complaint_payload($row, true));
}

function admin_complaint_update(int $id): void
{
    $admin = require_admin();
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
    require_admin();
    $rows = db()->query('SELECT * FROM complaint_categories ORDER BY sort_order ASC, id ASC')->fetchAll();
    json_ok(array_map('complaint_category_payload', $rows));
}

function admin_complaint_category_create(): void
{
    require_admin();
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
    require_admin();
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
    require_admin();
    $rows = db()->query('SELECT * FROM complaint_statuses ORDER BY sort_order ASC, id ASC')->fetchAll();
    json_ok(array_map('complaint_status_payload', $rows));
}

function admin_complaint_status_create(): void
{
    require_admin();
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
    require_admin();
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
    require_admin();
    $rows = db()->query('SELECT * FROM flyers ORDER BY sort_order ASC, id DESC')->fetchAll();
    json_ok(array_map('flyer_payload', $rows));
}

function admin_flyer_show(int $id): void
{
    require_admin();
    json_ok(flyer_payload(admin_flyer_row($id)));
}

function admin_flyer_create(): void
{
    $admin = require_admin();
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
    require_admin();
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
    require_admin();
    $existing = admin_flyer_row($id);
    db()->prepare('DELETE FROM flyers WHERE id = ?')->execute([$id]);
    delete_upload((string) $existing['image_path']);
    json_ok(['deleted' => true]);
}

function admin_sms(): void
{
    require_admin();
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
    require_admin();
    json_ok([
        'association' => association_payload(),
        'sms' => sms_status_payload(),
    ]);
}

function admin_settings_save(): void
{
    require_admin();
    $in = input();
    $name = bounded_string($in['name'] ?? '', 'Site name', 3, 160);
    $tagline = optional_text($in['tagline'] ?? '', 'Tagline', 255);
    $copyright = optional_text($in['copyright'] ?? '', 'Copyright', 255);
    $supportMobile = optional_phone($in['support_mobile'] ?? '', 'phone number');
    $whatsapp = optional_phone($in['whatsapp'] ?? '', 'WhatsApp number');
    $supportEmail = optional_email($in['support_email'] ?? '');
    $address = optional_text($in['address'] ?? '', 'Address', 500);
    $officeHours = optional_text($in['office_hours'] ?? '', 'Office hours', 255);
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
             support_mobile = ?, whatsapp = ?, support_email = ?, address = ?, office_hours = ?
         WHERE id = 1'
    )->execute([$name, $tagline, $copyright, $logo, $supportMobile, $whatsapp, $supportEmail, $address, $officeHours]);
    json_ok(association_payload());
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

function member_profile_from_input(array $in, bool $required): array
{
    unset($required);
    $licences = [
        'licence_f20' => licence_value($in['licence_f20'] ?? ''),
        'licence_f20c' => licence_value($in['licence_f20c'] ?? ''),
        'licence_f21' => licence_value($in['licence_f21'] ?? ''),
        'licence_f21b' => licence_value($in['licence_f21b'] ?? ''),
    ];
    if ($licences['licence_f20'] === null && $licences['licence_f20c'] === null && $licences['licence_f21'] === null && $licences['licence_f21b'] === null) {
        $legacy = licence_value($in['drug_licence_no'] ?? '');
        if ($legacy !== null) {
            $licences['licence_f20'] = $legacy;
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
        'licence_f20c' => $licences['licence_f20c'],
        'licence_f21' => $licences['licence_f21'],
        'licence_f21b' => $licences['licence_f21b'],
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

function reject_licence_change(array $member, array $in): void
{
    if (($member['status'] ?? '') !== 'approved') {
        return;
    }
    foreach (['licence_f20', 'licence_f20c', 'licence_f21', 'licence_f21b'] as $key) {
        if (!array_key_exists($key, $in)) {
            continue;
        }
        $next = licence_value($in[$key]);
        $current = isset($member[$key]) && $member[$key] !== null && $member[$key] !== ''
            ? strtoupper((string) $member[$key])
            : null;
        if ($next !== $current) {
            json_error('After approval, only the association can change the drug licence numbers.', 422);
        }
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
        'licence_f20', 'licence_f20c', 'licence_f21', 'licence_f21b', 'drug_licence_no',
        'qualified_person_name', 'pharmacist_reg_no', 'qualified_person_address', 'qualified_person_phone',
        'qualified_person2_name', 'qualified_person2_reg', 'qualified_person2_address', 'qualified_person2_phone',
        'mobile', 'status', 'photo_path',
    ];
    $params = [];
    foreach ($columns as $column) {
        if ($column === 'mobile') {
            $params[] = $mobile;
        } elseif ($column === 'status') {
            $params[] = $status;
        } elseif ($column === 'photo_path') {
            $params[] = $photo;
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
    $application = [
        'owner_name', 'shop_name', 'email', 'address', 'residential_address',
        'licence_f20', 'licence_f20c', 'licence_f21', 'licence_f21b', 'drug_licence_no',
        'qualified_person_name', 'pharmacist_reg_no',
    ];
    $hasApplication = false;
    foreach ($application as $key) {
        if (array_key_exists($key, $in)) {
            $hasApplication = true;
            break;
        }
    }
    $sets = [];
    $params = [];
    if ($hasApplication) {
        foreach (member_profile_from_input($in, true) as $key => $value) {
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
    try {
        db()->prepare('UPDATE members SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
    } catch (PDOException $e) {
        member_write_error($e);
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
