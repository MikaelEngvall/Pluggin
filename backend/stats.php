<?php
// stats.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

require_once 'db.php';

// Get total seconds per domain, top 20
$stmt = $pdo->query("
    SELECT domain, SUM(duration_seconds) as total_seconds 
    FROM visits 
    GROUP BY domain 
    ORDER BY total_seconds DESC 
    LIMIT 20
");

$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode(['data' => $results]);
