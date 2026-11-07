<?php
declare(strict_types=1);

require dirname(__DIR__) . '/includes/bootstrap.php';

$db = app_config()['db'];
$server = new PDO(
    sprintf('mysql:host=%s;port=%s;charset=%s', $db['host'], $db['port'], $db['charset']),
    $db['user'],
    $db['pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);
$server->exec("SET time_zone = '+05:30'");

$name = str_replace('`', '', $db['name']);
if (in_array('--fresh', $argv ?? [], true)) {
    $server->exec('DROP DATABASE IF EXISTS `' . $name . '`');
    echo "Dropped database {$name}\n";
}
$server->exec(
    'CREATE DATABASE IF NOT EXISTS `' . $name . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
);
$server->exec('USE `' . $name . '`');

$sql = file_get_contents(__DIR__ . '/schema.sql');
if ($sql === false) {
    fwrite(STDERR, "schema.sql is missing\n");
    exit(1);
}
$sql = preg_replace('/^--.*$/m', '', $sql) ?? $sql;
foreach (preg_split('/;\s*(?:\R|$)/', $sql) ?: [] as $statement) {
    $statement = trim($statement);
    if ($statement !== '') {
        $server->exec($statement);
    }
}

$admins = (int) $server->query('SELECT COUNT(*) FROM admins')->fetchColumn();
if ($admins === 0) {
    $insert = $server->prepare(
        'INSERT INTO admins (name, username, password_hash) VALUES (?, ?, ?)'
    );
    $insert->execute(['Administrator', 'admin', password_hash('admin123', PASSWORD_DEFAULT)]);
    echo "Created admin login: admin / admin123\n";
} else {
    echo "Admin account already exists\n";
}

$settings = (int) $server->query('SELECT COUNT(*) FROM settings WHERE id = 1')->fetchColumn();
if ($settings === 0) {
    $server->exec(
        "INSERT INTO settings (id, association_name, tagline)
         VALUES (1, 'Dombivali Medical Association', 'For medical stores in Dombivali')"
    );
    echo "Created association settings\n";
}

seed_complaint_masters($server);
migrate_membership_form($server);

$mode = sms_mode();
echo "Database ready: {$name}\n";
echo "SMS mode: {$mode}\n";
echo "Admin: http://127.0.0.1:8080/admin\n";
echo "Member site: http://127.0.0.1:8080/\n";

function seed_complaint_masters(PDO $db): void
{
    $categories = [
        [1, 'Government / FDA-related issues'],
        [2, 'Drug supply and distributor issues'],
        [3, 'Company-related complaints'],
        [4, 'Local medical store issues'],
        [5, 'Association-related issues'],
        [6, 'Other complaints'],
    ];
    $insertCategory = $db->prepare(
        'INSERT IGNORE INTO complaint_categories (name, sort_order, is_active) VALUES (?, ?, 1)'
    );
    foreach ($categories as [$sort, $label]) {
        $insertCategory->execute([$label, $sort]);
    }

    $statuses = [
        ['submitted', 'Submitted', 1],
        ['in_progress', 'In Progress', 2],
        ['under_review', 'Under Review', 3],
        ['resolved', 'Resolved', 4],
    ];
    $insertStatus = $db->prepare(
        'INSERT IGNORE INTO complaint_statuses (code, name, sort_order, is_active) VALUES (?, ?, ?, 1)'
    );
    foreach ($statuses as [$code, $label, $sort]) {
        $insertStatus->execute([$code, $label, $sort]);
    }

    $statusColumn = $db->query("SHOW COLUMNS FROM complaints LIKE 'status'")->fetch();
    $statusType = strtolower((string) ($statusColumn['Type'] ?? ''));
    if (str_starts_with($statusType, 'enum')) {
        $db->exec("ALTER TABLE complaints MODIFY status VARCHAR(40) NOT NULL DEFAULT 'open'");
        $db->exec("UPDATE complaints SET status = 'submitted' WHERE status = 'open'");
        $db->exec("UPDATE complaints SET status = 'resolved' WHERE status = 'closed'");
        $db->exec("ALTER TABLE complaints MODIFY status VARCHAR(40) NOT NULL DEFAULT 'submitted'");
        echo "Updated complaint statuses\n";
    }

    $categoryColumn = $db->query("SHOW COLUMNS FROM complaints LIKE 'category_id'")->fetch();
    if (!$categoryColumn) {
        $db->exec('ALTER TABLE complaints ADD category_id INT UNSIGNED NULL AFTER member_id');
        $db->exec('ALTER TABLE complaints ADD KEY idx_complaints_category (category_id)');
        echo "Added complaint category column\n";
    }

    $constraints = $db->query(
        "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaints' AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
    )->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('fk_complaints_category', $constraints, true)) {
        $db->exec(
            'ALTER TABLE complaints
             ADD CONSTRAINT fk_complaints_category
             FOREIGN KEY (category_id) REFERENCES complaint_categories (id)'
        );
    }
    if (!in_array('fk_complaints_status', $constraints, true)) {
        $db->exec(
            'ALTER TABLE complaints
             ADD CONSTRAINT fk_complaints_status
             FOREIGN KEY (status) REFERENCES complaint_statuses (code)
             ON UPDATE CASCADE'
        );
    }

    $categoryId = static function (PDO $db, string $name): int {
        $stmt = $db->prepare('SELECT id FROM complaint_categories WHERE name = ? LIMIT 1');
        $stmt->execute([$name]);
        return (int) $stmt->fetchColumn();
    };
    $memberId = (int) $db->query("SELECT id FROM members WHERE status = 'approved' ORDER BY id ASC LIMIT 1")->fetchColumn();
    if ($memberId === 0) {
        echo "Complaint master data ready\n";
        return;
    }

    $supplyId = $categoryId($db, 'Drug supply and distributor issues');
    if ($supplyId > 0) {
        $tag = $db->prepare('UPDATE complaints SET category_id = ? WHERE title = ? AND category_id IS NULL');
        $tag->execute([$supplyId, 'Insulin supply']);
    }

    $samples = [
        ['FDA renewal is still pending', 'Government / FDA-related issues', 'submitted', 'The Form 20 renewal was submitted two months ago. The shop has not received the renewed licence copy.'],
        ['Distributor sent a short supply', 'Drug supply and distributor issues', 'in_progress', 'The last antibiotic order arrived with 40 strips missing. The distributor has not issued a credit note.'],
        ['Company scheme was not paid', 'Company-related complaints', 'under_review', 'A quarterly scheme for a cardiac brand was billed, but the company has not released the credit.'],
        ['Unlicensed counter near the station', 'Local medical store issues', 'submitted', 'A counter near the railway station is selling strips without a visible drug licence.'],
        ['AGM notice reached the shop late', 'Association-related issues', 'in_progress', 'The annual meeting notice arrived after the meeting date. The shop could not send a representative.'],
        ['No parking for medicine delivery', 'Other complaints', 'resolved', 'Delivery vans have no place to stop on the main road during morning hours. The ward office has marked a short bay.'],
    ];
    $exists = $db->prepare('SELECT id FROM complaints WHERE title = ? LIMIT 1');
    $insert = $db->prepare(
        'INSERT INTO complaints (member_id, category_id, title, details, status) VALUES (?, ?, ?, ?, ?)'
    );
    $added = 0;
    foreach ($samples as [$title, $category, $status, $details]) {
        $exists->execute([$title]);
        if ($exists->fetch()) {
            continue;
        }
        $insert->execute([$memberId, $categoryId($db, $category), $title, $details, $status]);
        $added++;
    }
    echo "Complaint master data ready. Sample complaints added: {$added}\n";
    seed_member_notifications($db);
}

function migrate_membership_form(PDO $db): void
{
    $columns = [
        'partner2_name' => 'VARCHAR(120) NULL',
        'partner3_name' => 'VARCHAR(120) NULL',
        'residential_address' => "VARCHAR(500) NOT NULL DEFAULT ''",
        'partner2_address' => 'VARCHAR(500) NULL',
        'partner3_address' => 'VARCHAR(500) NULL',
        'licence_f20' => 'VARCHAR(40) NULL',
        'licence_f20c' => 'VARCHAR(40) NULL',
        'licence_f21' => 'VARCHAR(40) NULL',
        'licence_f21b' => 'VARCHAR(40) NULL',
        'qualified_person_name' => "VARCHAR(120) NOT NULL DEFAULT ''",
        'qualified_person_address' => "VARCHAR(500) NOT NULL DEFAULT ''",
        'qualified_person_phone' => "VARCHAR(20) NOT NULL DEFAULT ''",
        'qualified_person2_name' => 'VARCHAR(120) NULL',
        'qualified_person2_reg' => 'VARCHAR(40) NULL',
        'qualified_person2_address' => 'VARCHAR(500) NULL',
        'qualified_person2_phone' => 'VARCHAR(20) NULL',
        'photo_path' => 'VARCHAR(255) NULL',
    ];
    $existing = [];
    foreach ($db->query('SHOW COLUMNS FROM members') as $row) {
        $existing[(string) $row['Field']] = true;
    }
    foreach ($columns as $name => $definition) {
        if (!isset($existing[$name])) {
            $db->exec('ALTER TABLE members ADD COLUMN ' . $name . ' ' . $definition);
            echo "Added members.{$name}\n";
        }
    }
    $indexes = [];
    foreach ($db->query('SHOW INDEX FROM members') as $row) {
        $indexes[(string) $row['Key_name']] = true;
    }
    foreach ([
        'licence_f20' => 'uq_members_f20',
        'licence_f20c' => 'uq_members_f20c',
        'licence_f21' => 'uq_members_f21',
        'licence_f21b' => 'uq_members_f21b',
    ] as $column => $key) {
        if (!isset($indexes[$key])) {
            $db->exec('ALTER TABLE members ADD UNIQUE KEY ' . $key . ' (' . $column . ')');
        }
    }
    $db->exec(
        "UPDATE members
         SET licence_f20 = drug_licence_no
         WHERE (licence_f20 IS NULL OR licence_f20 = '') AND drug_licence_no <> ''"
    );
    $db->exec("ALTER TABLE members MODIFY shop_name VARCHAR(160) NOT NULL DEFAULT ''");
    $db->exec("ALTER TABLE members MODIFY address VARCHAR(500) NOT NULL DEFAULT ''");
    $db->exec("ALTER TABLE members MODIFY drug_licence_no VARCHAR(40) NULL");
    $updated = $db->exec(
        "UPDATE settings SET
            association_name = 'Dombivli Medical (Chemist) Welfare Association',
            tagline = 'Affiliated to CATD, MSCDA, AIOCD',
            address = 'Vishwambhar Darshan, A Wing, Block No. 1 & 2, Subhash Road, Vishnu Nagar, Dombivali (West), Dist. Thane',
            copyright = '© 2026 Dombivli Medical (Chemist) Welfare Association',
            logo_path = 'uploads/branding/dmcwa-logo.png'
         WHERE id = 1 AND (
            association_name = 'Dombivali Medical Association'
            OR logo_path = 'uploads/branding/association-logo.png'
            OR logo_path IS NULL
         )"
    );
    if ($updated) {
        echo "Association name, address, and DMCWA logo updated\n";
    }
}

function seed_member_notifications(PDO $db): void
{
    $count = (int) $db->query('SELECT COUNT(*) FROM member_notifications')->fetchColumn();
    if ($count > 0) {
        return;
    }
    $rows = $db->query(
        "SELECT c.id, c.member_id, c.title, s.name AS status_name
         FROM complaints c
         JOIN complaint_statuses s ON s.code = c.status
         WHERE c.status <> 'submitted'
         ORDER BY c.id ASC"
    )->fetchAll();
    $insert = $db->prepare(
        'INSERT INTO member_notifications (member_id, complaint_id, title, body) VALUES (?, ?, ?, ?)'
    );
    foreach ($rows as $row) {
        $insert->execute([
            (int) $row['member_id'],
            (int) $row['id'],
            (string) $row['title'],
            'Status is now ' . $row['status_name'] . '.',
        ]);
    }
    echo "Sample complaint updates: " . count($rows) . "\n";
}
