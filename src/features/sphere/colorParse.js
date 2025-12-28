// color string like 'rgb(r,g,b)' or '#RRGGBB' -> [r,g,b]
export function parseColorToRgb(s) {
    if (!s) return [255, 255, 255];
    if (Array.isArray(s)) return s;
    if (typeof s === 'string') {
        const hx = s.trim().match(/^#([0-9a-fA-F]{6})$/);
        if (hx) {
            const v = parseInt(hx[1], 16);
            return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
        }
        const m = s.match(/rgba?\s*\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)/i);
        if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    }
    return [255, 255, 255];
}


