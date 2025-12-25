// Sphere 用の時代別トーン（陸/雲）
// ※ `src/utils/colors.js` から再exportされる前提

// Sphere 用: 時代別の陸トーン（既定は大森林時代と同じ値）
// 時代別の陸トーン色（Sphere の陸に貼るトーン）。初期値は全時代とも #96A5B9。
// 後で個別に変更したい場合は、このマップの値を編集してください。
const ERA_LAND_TINTS = {
    '爆撃時代': '#2b1b0b',
    '生命発生前時代': '#2b1b0b',
    '嫌気性細菌誕生時代': '#261f15',
    '光合成細菌誕生時代': '#96A5B9',
    '真核生物誕生時代': '#96A5B9',
    '多細胞生物誕生時代': '#96A5B9',
    '海洋生物多様化時代': '#96A5B9',
    '苔類進出時代': '#96A5B9',
    'シダ植物時代': '#96A5B9',
    '大森林時代': '#96A5B9',
    '文明時代': '#96A5B9',
    '海棲文明時代': '#96A5B9'
};

export function getEraLandTint(era) {
    const def = '#96A5B9';
    if (era && Object.prototype.hasOwnProperty.call(ERA_LAND_TINTS, era)) {
        return ERA_LAND_TINTS[era];
    }
    return def;
}

// 時代別の雲トーン色（Sphere の雲レイヤに貼る色）。初期値は全時代とも #FFFFFF。
// 後で個別に変更したい場合は、このマップの値を編集してください。
const ERA_CLOUD_TINTS = {
    '爆撃時代': '#B0B0B0',
    '生命発生前時代': '#afa58f',
    '嫌気性細菌誕生時代': '#E0B878',
    '光合成細菌誕生時代': '#e5e5e5',
    '真核生物誕生時代': '#E7E9EA',
    '多細胞生物誕生時代': '#E7E9EA',
    '海洋生物多様化時代': '#E7E9EA',
    '苔類進出時代': '#E7E9EA',
    'シダ植物時代': '#E7E9EA',
    '大森林時代': '#E7E9EA',
    '文明時代': '#E7E9EA',
    '海棲文明時代': '#E7E9EA'
};

export function getEraCloudTint(era) {
    const def = '#FFFFFF';
    if (era && Object.prototype.hasOwnProperty.call(ERA_CLOUD_TINTS, era)) {
        return ERA_CLOUD_TINTS[era];
    }
    return def;
}


