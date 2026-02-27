<?php
// db.php
require_once 'config.php';

try {
    $dsn = "pgsql:host=$db_host;port=$db_port;dbname=$db_name;";
    $pdo = new PDO($dsn, $db_user, $db_pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (PDOException $e) {
    die(json_encode(['error' => 'Connection failed: ' . $e->getMessage()]));
}
