<?php
declare(strict_types=1);

use Dompdf\Dompdf;
use Dompdf\Options;

function send_application_pdf(array $member): void
{
    $autoload = base_path('vendor/autoload.php');
    if (!is_file($autoload)) {
        json_error('The application PDF is not available.', 500);
    }
    require_once $autoload;

    $binary = render_application_pdf($member);
    $shop = trim((string) ($member['shop_name'] ?? ''));
    $slug = preg_replace('/[^A-Za-z0-9]+/', '-', $shop) ?: 'member';
    $filename = trim((string) $slug, '-') . '-membership-application.pdf';
    $download = (string) ($_GET['download'] ?? '') === '1';

    header('Content-Type: application/pdf');
    header('Content-Disposition: ' . ($download ? 'attachment' : 'inline') . '; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($binary));
    header('Cache-Control: private, no-store');
    echo $binary;
    exit;
}

function render_application_pdf(array $member): string
{
    $autoload = base_path('vendor/autoload.php');
    if (!is_file($autoload)) {
        json_error('The application PDF is not available.', 500);
    }
    require_once $autoload;
    $settings = association_row();
    $html = application_pdf_html($member, $settings);
    $options = new Options();
    $options->set('isRemoteEnabled', false);
    $options->set('isHtml5ParserEnabled', true);
    $options->set('chroot', base_path());
    $options->set('defaultFont', 'DejaVu Sans');
    $dompdf = new Dompdf($options);
    $dompdf->loadHtml($html);
    $dompdf->setPaper('A4', 'portrait');
    $dompdf->render();
    return $dompdf->output();
}

function application_pdf_html(array $member, array $settings): string
{
    $e = static fn (mixed $value): string => htmlspecialchars(trim((string) $value), ENT_QUOTES, 'UTF-8');
    $line = static function (mixed $value) use ($e): string {
        $text = trim((string) $value);
        if ($text === '') {
            return '<span class="blank">&nbsp;</span>';
        }
        return '<span class="filled">' . $e($text) . '</span>';
    };
    $created = strtotime((string) ($member['created_at'] ?? '')) ?: time();
    $date = date('d / m / Y', $created);
    $logo = pdf_image_uri($settings['logo_path'] ?? null);
    $photo = pdf_image_uri($member['photo_path'] ?? null);
    $logoHtml = $logo ? '<img class="logo" src="' . $logo . '" alt="">' : '';
    $photoHtml = $photo
        ? '<img class="photo" src="' . $photo . '" alt="Shop owner">'
        : '<div class="photo empty">Photo</div>';
    $address = trim((string) ($settings['address'] ?? ''));
    if ($address === '') {
        $address = 'Vishwambhar Darshan, A Wing, Block No. 1 & 2, Subhash Road, Vishnu Nagar, Dombivali (West), Dist. Thane';
    }

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page { margin: 9mm 11mm 10mm; }
      @font-face { font-family: "NotoDev"; src: url("assets/fonts/NotoSansDevanagari-Regular.ttf") format("truetype"); }
      body { font-family: DejaVu Sans, sans-serif; font-size: 9.5px; color: #111; }
      .mr { font-family: NotoDev, DejaVu Sans, sans-serif; color: #c0392b; font-size: 15px; line-height: 1.25; }
      .center { text-align: center; }
      .muted { color: #333; font-size: 8.5px; line-height: 1.35; }
      .code { font-size: 9px; font-weight: bold; margin-top: 2px; }
      .title { color: #c0392b; font-size: 13px; font-weight: bold; letter-spacing: 0.4px; margin: 8px 0 6px; }
      table { width: 100%; border-collapse: collapse; }
      td { vertical-align: top; }
      .logo { width: 58px; height: auto; }
      .photo { width: 78px; height: 96px; object-fit: cover; border: 1px solid #222; }
      .photo.empty { font-size: 8px; color: #666; text-align: center; line-height: 96px; }
      .meta td { font-size: 10px; padding-bottom: 4px; }
      .box { display: inline-block; min-width: 54px; border: 1px solid #222; padding: 2px 6px; font-weight: bold; }
      .row { margin: 0 0 5px; }
      .label { font-weight: bold; }
      .filled { border-bottom: 1px solid #222; padding: 0 2px 1px; }
      .blank { display: inline-block; border-bottom: 1px solid #222; min-width: 220px; height: 12px; }
      .pair td { width: 50%; padding: 1px 8px 1px 0; }
      .decl { font-size: 8px; line-height: 1.35; margin: 8px 0 6px; }
      .signs td { width: 25%; font-size: 7.5px; line-height: 1.3; padding-right: 6px; }
      .sign-space { height: 28px; }
      .yours { text-align: right; font-size: 9px; }
      .foot { margin-top: 8px; background: #fff3a0; border: 1px solid #e6d36a; padding: 4px 6px; font-size: 8px; }
    </style></head><body>
    <table><tr>
      <td style="width:68px">' . $logoHtml . '</td>
      <td class="center">
        <div class="mr">डोंबिवली मेडिकल (केमिस्ट) वेल्फेअर असोसिएशन</div>
        <div class="muted">' . $e($address) . '</div>
        <div class="code">MH/99/09 THANE / AF / 19200, THANE</div>
        <div class="muted">(AFFILIATED TO CATD, MSCDA, AIOCD)</div>
      </td>
      <td style="width:84px"></td>
    </tr></table>
    <div class="title center">APPLICATION FORM FOR MEMBERSHIP</div>
    <table class="meta"><tr>
      <td>Sr. No. <span class="box">' . $e((string) ($member['id'] ?? '')) . '</span></td>
      <td style="text-align:right">Date: ' . $e($date) . '</td>
      <td style="width:90px" rowspan="4">' . $photoHtml . '</td>
    </tr>
    <tr><td colspan="2">To,<br>The President / Secretary,<br>' . $e($settings['association_name'] ?? 'Dombivli Medical (Chemist) Welfare Association') . '.</td></tr>
    <tr><td colspan="2" style="padding-top:4px">Dear Sir, I / We the undersigned, want to become a member of your Association.</td></tr>
    </table>
    <div class="row"><span class="label">1. Name of the Firm:</span> ' . $line($member['shop_name'] ?? '') . '</div>
    <div class="row"><span class="label">2. Address of the Firm:</span> ' . $line($member['address'] ?? '') . '</div>
    <div class="row"><span class="label">3. Full Name of Proprietor / Partners:</span></div>
    <div class="row">1) ' . $line($member['owner_name'] ?? '') . '</div>
    <div class="row">2) ' . $line($member['partner2_name'] ?? '') . '</div>
    <div class="row">3) ' . $line($member['partner3_name'] ?? '') . '</div>
    <div class="row"><span class="label">4. Residential Address of proprietor / Partners:</span></div>
    <div class="row">1) ' . $line($member['residential_address'] ?? '') . '</div>
    <div class="row">2) ' . $line($member['partner2_address'] ?? '') . '</div>
    <div class="row">3) ' . $line($member['partner3_address'] ?? '') . '</div>
    <div class="row"><span class="label">5. Mobile Number Firm:</span> ' . $line($member['mobile'] ?? '') . ' &nbsp;&nbsp; <span class="label">Mail id:</span> ' . $line($member['email'] ?? '') . '</div>
    <div class="row"><span class="label">6. Drug Licence No.</span></div>
    <table class="pair"><tr>
      <td>F20 ' . $line($member['licence_f20'] ?? '') . '</td>
      <td>F20C ' . $line($member['licence_f20c'] ?? '') . '</td>
    </tr><tr>
      <td>F21 ' . $line($member['licence_f21'] ?? '') . '</td>
      <td>F21B ' . $line($member['licence_f21b'] ?? '') . '</td>
    </tr></table>
    <div class="row"><span class="label">7. Name of The Qualified Person:</span></div>
    <div class="row">1) ' . $line($member['qualified_person_name'] ?? '') . ' &nbsp; Reg. No. ' . $line($member['pharmacist_reg_no'] ?? '') . '</div>
    <div class="row">2) ' . $line($member['qualified_person2_name'] ?? '') . ' &nbsp; Reg. No. ' . $line($member['qualified_person2_reg'] ?? '') . '</div>
    <div class="row"><span class="label">8. Address of The Qualified Person:</span></div>
    <div class="row">1) ' . $line($member['qualified_person_address'] ?? '') . ' &nbsp; Ph. No. ' . $line($member['qualified_person_phone'] ?? '') . '</div>
    <div class="row">2) ' . $line($member['qualified_person2_address'] ?? '') . ' &nbsp; Ph. No. ' . $line($member['qualified_person2_phone'] ?? '') . '</div>
    <div class="decl">
      A) I / We will follow all the Rules and Registration of D.M.C.A., C.A.T.D. and your parent Association.<br>
      B) I / We will not commit any mistakes of your Association Rules &amp; Regulations.<br>
      C) I / We are ready to pay all your Memberships Fees / Yearly Fees accordingly.<br>
      D) I / We request you to sanction my / our application.
    </div>
    <table class="signs"><tr>
      <td><div class="sign-space"></div><strong>Mr. DILIP DESHMUKH</strong><br>President - DMCWA<br>Mob. 9702400111</td>
      <td><div class="sign-space"></div><strong>Mr. MILIND DAHIVADKAR</strong><br>Hon. Gen. Secretary - DMCWA<br>Mob. 9594381944</td>
      <td><div class="sign-space"></div><strong>Mr. REWASHANKAR GOMTIWAL</strong><br>Treasurer - DMCWA<br>Mob. 9820695709</td>
      <td class="yours"><div class="sign-space"></div>Yours faithfully,<br>' . $e($member['owner_name'] ?? '') . '<br>(Proprietor/Partner)<br><br>ZONAL LEADER</td>
    </tr></table>
    <div class="foot"><strong>Enclosed:</strong> Xerox Copies of Drug Licence &amp; Qualified Person Certificate, Shop Agreement, Photo Copy, Residential Address Proof, Passport size Photo of Shop Owner.</div>
    </body></html>';
}

function pdf_image_uri(mixed $relative): ?string
{
    $path = trim((string) $relative);
    if ($path === '') {
        return null;
    }
    $full = base_path($path);
    if (!is_file($full)) {
        return null;
    }
    $bytes = (string) file_get_contents($full);
    if ($bytes === '') {
        return null;
    }
    $mime = mime_content_type($full) ?: '';
    if (!in_array($mime, ['image/jpeg', 'image/png'], true)) {
        if (!function_exists('imagecreatefromstring')) {
            return null;
        }
        $image = @imagecreatefromstring($bytes);
        if ($image === false) {
            return null;
        }
        ob_start();
        imagejpeg($image, null, 85);
        $bytes = (string) ob_get_clean();
        imagedestroy($image);
        $mime = 'image/jpeg';
    }
    return 'data:' . $mime . ';base64,' . base64_encode($bytes);
}
