<template>
  <div v-if="localParams && localParams.length > 0" class="center-params">
    <div class="title">各中心点のパラメーター:</div>
    <div v-for="(param, idx) in localParams" :key="idx" class="card">
      <div class="card-title">中心点 {{ idx + 1 }}:</div>

      <div class="row">
        <label class="label">座標 (x, y):</label>
        <span class="value">({{ param.x }}, {{ param.y }})</span>
      </div>

      <div class="row">
        <label class="label">影響係数 (influence):</label>
        <input class="input" type="number" min="0.1" max="3.0" step="0.1" v-model.number="param.influenceMultiplier" @input="emitUpdate" />
      </div>

      <div class="row">
        <label class="label">減衰率 (kDecay):</label>
        <input class="input" type="number" min="0.5" max="5.0" step="0.1" v-model.number="param.kDecayVariation" @input="emitUpdate" />
      </div>

      
    </div>
  </div>
</template>

<script>
import { deepClone } from '../../utils/clone.js';

export default {
  name: 'CenterParametersEditor',
  props: {
    // v-model compatible.
    // 想定構造（配列）:
    // - item.x: number（表示のみ）
    // - item.y: number（表示のみ）
    // - item.influenceMultiplier: number（編集）
    // - item.kDecayVariation: number（編集）
    modelValue: { type: Array, required: true },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      localParams: deepClone(this.modelValue || []),
    };
  },
  watch: {
    modelValue: {
      deep: true,
      handler(next) {
        // 親が差し替えたらローカルも追従（編集途中の破壊を避けたい場合はここを調整）
        this.localParams = deepClone(next || []);
      },
    },
  },
  methods: {
    emitUpdate() {
      // 親へ確定値を通知（ローカル配列自体を渡すと参照共有になりうるのでclone）
      this.$emit('update:modelValue', deepClone(this.localParams || []));
    },
    
  },
};
</script>

<style scoped>
.center-params {
  margin-top: 20px;
  text-align: left;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}
.title {
  font-weight: bold;
  margin-bottom: 8px;
}
.card {
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
.card-title {
  font-weight: bold;
  margin-bottom: 4px;
}
.row {
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.label {
  display: inline-block;
  width: 150px;
}
.value {
  display: inline-block;
  width: 100px;
}
.input {
  width: 100px;
}
</style>


