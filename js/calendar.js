// A civil time can occur twice when a clock moves backward, or not at all when
// it moves forward. Round trip each candidate with the timezone rules for that date.
export function localFields(ms) {
    const d = new Date(ms);
    return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
}
export function localInstants(fields) {
    if (fields.length !== 6 || fields.some((v) => !/^\d+$/.test(String(v)))) return [];
    const parts = fields.map(Number);
    const [y, m, d, h, i, s] = parts;
    if (y < 2000 || y > 2100) return [];
    const first = new Date(y, m - 1, d, h, i, s).getTime();
    if (!Number.isFinite(first) || !localFields(first).every((value, index) => value === parts[index]))
        return [];
    const after = new Date(first + 86400000);
    const shift = after.getTimezoneOffset() - new Date(first).getTimezoneOffset();
    const second = first + shift * 60000;
    return shift > 0 && localFields(second).every((value, index) => value === parts[index])
        ? [first, second]
        : [first];
}
export function parseLocal(fields, preferredOffset) {
    const times = localInstants(fields);
    return times.find((ms) => new Date(ms).getTimezoneOffset() === preferredOffset) ?? times[0] ?? null;
}
