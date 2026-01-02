<template>
  <div class="turn-panel">
    <div class="title">ターン進行</div>

    <div class="controls">
      <button @click="$emit('turn-start')" :disabled="!!(climateTurn && climateTurn.isRunning)">ターン進行</button>
      <button @click="$emit('turn-stop')" :disabled="!(climateTurn && climateTurn.isRunning)">ターン停止</button>

      <label class="control">
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          :value="turnSliderExp"
          @input="$emit('update-turn-slider-exp', toNumber($event && $event.target ? $event.target.value : 0))"
        />
        <span>Turn_speed: <b>{{ safeSpeedLabel }}</b> sec/turn</span>
      </label>

      <label class="control">
        <span>Turn_yr:</span>
        <input
          type="range"
          :min="0"
          :max="Math.max(0, (turnYrOptions && turnYrOptions.length ? turnYrOptions.length - 1 : 0))"
          step="1"
          :value="selectedIndex"
          @input="onIndexInput($event && $event.target ? $event.target.value : 0)"
        />
        <span class="hint">{{ currentTurnYr }} yr</span>
      </label>

      <button @click="$emit('open-climate-popup')">気候パラメータ</button>
    </div>

    <div class="status">
      Time_turn: <b>{{ climateTurn && climateTurn.Time_turn }}</b> /
      Turn_yr: <b>{{ climateTurn && climateTurn.Turn_yr }}</b> yr/turn /
      Time_yr: <b>{{ climateTurn && climateTurn.Time_yr }}</b> yr /
      時代: <b>{{ climateTurn && climateTurn.era }}</b>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TurnPanel',
  props: {
    climateTurn: { type: Object, required: true },
    turnSpeed: { type: Number, required: true },
    turnSliderExp: { type: Number, required: true },
    selectedTurnYr: { type: Number, required: true },
    turnYrOptions: { type: Array, required: true },
  },
  computed: {
    safeSpeedLabel() {
      const v = Number(this.turnSpeed);
      if (!isFinite(v)) return '1.0';
      return v.toFixed(1);
    },
    selectedIndex() {
      if (!Array.isArray(this.turnYrOptions) || this.turnYrOptions.length === 0) return 0;
      const idx = this.turnYrOptions.indexOf(this.selectedTurnYr);
      return idx >= 0 ? idx : 0;
    },
    currentTurnYr() {
      if (!Array.isArray(this.turnYrOptions) || this.turnYrOptions.length === 0) return this.selectedTurnYr || 0;
      const idx = this.selectedIndex;
      return this.turnYrOptions[idx] || this.selectedTurnYr || 0;
    },
  },
  methods: {
    onIndexInput(val) {
      const idx = Math.max(0, Math.min((this.turnYrOptions || []).length - 1, Number(val || 0)));
      const v = (this.turnYrOptions && this.turnYrOptions[idx]) ? this.turnYrOptions[idx] : this.selectedTurnYr;
      this.$emit('change-turn-yr', Number(v));
    },
    toNumber(v) {
      const n = Number(v);
      return isFinite(n) ? n : 0;
    },
  },
};
</script>

<style scoped>
.turn-panel {
  margin: 10px 8px 18px 8px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  text-align: left;
}
.title {
  font-weight: bold;
  margin-bottom: 6px;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.control {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}
.status {
  margin-top: 6px;
  color: #333;
}
</style>


