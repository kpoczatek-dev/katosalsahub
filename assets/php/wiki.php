<?php
/**
 * Salsopedia Backend Script
 * Handles reading terms and submitting new/edited terms for moderation.
 * Updated for v6: Multi-categories, Source, Verification Status.
 * Refactored for v7: PROPER POST SUPPORT (Fuego Pattern)
 */

// Start Output Buffering
ob_start();

// Headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); 
header('Access-Control-Allow-Methods: GET, POST');

$salsopediaFile = '../data/salsopedia.json';
$pendingFile = '../data/pending_edits.json';

// Ensure data directory exists
if (!file_exists('../data')) {
    mkdir('../data', 0777, true);
}

// Helpers
function readJSON($file) {
    if (!file_exists($file)) return [];
    $content = file_get_contents($file);
    return json_decode($content, true) ?? [];
}

function saveJSON($file, $data) {
    return file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// === GET Request ===
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $action = $_GET['action'] ?? 'list';
    error_reporting(0);
    ini_set('display_errors', 0);

    if ($action === 'pending') {
        ob_clean();
        $pending = readJSON($pendingFile);
        echo json_encode($pending);
    } else {
        ob_clean(); 
        $terms = readJSON($salsopediaFile);
        $json = json_encode($terms);
        if ($json === false) {
             http_response_code(500);
             echo json_encode(["error" => "JSON Encode Failed: " . json_last_error_msg()]);
        } else {
             echo $json;
        }
    }
    exit;
}

// === POST Request: Submit Edit/New Term/Verification ===
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Determine Input Type (Defensive)
    $input = [];
    $rawInput = file_get_contents('php://input');
    $jsonInput = json_decode($rawInput, true);

    if (is_array($jsonInput)) {
        $input = $jsonInput;
    } else {
        $input = $_POST;
    }

    // Validation
    $term = isset($input['term']) ? strip_tags(trim($input['term'])) : '';
    $author = isset($input['author']) ? strip_tags(trim($input['author'])) : '';
    
    if (empty($term) || empty($author)) {
        http_response_code(400);
        echo json_encode(['error' => 'Hasło i Podpis są wymagane.']);
        exit;
    }

    // Honeypot
    if (!empty($input['surname'])) {
        // Pretend success for bot
        echo json_encode(['success' => true]);
        exit;
    }

    // Process Categories
    $categories = isset($input['category']) ? $input['category'] : [];
    if (!is_array($categories)) {
        // If coming from POST array or single string
        $categories = is_string($categories) ? explode(',', $categories) : [$categories];
    }
    $categories = array_filter($categories);
    if(empty($categories)) $categories = ['dance'];

    // Process Subcategories
    $subcategories = isset($input['subcategory']) ? $input['subcategory'] : [];
    if (!is_array($subcategories)) {
         $subcategories = is_string($subcategories) ? explode(',', $subcategories) : [$subcategories];
    }

    // Process Sources (Reconstruct from Arrays if POST)
    $sources = [];
    if (isset($input['source']) && is_array($input['source']) && isset($input['source'][0]['name'])) {
        // Already structured (JSON)
        $sources = $input['source']; 
    } elseif (isset($input['source_name']) && is_array($input['source_name'])) {
        // POST Arrays
        $names = $input['source_name'];
        $urls = isset($input['source_url']) ? $input['source_url'] : [];
        for ($i = 0; $i < count($names); $i++) {
            if (!empty($names[$i]) || !empty($urls[$i])) {
                $sources[] = [
                    'name' => strip_tags(trim($names[$i])),
                    'url' => strip_tags(trim($urls[$i] ?? ''))
                ];
            }
        }
    }

    // Create Entry
    $entry = [
        'token' => bin2hex(random_bytes(16)),
        'timestamp' => date('Y-m-d H:i:s'),
        'term' => $term,
        'definition' => strip_tags(trim($input['definition'] ?? '')),
        'author' => $author,
        'author_link' => strip_tags(trim($input['author_link'] ?? '')),
        'category' => $categories, 
        'subcategory' => $subcategories, 
        'user_category' => strip_tags(trim($input['user_category'] ?? '')),
        'source' => $sources,
        'verification_request' => !empty($input['verification_request']) ? true : false,
        'original_id' => $input['id'] ?? null,
        // New fields
        'type' => !empty($input['id']) ? 'edit' : 'new'
    ];

    $pending = readJSON($pendingFile);
    $pending[] = $entry;
    saveJSON($pendingFile, $pending);

    // TODO: Send Email Notification here (Similar to contact.php)
    // For now just return success
    
    echo json_encode(['success' => true, 'message' => 'Zgłoszenie przyjęte do moderacji!']);
    exit;
}
?>
