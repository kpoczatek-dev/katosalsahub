<?php
/**
 * Salsopedia Backend Script
 * Handles reading terms and submitting new/edited terms for moderation.
 * Updated for v6: Multi-categories, Source, Verification Status.
 */

// Start Output Buffering to prevent accidental whitespace/errors
ob_start();

// Headers for CORS and JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: GET, POST');

$salsopediaFile = '../data/salsopedia.json';
$pendingFile = '../data/pending_edits.json';

// Ensure data directory exists
if (!file_exists('../data')) {
    mkdir('../data', 0777, true);
}

// Helper to read JSON
function readJSON($file) {
    if (!file_exists($file)) return [];
    $content = file_get_contents($file);
    return json_decode($content, true) ?? [];
}

// Helper to save JSON
function saveJSON($file, $data) {
    return file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// === GET Request ===
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? 'list';

    // Suppress warnings in JSON output
    error_reporting(0);
    ini_set('display_errors', 0);

    if ($action === 'pending') {
        // Return pending edits
        ob_clean(); // Clear any previous output/warnings
        $pending = readJSON($pendingFile);
        echo json_encode($pending);
    } else {
        // Return verified/all terms
        ob_clean(); // Clear any previous output/warnings
        $terms = readJSON($salsopediaFile);
        echo json_encode($terms);
    }
    exit;
}

// === POST Request: Submit Edit/New Term/Verification ===
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['term']) || empty($input['author'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Hasło i Podpis są wymagane.']);
        exit;
    }

    // Honeypot
    if (!empty($input['surname'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Spam detected.']);
        exit;
    }

    // Process Categories (Array)
    $categories = isset($input['category']) ? $input['category'] : [];
    if (!is_array($categories)) {
        $categories = [$categories]; 
    }
    // Filter empty
    $categories = array_filter($categories);
    if(empty($categories)) $categories = ['dance']; // Default

    // Create Pending Entry
    // Note: status 'verified' is NOT set here. All user submissions are unverified/pending moderation.
    $entry = [
        'token' => bin2hex(random_bytes(16)),
        'timestamp' => date('Y-m-d H:i:s'),
        'term' => strip_tags(trim($input['term'])),
        'definition' => strip_tags(trim($input['definition'] ?? '')),
        'author' => strip_tags(trim($input['author'])),
        'author_link' => strip_tags(trim($input['author_link'] ?? '')), // Facebook/Insta link
        'category' => $categories, 
        'subcategory' => isset($input['subcategory']) ? $input['subcategory'] : [], // Subcategories array
        'user_category' => strip_tags(trim($input['user_category'] ?? '')), // Custom Category
        'source' => isset($input['source']) ? $input['source'] : [], // Now storing as array of objects {name, url}
        'original_id' => isset($input['id']) ? $input['id'] : null,
        'verification_request' => isset($input['verification_request']) ? true : false
    ];

    // Save to Pending
    $pending = readJSON($pendingFile);
    $pending[] = $entry;
    saveJSON($pendingFile, $pending);

    // Send Email
    $to = 'poczatek.krzysztof@gmail.com';
    $subject = 'Salsopedia: ' . ($entry['verification_request'] ? 'Weryfikacja' : 'Edycja') . ' - ' . $entry['term'];
    
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
    $host = $_SERVER['HTTP_HOST'];
    $path = dirname($_SERVER['PHP_SELF']); // e.g. /katosalsahub.pl/assets/php
    $baseUrl = "$protocol://$host$path/approve.php";
    
    $approveLink = "$baseUrl?token=" . $entry['token'] . "&action=approve";
    $rejectLink = "$baseUrl?token=" . $entry['token'] . "&action=reject";

    $categoriesStr = implode(', ', $categories);
    $subcategoriesStr = implode(', ', $entry['subcategory']);

    $message = "
    <html>
    <head><title>Salsopedia Moderation</title></head>
    <body>
      <h2>" . ($entry['verification_request'] ? "Zgłoszenie Weryfikacji ✅" : "Propozycja Zmiany ✏️") . "</h2>
      <p><strong>Autor:</strong> {$entry['author']} " . ($entry['author_link'] ? "(<a href='{$entry['author_link']}'>Profil</a>)" : "") . "</p>
      <p><strong>Hasło:</strong> {$entry['term']}</p>
      <p><strong>Kategorie:</strong> {$categoriesStr}</p>
      <p><strong>Podkategorie:</strong> {$subcategoriesStr}</p>
      " . ($entry['user_category'] ? "<p><strong>Proponowana Kategoria:</strong> {$entry['user_category']}</p>" : "") . "
      <p><strong>Źródła:</strong> " . (is_array($entry['source']) ? implode(', ', array_map(function($s){ return ($s['name']??'') . ' ' . ($s['url']??''); }, $entry['source'])) : $entry['source']) . "</p>
      <p><strong>Definicja:</strong><br>{$entry['definition']}</p>
      <hr>
      <p>
        <a href='$approveLink' style='background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none;'>ZATWIERDŹ</a>
        &nbsp;
        <a href='$rejectLink' style='background-color: #ff4757; color: white; padding: 10px 20px; text-decoration: none;'>ODRZUĆ</a>
      </p>
    </body>
    </html>
    ";

    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= 'From: Salsopedia Bot <no-reply@katosalsahub.pl>' . "\r\n";

    @mail($to, $subject, $message, $headers);

    // Clean output buffer to remove any warnings/notices
    ob_clean();
    echo json_encode(['success' => true, 'message' => 'Wysłano do moderacji!']);
}

// Flush buffer
ob_end_flush();
?>
