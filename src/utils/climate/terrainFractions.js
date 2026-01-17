// Parameters_Display.vue が持つ gridTypeCounts/preGlacierStats から
// 気候モデルが使う面積率（0..1）を生成する。

function safeDiv(n, d) {
    const nn = Number(n);
    const dd = Number(d);
    if (!isFinite(nn) || !isFinite(dd) || dd <= 0) return 0;
    return nn / dd;
}

export function buildTerrainFractionsFromTypeCounts({ typeCounts, preGlacierStats, gridWidth, gridHeight, era } = {}) {
    const totalFallback = (Number(gridWidth) > 0 && Number(gridHeight) > 0) ? (Number(gridWidth) * Number(gridHeight)) : 1;
    const total = (typeCounts && typeof typeCounts.total === 'number') ? typeCounts.total : totalFallback;

    const get = (k) => (typeCounts && typeof typeCounts[k] === 'number') ? typeCounts[k] : 0;

    const f_deepSea = safeDiv(get('deepSea'), total);
    const f_shallowSea = safeDiv(get('shallowSea'), total);
    const f_glacier = safeDiv(get('glacier'), total);
    const f_lowland = safeDiv(get('lowland'), total);
    const f_desert = safeDiv(get('desert'), total);
    const f_highland = safeDiv(get('highland'), total);
    const f_alpine = safeDiv(get('alpine'), total);
    const f_tundra = safeDiv(get('tundra'), total);
    const f_lake = safeDiv(get('lake'), total);
    const f_bryophyte = safeDiv(get('bryophyte'), total);
    const f_city = safeDiv(get('city'), total);
    const f_cultivated = safeDiv(get('cultivated'), total);
    const f_polluted = safeDiv(get('polluted'), total);
    const f_seaCity = safeDiv(get('seaCity'), total);
    const f_seaCultivated = safeDiv(get('seaCultivated'), total);
    const f_seaPolluted = safeDiv(get('seaPolluted'), total);

    // gridTypeCounts はフラグ優先で分類されるため、bryophyte/city/cultivated/polluted は
    // 低地等の地形カテゴリから「引かれた状態」でカウントされる。
    // 指定仕様に従い、陸面積率は各カテゴリ（+苔）を明示的に加算する。
    const f_land = f_lowland + f_desert + f_highland + f_alpine + f_tundra + f_city + f_cultivated + f_polluted + f_bryophyte;
    const f_ocean = f_deepSea + f_shallowSea + f_lake + f_seaCity + f_seaCultivated + f_seaPolluted;

    // 指定仕様:
    // - 爆撃時代/生命発生前時代/嫌気性細菌誕生時代/光合成細菌誕生時代/多細胞生物誕生時代/海洋生物多様化時代: f_green = 0
    // - 苔類進出時代: f_green = f_bryophyte
    // - シダ植物時代/大森林時代/文明時代/海棲文明時代: f_green = f_lowland
    // - その他は既定で 0
    const e = (typeof era === 'string') ? era : null;
    const GREEN_ZERO_ERAS = new Set([
        '爆撃時代',
        '生命発生前時代',
        '嫌気性細菌誕生時代',
        '光合成細菌誕生時代',
        '多細胞生物誕生時代',
        '海洋生物多様化時代'
    ]);
    const GREEN_LOWLAND_ERAS = new Set([
        'シダ植物時代',
        '大森林時代',
        '文明時代',
        '海棲文明時代'
    ]);

    let f_green = 0;
    if (e) {
        if (GREEN_ZERO_ERAS.has(e)) {
            f_green = 0;
        } else if (e === '苔類進出時代') {
            f_green = f_bryophyte;
        } else if (GREEN_LOWLAND_ERAS.has(e)) {
            f_green = f_lowland;
        } else {
            f_green = 0;
        }
    }

    // 氷河補正前の陸/海（湖は海扱い）を優先。なければ現行の陸/海から推定。
    const f_land_original = (preGlacierStats && typeof preGlacierStats.landRatio === 'number')
        ? Number(preGlacierStats.landRatio)
        : f_land;
    const f_ocean_original = 1 - f_land_original;

    return {
        f_land_original,
        f_ocean_original,

        f_deepSea,
        f_shallowSea,
        f_glacier,
        f_lowland,
        f_desert,
        f_highland,
        f_alpine,
        f_tundra,
        f_lake,
        f_bryophyte,
        f_city,
        f_cultivated,
        f_polluted,
        f_seaCity,
        f_seaCultivated,
        f_seaPolluted,

        f_land,
        f_ocean,
        f_green
    };
}


