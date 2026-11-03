<?php
// Configuration is provisioned outside the web root, readable only by PHP.
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
    $config = @parse_ini_file('/etc/solar-system/database.ini', false, INI_SCANNER_RAW);
    if (!$config || empty($config['user']) || empty($config['password'])) {
        throw new RuntimeException('Missing database configuration');
    }
    $conn = new mysqli('localhost', $config['user'], $config['password'], 'solar_system');
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
            'perihelion_longitude' => (float)($row['perihelion_longitude'] ?? 0),
        ];
    }
    header('Cache-Control: public, max-age=3600');
    echo json_encode($planets, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    header('Cache-Control: no-store');
    http_response_code(503);
    echo json_encode(['error' => '天体数据暂时不可用，请重试。'], JSON_UNESCAPED_UNICODE);
} finally {
    if (isset($conn)) $conn->close();
}
