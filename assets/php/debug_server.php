<?php
// debug_server.php
// Upload this to assets/php/ and run it via browser: yoursite.com/assets/php/debug_server.php

header('Content-Type: text/html; charset=utf-8');
echo "<h1>Salsopedia Server Diagnostic</h1>";

// 1. Check PHP Version
echo "<h2>1. PHP Environment</h2>";
echo "PHP Version: " . phpversion() . "<br>";
echo "Document Root: " . $_SERVER['DOCUMENT_ROOT'] . "<br>";
echo "Current Script: " . __FILE__ . "<br>";

// 2. Check Paths
echo "<h2>2. File Paths</h2>";
$dataFile = '../data/salsopedia.json';
$absPath = realpath($dataFile);

echo "Target Data File: <code>$dataFile</code><br>";
echo "Absolute Path (resolved): " . ($absPath ? $absPath : "<strong>NOT FOUND</strong>") . "<br>";

// 3. Check Permissions
echo "<h2>3. Permissions</h2>";
if (file_exists($dataFile)) {
    echo "File Exists: ✅<br>";
    echo "Readable: " . (is_readable($dataFile) ? "✅" : "❌") . "<br>";
    echo "Writable: " . (is_writable($dataFile) ? "✅" : "❌") . "<br>";
    echo "File Size: " . filesize($dataFile) . " bytes<br>";
} else {
    echo "File does not exist at expected path! ❌<br>";
    // Check directory
    $dir = dirname($dataFile);
    echo "Directory <code>$dir</code> exists? " . (is_dir($dir) ? "✅" : "❌") . "<br>";
    if (is_dir($dir)) {
        echo "Directory Writable? " . (is_writable($dir) ? "✅" : "❌") . "<br>";
        echo "Listing directory contents:<br>";
        $files = scandir($dir);
        echo "<pre>" . print_r($files, true) . "</pre>";
    }
}

// 4. Check JSON Content
echo "<h2>4. JSON Validity</h2>";
if (file_exists($dataFile)) {
    $content = file_get_contents($dataFile);
    if (empty($content)) {
        echo "File Content is EMPTY! ❌<br>";
    } else {
        echo "Content Length: " . strlen($content) . " chars<br>";
        $json = json_decode($content, true);
        if ($json === null) {
            echo "JSON Decode Error: ❌ " . json_last_error_msg() . "<br>";
            echo "First 100 chars: <pre>" . htmlspecialchars(substr($content, 0, 100)) . "</pre>";
        } else {
            echo "JSON Valid: ✅<br>";
            echo "Terms count: " . count($json) . "<br>";
        }
    }
}

?>
