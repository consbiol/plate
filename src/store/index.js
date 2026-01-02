import { createStore } from 'vuex';
import { safeLoadPersistedState, safePersistState } from './persist.js';
import { createUiSlice } from './slices/ui.js';
import { createGeneratorSlice } from './slices/generator.js';
import { createRenderSlice } from './slices/render.js';
import { createWorldSlice } from './slices/world.js';
import { createClimateSlice } from './slices/climate.js';
import { bestEffort } from '../utils/bestEffort.js';

const PERSISTED = safeLoadPersistedState();

const UI = createUiSlice({ persisted: PERSISTED });
const GENERATOR = createGeneratorSlice({ persisted: PERSISTED });
const RENDER = createRenderSlice({ persisted: PERSISTED });
const WORLD = createWorldSlice({ persisted: PERSISTED });
const CLIMATE = createClimateSlice({ persisted: PERSISTED });

export default createStore({
    // Vuex modules にせず「ファイル分割」で整理（既存の action/getter 名を維持するため）
    state: {
        ...UI.state,
        ...GENERATOR.state,
        ...RENDER.state,
        ...WORLD.state,
        ...CLIMATE.state,
        // -------------------------------------------------------------------
        // 予約（現状未使用）:
        // 以前 state に入っていた将来用パラメータは、混乱を避けるため state から外し、コメントとして残す。
        // （必要になったタイミングで state/getters/mutations/actions を追加して復活させる）
    },
    getters: {
        ...UI.getters,
        ...GENERATOR.getters,
        ...RENDER.getters,
        ...WORLD.getters,
        ...CLIMATE.getters
    },
    mutations: {
        ...UI.mutations,
        ...GENERATOR.mutations,
        ...RENDER.mutations,
        ...WORLD.mutations,
        ...CLIMATE.mutations
    },
    actions: {
        ...UI.actions,
        ...GENERATOR.actions,
        ...RENDER.actions,
        ...WORLD.actions,
        ...CLIMATE.actions
    },
    plugins: [
        (store) => {
            // 永続化は debounce（高頻度UI操作での localStorage 書き込みを抑制）
            let timer = null;
            let lastState = null;
            const flush = () => {
                timer = null;
                safePersistState(lastState);
            };
            store.subscribe((_mutation, state) => {
                lastState = state;
                if (timer) clearTimeout(timer);
                timer = setTimeout(flush, 100);
            });
            // 画面離脱時に最後の状態を確実に保存（可能な範囲で）
            bestEffort(() => {
                if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') {
                    window.addEventListener('beforeunload', () => {
                        if (!lastState) return;
                        if (timer) {
                            clearTimeout(timer);
                            timer = null;
                        }
                        safePersistState(lastState);
                    });
                }
            });
        }
    ]
});


