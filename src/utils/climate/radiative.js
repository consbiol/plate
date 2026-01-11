// Pure radiative / atmosphere helper functions to consolidate duplicated logic
// NOTE: model.js already defines safeLn and ratio2Over1PlusRatio2.
// To avoid circular import at runtime, we reimplement minimal helpers here.
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

export function computeSolarAndGases(Time_yr, constants = {}) {
    const solarFlareUpRate = Number(constants.solarFlareUpRate) || 0.3;
    const argonCapacity = Number(constants.argonCapacity) || 0.0101;
    const initial_H2 = Number(constants.initial_H2) || 0.01;

    const solarEvolution = 1 + solarFlareUpRate * ((Time_yr * 0.000000001) / 4.55);
    const f_Ar = 0.000001 + (argonCapacity - 0.000001) * (1 - Math.exp(-0.555 * Time_yr * 0.000000001));
    const f_H2 = Math.max(0, initial_H2 * Math.exp(-Time_yr / 500000000));
    return { solarEvolution, f_Ar, f_H2 };
}

export function computeClouds({ Pressure, f_ocean, averageTemperature, CosmicRay = 1, mode = 'full', f_CH4 = 0, f_CO2 = 0 } = {}) {
    // mode 'full' uses computeNext coefficients; mode 'init' uses init-side approx
    let f_cloud_0;
    const avg = Number(averageTemperature) || 15;
    if (mode === 'init') {
        f_cloud_0 = Math.max(
            0,
            (
                0.1
                + 0.7 * f_ocean
                + 0.15 * Math.log(Math.min(Pressure, 10))
                + 0.02 * Math.min(50, (avg - 15))
            )
            * (1 / (1 + Math.exp((avg - 65) / 6)))
        );
    } else {
        f_cloud_0 = Math.max(
            0.01,
            (
                0.2
                + 0.6 * f_ocean
                + 0.15 * safeLn(Math.min(Pressure, 10))
                + 0.04 * Math.min(50, (avg - 15))
            )
            * (1 / (1 + Math.exp((avg - 80) / 10)))
        );
    }
    const hazeFrac = ratio2Over1PlusRatio2(f_CH4, f_CO2);
    const f_cloud = Math.max(0.001, Math.min(1, f_cloud_0 * (1 - 0.3 * hazeFrac) * CosmicRay));
    return { f_cloud_0, hazeFrac, f_cloud };
}

export function computeH2Oeff(averageTemperature, f_ocean, constants = {}, options = {}) {
    const T_sat = Number(constants.T_sat) || 40;
    const dT = Number(constants.dT) || 5;
    const H2O_max = Number(constants.H2O_max) || 2.9;
    const avg = Number(averageTemperature) || 15;
    let H2O_eff = H2O_max
        * (Math.exp((avg - 15) / 30) / (1 + Math.exp((avg - T_sat) / dT)))
        * (f_ocean + 0.1 * (1 - f_ocean)) + 0.05;
    if (options.conservative) {
        H2O_eff = Math.min(H2O_eff, 1.0);
    }
    return H2O_eff;
}

export function computeLnGases(f_CO2, f_CH4) {
    let lnCO2 = safeLn(f_CO2 * 15000);
    if (!isFinite(lnCO2) || lnCO2 < 0.5) lnCO2 = 0.5;
    let lnCH4 = safeLn(f_CH4 * 100000);
    if (!isFinite(lnCH4) || lnCH4 < -1.5) lnCH4 = -1.5;
    return { lnCO2, lnCH4 };
}

export function computeRadiationCooling(Pressure, lnCO2, lnCH4, H2O_eff, f_H2, floor = 0.15) {
    let Radiation_cooling =
        1 / (1 + Math.pow(Pressure, 0.45) * (0.2 * lnCO2 + 0.3 * lnCH4 + 0.8 * H2O_eff + f_H2 * (0.4 * 0.78 + 0.2 * f_H2 + 0.1 * 0)));
    Radiation_cooling = Math.max(Radiation_cooling, floor);
    return Radiation_cooling;
}

export function computeRadiativeEquilibriumCalc({ solarEvolution, Time_yr, Meteo_eff = 1, sol_event = 0, albedo = 0.3, Radiation_cooling }) {
    const milankovitch = 1 + 0.00005 * Math.sin(2 * Math.PI * Time_yr / 100000);
    const Sol = 950 * solarEvolution * milankovitch + sol_event;
    const sigma = 5.67e-8;
    const averageTemperature_calc = Math.pow((Sol * Meteo_eff * (1 - albedo)) / (4 * sigma * Radiation_cooling), 0.25);
    return { averageTemperature_calc, Sol };
}

export function computeAlbedo({ f_cloud, hazeFrac, terrain = {} } = {}) {
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

    const albedo_0 =
        // 氷河
        (1 - f_cloud) * 0.65 * f_glacier + (f_cloud) * (0.65 + 0.05) * f_glacier
        // 緑地+ツンドラ
        + (1 - f_cloud) * 0.13 * (f_green + f_tundra) + (f_cloud) * (0.13 + 0.15) * (f_green + f_tundra)
        // 都市
        + (1 - f_cloud) * 0.14 * f_city + (f_cloud) * (0.14 + 0.06) * f_city
        // 砂漠
        + (1 - f_cloud) * 0.38 * f_desert + (f_cloud) * (0.38 + 0.07) * f_desert
        // 農地+汚染地
        + (1 - f_cloud) * 0.18 * (f_cultivated + f_polluted) + (f_cloud) * (0.18 + 0.12) * (f_cultivated + f_polluted)
        // 高地+高山
        + (1 - f_cloud) * 0.22 * (f_highland + f_alpine) + (f_cloud) * (0.22 + 0.03) * (f_highland + f_alpine)
        // 海洋
        + (1 - f_cloud) * 0.06 * f_ocean + (f_cloud) * (0.06 + 0.69) * f_ocean;

    let albedo = albedo_0 + (1 - albedo_0) * 0.12 * hazeFrac;
    if (albedo < 0.15) albedo = 0.15;
    if (albedo > 0.7) albedo = 0.7;
    return albedo;
}

