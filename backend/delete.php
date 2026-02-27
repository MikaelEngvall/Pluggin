<?php
// delete.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'db.php';

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (isset($data['clear_all']) && $data['clear_all'] === true) {
    try {
        $pdo->exec("TRUNCATE TABLE visits");
        echo json_encode(['status' => 'success', 'message' => 'All data cleared']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to clear data']);
    }
} else if (isset($data['domain'])) {
    $domain = $data['domain'];
    try {
        $stmt = $pdo->prepare("DELETE FROM visits WHERE domain = :domain");
        $stmt->execute(['domain' => $domain]);
        echo json_encode(['status' => 'success', 'message' => "Data for $domain cleared"]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete domain data']);
    }
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request data']);
}
