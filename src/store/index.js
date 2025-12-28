import { createStore } from 'vuex';
import { safeLoadPersistedState, safePersistState } from './persist.js';
import { createUiSlice } from './slices/ui.js';
import { createGeneratorSlice } from './slices/generator.js';
import { createRenderSlice } from './slices/render.js';
import { createWorldSlice } from './slices/world.js';

const PERSISTED = safeLoadPersistedState();

const UI = createUiSlice({ persisted: PERSISTED });
const GENERATOR = createGeneratorSlice({ persisted: PERSISTED });
const RENDER = createRenderSlice({ persisted: PERSISTED });
const WORLD = createWorldSlice({ persisted: PERSISTED });

export default createStore({
    // Vuex modules にせず「ファイル分割」で整理（既存の action/getter 名を維持するため）
    state: {
        ...UI.state,
        ...GENERATOR.state,
        ...RENDER.state,
        ...WORLD.state,
        // -------------------------------------------------------------------
        // 予約（現状未使用）:
        // 以前 state に入っていた将来用パラメータは、混乱を避けるため state から外し、コメントとして残す。
        // （必要になったタイミングで state/getters/mutations/actions を追加して復活させる）
    },
    getters: {
        ...UI.getters,
        ...GENERATOR.getters,
        ...RENDER.getters,
        ...WORLD.getters
    },
    mutations: {
        ...UI.mutations,
        ...GENERATOR.mutations,
        ...RENDER.mutations,
        ...WORLD.mutations
    },
    actions: {
        ...UI.actions,
        ...GENERATOR.actions,
        ...RENDER.actions,
        ...WORLD.actions
    },
    plugins: [
        (store) => {
            store.subscribe((_mutation, state) => {
                safePersistState(state);
            });
        }
    ]
});


