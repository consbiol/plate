/**
 * パラメータキー（許可キー）の定義を集約する。
 * - 目的: generator/render の「同期・patch許可」のキー管理が複数箇所に散らばるのを防ぐ
 * - 注意: ここは "キー集合の定義" のみに徹し、値のバリデーション等は呼び出し側で行う
 */

/**
 * generatorParams として許可するキー一覧を返す。
 * - PARAM_DEFAULTS 由来のキー（f_cloud は除外）
 * - UI専用の入力: deterministicSeed
 * - 互換のため generatorParams に残している: minCenterDistance
 */
export function getGeneratorAllowedKeys(paramDefaults) {
    const safeDefaults = paramDefaults && typeof paramDefaults === 'object' ? paramDefaults : {};
    return [
        ...Object.keys(safeDefaults).filter((k) => k !== 'f_cloud'),
        'deterministicSeed',
        'minCenterDistance'
    ];
}

/**
 * local -> renderSettings 同期で扱うキー（Parameters_Display の UI 入力に対応）
 * - 現状は f_cloud のみ
 */
export const RENDER_LOCAL_SYNC_KEYS = Object.freeze(['f_cloud']);


