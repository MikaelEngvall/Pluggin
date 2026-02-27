<?php
// track.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db.php';

// Get JSON POST body
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (isset($data['domain']) && isset($data['duration_seconds'])) {
    $domain = $data['domain'];
    $duration = (int) $data['duration_seconds'];

    if ($duration > 0) {
        $stmt = $pdo->prepare("INSERT INTO visits (domain, duration_seconds) VALUES (:domain, :duration)");
        $stmt->execute(['domain' => $domain, 'duration' => $duration]);
        echo json_encode(['status' => 'success']);
    } else {
        echo json_encode(['status' => 'ignored', 'reason' => 'duration is zero']);
    }
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid data']);
}
