// 放射・大気に関する「純粋関数」群（model.js から呼び出すユーティリティ）
// ここは state を直接変更しない / 依存を増やさないことを優先する。
// （循環import回避のため、必要な最小ヘルパーはこのファイル内で完結させる）
function safeLn(x) {
    const v = Number(x);
    if (!isFinite(v) || v <= 0) return -Infinity;
    return Math.log(v);
}
function ratio2Over1PlusRatio2(a, b) {
    const aa = Number(a);
    const bb = Number(b);
    if (!isFinite(aa) || !isFinite(bb) || bb === 0) return 0;
    const r = aa / bb; const r2 = r * r;
    return r2 / (1 + r2);
}

// Helper: convert to finite number or use default (preserves 0)
function toNum(x, def) {
    const v = Number(x);
    return Number.isFinite(v) ? v : def;
}

export function computeSolarAndGases(Time_yr, constants = {}) {
    const solarFlareUpRate = Number(constants.solarFlareUpRate) || 0.3;
    const argonCapacity = Number(constants.argonCapacity) || 0.0101;
    const initial_H2 = Number(constants.initial_H2) || 0.01;

    const solarEvolution = 1 + solarFlareUpRate * ((Time_yr * 0.000000001) / 4.55);
    const f_Ar = 0.000001 + (argonCapacity - 0.000001) * (1 - Math.exp(-0.555 * Time_yr * 0.000000001));
    const f_H2 = Math.max(0, initial_H2 * Math.exp(-Time_yr / 500000000));
    return { solarEvolution, f_Ar, f_H2 };
}

export function computeClouds({ Pressure, f_ocean, averageTemperature, CosmicRay = 1, f_CH4 = 0, f_CO2 = 0 } = {}) {
    let f_cloud_0;
    const avg = Number(averageTemperature) || 15;
    const P = Math.max(Number(Pressure) || 1, 0.01);
    const base = 0.4;
    const oceanCoef = 0.6;
    const minVal = 0.01;

    const raw =
        (base + oceanCoef * f_ocean)
        * Math.exp(-Math.pow((avg - 25) / 20, 2))
        * (1 / (1 + 0.03 * Math.max(avg - 30, 0)))
        * (1 + 0.15 * Math.log(Math.min(P, 10)))
    f_cloud_0 = Math.max(minVal, raw);
    const hazeFrac = ratio2Over1PlusRatio2(f_CH4, f_CO2);
    const f_cloud = Math.max(0.001, Math.min(1, f_cloud_0 * (1 - 0.3 * hazeFrac) * CosmicRay));
    return { f_cloud_0, hazeFrac, f_cloud };
}

export function computeH2Oeff(averageTemperature, f_ocean, constants = {}, options = {}) {
    const T_sat = Number(constants.T_sat) || 40;
    const dT = Number(constants.dT) || 5;
    const H2O_max = Number(constants.H2O_max) || 1.4;
    const avg = Number(averageTemperature) || 15;
    let H2O_eff = H2O_max
        * (Math.exp((avg - 15) / 50) / (1 + Math.exp((avg - T_sat) / dT)))
        * (f_ocean + 0.1 * (1 - f_ocean)) + 0.5;
    if (options.conservative) {
        const H2O_cap =
            avg < 40 ? 1.5 :
                avg < 60 ? 1.4 : 1.3;
        H2O_eff = Math.min(H2O_eff, H2O_cap);
    }
    return H2O_eff;
}

export function computeLnGases(f_CO2, f_CH4) {
    let lnCO2 = safeLn(f_CO2 * 25000);
    if (!isFinite(lnCO2) || lnCO2 < 0.5) lnCO2 = 0.5;
    let lnCH4 = safeLn(f_CH4 * 150000);
    if (!isFinite(lnCH4) || lnCH4 < -1.5) lnCH4 = -1.5;
    return { lnCO2, lnCH4 };
}


export function computeRadiationCooling(Pressure, lnCO2, lnCH4, H2O_eff, f_H2, f_N2, f_CO2, averageTemperature, Time_yr = 0, photosynthEraActive = false) {
    // Normalize inputs while preserving explicit zeros
    Pressure = toNum(Pressure, 0);
    lnCO2 = toNum(lnCO2, 0);
    lnCH4 = toNum(lnCH4, 0);
    H2O_eff = toNum(H2O_eff, 0);
    f_H2 = toNum(f_H2, 0);
    f_N2 = toNum(f_N2, 0.78);
    f_CO2 = toNum(f_CO2, 0.0004);
    averageTemperature = toNum(averageTemperature, 15);

    let tau = Math.pow(Pressure, 0.5) * (1.5 * lnCO2 + 1.5 * lnCH4 + 1.5 * H2O_eff + f_H2 * (0.8 * f_N2 + 0.8 * f_H2 + 0.4 * f_CO2));

    const n = 1.8 + 0.7 * Math.tanh((averageTemperature - 15) / 20);
    tau = Math.min(tau, 15); // tau capped to avoid runaway greenhouse / numerical lock-in
    let Radiation_cooling = 1 / (1 + tau / (Math.pow((averageTemperature + 273) / (15 + 273), n)));
    Radiation_cooling = (0.08 + 0.92 * Radiation_cooling) * (1 + 0.4 * Math.exp(-Time_yr / 1e9));

    // 実験用: 光合成細菌（シアノバクテリア）出現期に放射冷却を強めるボーナス
    // 有効化された場合のみ Radiation_cooling を 0.75 乗して冷却を強める（デフォルトは無効）
    if (photosynthEraActive) {
        Radiation_cooling = Math.pow(Radiation_cooling, 0.75);
    }

    return Radiation_cooling;
}

export function computeRadiativeEquilibriumCalc({ solarEvolution, Meteo_eff = 1, sol_event = 0, albedo = 0.3, Radiation_cooling, initialSol = 950 }) {
    const Sol = initialSol * solarEvolution + sol_event;
    const sigma = 5.67e-8;
    const averageTemperature_calc = Math.pow((Sol * Meteo_eff * (1 - albedo)) / (4 * sigma * Math.pow(Radiation_cooling, 0.6)), 0.25);
    return { averageTemperature_calc, Sol };
}

export function computeAlbedo({ f_cloud, hazeFrac, terrain = {}, Time_yr = 0 } = {}) {
    const f_tundra = Number(terrain.f_tundra) || 0;
    const f_city = Number(terrain.f_city) || 0;
    const f_desert = Number(terrain.f_desert) || 0;
    const f_cultivated = Number(terrain.f_cultivated) || 0;
    const f_polluted = Number(terrain.f_polluted) || 0;
    const f_highland = Number(terrain.f_highland) || 0;
    const f_alpine = Number(terrain.f_alpine) || 0;
    const f_ocean = Number(terrain.f_ocean) || 0;
    const f_green = Number(terrain.f_green) || 0;
    const f_glacier = Number(terrain.f_glacier) || 0;

    function glacierAlbedo(f_glacier) {
        const A_min = 0.3;
        const A_mid = 0.45;
        const A_max = 0.6; // A_max は「全球平均氷床状態」であり、局所的新雪アルベドではない

        const x0 = 0.35;
        const k = 6;

        const s = 1 / (1 + Math.exp(-k * (f_glacier - x0)));

        return A_mid + (A_max - A_mid) * s - (A_mid - A_min) * (1 - s);
    }

    const A_glacier = glacierAlbedo(f_glacier);

    const milankovitch = 1 + 0.015 * Math.sin(2 * Math.PI * Time_yr / 100000);

    const albedo_0 =
        // 氷河（氷河分布球面幾何＋緯度依存の日射重み付け）
        (1 - f_cloud) * A_glacier * f_glacier + f_cloud * (A_glacier + (1 - A_glacier) * 0.05) * f_glacier
        + (1 - f_cloud) * 0.13 * (f_green + f_tundra) + f_cloud * (0.13 + 0.15) * (f_green + f_tundra)
        + (1 - f_cloud) * 0.14 * f_city + f_cloud * (0.14 + 0.06) * f_city
        + (1 - f_cloud) * 0.38 * f_desert + f_cloud * (0.38 + 0.07) * f_desert
        + (1 - f_cloud) * 0.18 * (f_cultivated + f_polluted) + f_cloud * (0.18 + 0.12) * (f_cultivated + f_polluted)
        + (1 - f_cloud) * 0.22 * (f_highland + f_alpine) + f_cloud * (0.22 + 0.03) * (f_highland + f_alpine)
        + (1 - f_cloud) * 0.06 * f_ocean + f_cloud * (0.06 + 0.25) * f_ocean

    let albedo = (albedo_0 + (1 - albedo_0) * 0.12 * hazeFrac) * milankovitch;
    if (albedo < 0.15) albedo = 0.15;
    if (albedo > 0.7) albedo = 0.7;
    return albedo;
}

