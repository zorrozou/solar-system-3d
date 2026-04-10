<?php
$dbHost = getenv('DB_HOST') ?: 'localhost';
$dbUser = getenv('DB_USER') ?: 'solar_user';
$dbPass = getenv('DB_PASS') ?: 'solar_pass_2026';
$dbName = getenv('DB_NAME') ?: 'solar_system';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=3600');

try {
    $conn = new mysqli($dbHost, $dbUser, $dbPass, $dbName);
    if ($conn->connect_error) throw new Exception('数据库连接失败');
    $conn->set_charset('utf8mb4');

    $result = $conn->query("SELECT * FROM planets ORDER BY distance_from_sun");
    if (!$result) throw new Exception('查询失败');

    $planets = [];
    while ($row = $result->fetch_assoc()) {
        $planets[] = [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'name_cn' => $row['name_cn'],
            'distance_from_sun' => (float)$row['distance_from_sun'],
            'orbital_period' => (float)$row['orbital_period'],
            'rotation_period' => (float)$row['rotation_period'],
            'radius' => (float)$row['radius'],
            'mass' => (float)$row['mass'],
            'color' => $row['color'],
            'description' => $row['description'],
            'moons' => isset($row['moons']) ? (int)$row['moons'] : (int)$row['satellites'],
            'orbital_inclination' => (float)($row['orbital_inclination'] ?? 0),
            'axial_tilt' => (float)($row['axial_tilt'] ?? 0),
            'eccentricity' => (float)($row['eccentricity'] ?? 0),
            'mean_anomaly_j2000' => (float)($row['mean_anomaly_j2000'] ?? 0),
        ];
    }
    echo json_encode($planets, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
} finally {
    if (isset($conn)) $conn->close();
}
