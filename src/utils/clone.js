/**
 * deep clone utility
 * - structuredClone が使える環境ではそれを優先
 * - 未対応環境では JSON clone にフォールバック（従来互換）
 *   ※ Date/Map/Set/関数などは失われるが、既存の centerParameters 用途では問題になりにくい
 */

export function deepClone(value) {
    try {
        if (typeof structuredClone === 'function') return structuredClone(value);
    } catch (e) {
        // fall through to JSON clone
    }
    return JSON.parse(JSON.stringify(value));
}


