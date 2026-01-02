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

      <div class="row">
        <label class="label">方向角度 (direction):</label>
        <input
          class="input"
          type="number"
          min="0"
          max="360"
          step="1"
          :value="toDeg(param.directionAngle)"
          @input="updateDirection(idx, $event && $event.target ? $event.target.value : 0)"
        />
        <span>°</span>
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
    // - item.directionAngle: number (radian)（編集: 入力はdeg→内部はradに変換）
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
    toDeg(rad) {
      const r = Number(rad || 0);
      const deg = (r * 180) / Math.PI;
      return ((Math.round(deg) % 360) + 360) % 360;
    },
    emitUpdate() {
      // 親へ確定値を通知（ローカル配列自体を渡すと参照共有になりうるのでclone）
      this.$emit('update:modelValue', deepClone(this.localParams || []));
    },
    updateDirection(idx, degVal) {
      const degRaw = Number(degVal);
      const deg = isFinite(degRaw) ? (((degRaw % 360) + 360) % 360) : 0;
      const rad = (deg * Math.PI) / 180;
      if (this.localParams && this.localParams[idx]) {
        this.localParams[idx].directionAngle = rad;
        this.emitUpdate();
      }
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


