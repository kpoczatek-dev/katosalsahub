<?php
/**
 * Salsopedia Approval Script (v7)
 * Handles approval/rejection and increments verification_count.
 */

header('Content-Type: application/json; charset=utf-8');

$salsopediaFile = '../data/salsopedia.json';
$pendingFile = '../data/pending_edits.json';

function readJSON($file) {
    if (!file_exists($file)) return [];
    $content = file_get_contents($file);
    return json_decode($content, true) ?? [];
}

function saveJSON($file, $data) {
    return file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// Log function for debugging
function debug_log($msg) {
    file_put_contents('approve_debug.log', date('Y-m-d H:i:s') . ": " . $msg . "\n", FILE_APPEND);
}

$token = $_GET['token'] ?? null;
$action = $_GET['action'] ?? null;

if (!$token || !$action) {
    echo json_encode(['success' => false, 'message' => 'Brak tokena lub akcji.']);
    exit;
}

$pending = readJSON($pendingFile);
$entryIndex = -1;
$entry = null;

foreach ($pending as $index => $item) {
    if (isset($item['token']) && $item['token'] === $token) {
        $entryIndex = $index;
        $entry = $item;
        break;
    }
}

if ($entryIndex === -1) {
    echo json_encode(['success' => false, 'message' => 'Zgłoszenie nie istnieje lub zostało już przetworzone.']);
    exit;
}

if ($action === 'approve') {
    $salsopedia = readJSON($salsopediaFile);

    // Create Final Entry
    $entryCats = is_array($entry['category']) ? $entry['category'] : [$entry['category']];
    
    // Check if verification or new
    $originalId = $entry['original_id'] ?? null;
    $updated = false;

    if ($originalId) {
        // Edit or Verify
        foreach ($salsopedia as $idx => $existing) {
             if ($existing['id'] === $originalId) {
                 // Check verification request
                 if (!empty($entry['verification_request'])) {
                     $salsopedia[$idx]['verification_count'] = ($existing['verification_count'] ?? 0) + 1;
                     $salsopedia[$idx]['status'] = 'verified';
                 } else {
                     // Full Update
                     $salsopedia[$idx]['term'] = $entry['term'];
                     $salsopedia[$idx]['definition'] = $entry['definition'];
                     $salsopedia[$idx]['category'] = $entryCats;
                     $salsopedia[$idx]['source'] = $entry['source'];
                     $salsopedia[$idx]['verification_count'] = ($existing['verification_count'] ?? 0) + 1;
                     $salsopedia[$idx]['status'] = 'verified';
                     $salsopedia[$idx]['last_updated'] = date('Y-m-d');
                 }
                 $updated = true;
                 break;
             }
        }
    }
    
    if (!$updated) {
        // New Entry
        $finalEntry = [
            'id' => uniqid('term_'),
            'term' => $entry['term'],
            'definition' => $entry['definition'],
            'author' => $entry['author'],
            'category' => $entryCats, 
            'source' => $entry['source'] ?? [],
            'status' => 'verified', 
            'verification_count' => 1,
            'last_updated' => date('Y-m-d')
        ];
        $salsopedia[] = $finalEntry;
        
        // Sort A-Z
        usort($salsopedia, function($a, $b) {
            return strcasecmp($a['term'], $b['term']);
        });
    }

    saveJSON($salsopediaFile, $salsopedia);
    
    // Remove from pending
    array_splice($pending, $entryIndex, 1);
    saveJSON($pendingFile, $pending);

    echo json_encode(['success' => true, 'message' => 'Zatwierdzono pomyślnie!']);

} elseif ($action === 'reject') {
    // Just remove from pending
    array_splice($pending, $entryIndex, 1);
    saveJSON($pendingFile, $pending);
    echo json_encode(['success' => true, 'message' => 'Odrzucono zgłoszenie.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Nieznana akcja.']);
}
?>
