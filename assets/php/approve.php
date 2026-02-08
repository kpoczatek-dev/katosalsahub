<?php
/**
 * Salsopedia Approval Script (v7)
 * Handles approval/rejection and increments verification_count.
 */

header('Content-Type: text/html; charset=utf-8');

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

$token = $_GET['token'] ?? null;
$action = $_GET['action'] ?? null;

if (!$token || !$action) die("Błąd linku.");

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
    // Check if maybe it was already processed (optional handling)
    die("Link nieaktualny lub zgłoszenie już przetworzone.");
}

if ($action === 'approve') {
    $salsopedia = readJSON($salsopediaFile);

    // Ensure category is array
    $entryCats = is_array($entry['category']) ? $entry['category'] : [$entry['category']];

    // Check if it's a verification request or full edit
    if (!empty($entry['verification_request']) && !empty($entry['original_id'])) {
        // Find original entry
        $found = false;
        foreach ($salsopedia as $idx => $existing) {
            if ($existing['id'] === $entry['original_id']) {
                // Increment Verification Count
                $currentCount = isset($existing['verification_count']) ? (int)$existing['verification_count'] : 0;
                $salsopedia[$idx]['verification_count'] = $currentCount + 1;
                
                // If count > 0, status becomes verified
                $salsopedia[$idx]['status'] = 'verified';
                
                // Update simple fields (author of verification is just partial)
                // We might want to keep the original author or append verifiers names
                // For simplicity: We just increment count and set status.
                
                $found = true;
                break;
            }
        }
    } else {
        // It's a new term or full edit (content change)
        // If it's a content change, we accept the new content.
        // If it's new, we add it.

        $finalEntry = [
            'id' => !empty($entry['original_id']) ? $entry['original_id'] : uniqid('term_'),
            'term' => $entry['term'],
            'definition' => $entry['definition'],
            'author' => $entry['author'],
            'category' => $entryCats, 
            'source' => $entry['source'],
            // New entry is verified by admin instantly? Or starts at 1?
            'status' => 'verified', 
            'verification_count' => 1,
            'last_updated' => date('Y-m-d')
        ];

        $updated = false;
        foreach ($salsopedia as $idx => $existing) {
            if ($existing['id'] === $finalEntry['id']) {
                $salsopedia[$idx] = $finalEntry;
                $updated = true;
                break;
            }
        }
        
        if (!$updated) {
            $salsopedia[] = $finalEntry;
            // A-Z Sort
            usort($salsopedia, function($a, $b) {
                return strcasecmp($a['term'], $b['term']);
            });
        }
    }

    saveJSON($salsopediaFile, $salsopedia);
    
    // Remove from pending
    array_splice($pending, $entryIndex, 1);
    saveJSON($pendingFile, $pending);

    echo "<h1 style='color: green;'>Zatwierdzono! ✅</h1><p>Baza zaktualizowana.</p>";

} elseif ($action === 'reject') {
    array_splice($pending, $entryIndex, 1);
    saveJSON($pendingFile, $pending);
    echo "<h1 style='color: red;'>Odrzucono ❌</h1>";
}
?>
