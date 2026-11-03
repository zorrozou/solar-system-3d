// Use the browser's local civil time consistently in both directions.
// A round trip rejects impossible calendar dates and skipped daylight-saving hours.
export function localFields(ms) {
    const d = new Date(ms);
    return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
}
export function parseLocal(fields) {
    if (fields.some((v) => !/^\d+$/.test(String(v)))) return null;
    const parts = fields.map(Number);
    const [y, m, d, h, i, s] = parts;
    if (parts.length !== 6 || y < 2000 || y > 2100) return null;
    const ms = new Date(y, m - 1, d, h, i, s).getTime();
    return localFields(ms).every((n, index) => n === parts[index]) ? ms : null;
}
