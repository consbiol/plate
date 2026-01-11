<template>
  <div class="turn-panel">
    <div class="title">ターン進行</div>

    <div class="controls">
      <button @click="$emit('turn-start')" :disabled="!!(climateTurn && climateTurn.isRunning)">ターン進行</button>
      <button @click="$emit('turn-stop')" :disabled="!(climateTurn && climateTurn.isRunning)">ターン停止</button>
      <div class="controls-break" aria-hidden="true"></div>
      <label class="control">
        <input
          type="range"
          :min="0"
          :max="Math.max(0, speedOptions.length - 1)"
          step="1"
          :value="selectedSpeedIndex"
          @input="onSpeedIndexInput($event && $event.target ? $event.target.value : 0)"
        />
        <span>Turn_speed: <b>{{ safeSpeedLabel }}</b> sec/turn</span>
      </label>
      <div class="controls-break" aria-hidden="true"></div>
      <div class="speed-labels">
        <span
          v-for="(opt, idx) in speedOptions"
          :key="opt.display"
          :class="['speed-label', { active: idx === selectedSpeedIndex }]"
        >{{ opt.display }}</span>
      </div>

      <label class="control">
        <input type="checkbox" :checked="turnYrEnabled" @change="onToggleTurnYrEnabled($event)" />
        <span>year/turn</span>
        <div class="turn-buttons" :aria-disabled="!turnYrEnabled">
          <button
            v-for="opt in turnYrOptions"
            :key="opt"
            type="button"
            class="turn-btn"
            :class="{ active: Number(opt) === currentTurnYr }"
            :disabled="!turnYrEnabled || isDisabledByEra(opt)"
            @click="onTurnBtnClick(opt)"
          >
            {{ renderBtnLabel(opt) }}
          </button>
        </div>
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
import { buildEraTurnYr } from '../../utils/climate/eraPresets.js';
export default {
  name: 'TurnPanel',
  props: {
    climateTurn: { type: Object, required: true },
    turnSpeed: { type: Number, required: true },
    turnSliderExp: { type: Number, required: true },
    selectedTurnYr: { type: Number, required: true },
    turnYrOptions: { type: Array, required: true },
  },
  data() {
    return {
      // default: OFF (unchecked)
      turnYrEnabled: false,
    };
  },
  computed: {
    safeSpeedLabel() {
      const v = Number(this.turnSpeed);
      if (!isFinite(v)) return '1.0';
      return v.toFixed(1);
    },
    speedOptions() {
      // display and the exponent value (log10)
      return [
        { display: 'x0.1', exp: -1 },
        { display: 'x0.5', exp: Math.log10(0.5) },
        { display: 'x1',   exp: 0 },
        { display: 'x2',   exp: Math.log10(2) },
        { display: 'x4',   exp: Math.log10(4) },
        { display: 'x10',  exp: 1 },
      ];
    },
    selectedSpeedIndex() {
      const e = Number(this.turnSliderExp || 0);
      if (!isFinite(e)) return 2; // default to x1
      let bestIdx = 0;
      let bestDiff = Infinity;
      this.speedOptions.forEach((opt, idx) => {
        const d = Math.abs(opt.exp - e);
        if (d < bestDiff) {
          bestDiff = d;
          bestIdx = idx;
        }
      });
      return bestIdx;
    },
    currentTurnYr() {
      const n = Number(this.selectedTurnYr);
      return isFinite(n) ? n : 0;
    },
  },
  methods: {
    // Determine era default and other helpers
    eraDefaultTurnYr() {
      try {
        const era = (this.climateTurn && this.climateTurn.era) ? this.climateTurn.era : null;
        return Number(buildEraTurnYr(era) || 0);
      } catch (e) {
        return 0;
      }
    },
    renderBtnLabel(opt) {
      const n = Number(opt);
      const def = this.eraDefaultTurnYr();
      const isDef = (n === def);
      return `${n} yr${isDef ? ' (default)' : ''}`;
    },
    isDisabledByEra(opt) {
      // For '文明時代' and '海棲文明時代', only allow 10,20,100
      const era = (this.climateTurn && this.climateTurn.era) ? this.climateTurn.era : null;
      if (era === '文明時代' || era === '海棲文明時代') {
        const allowed = [10, 20, 100];
        return !allowed.includes(Number(opt));
      }
      return false;
    },
    onToggleTurnYrEnabled(ev) {
      const enabled = !!(ev && ev.target && ev.target.checked);
      this.turnYrEnabled = enabled;
      // inform parent if it cares
      this.$emit('update-turn-yr-enabled', enabled);
    },
    onSpeedIndexInput(val) {
      const idx = Math.max(0, Math.min((this.speedOptions || []).length - 1, Number(val || 0)));
      const opt = (this.speedOptions && this.speedOptions[idx]) ? this.speedOptions[idx] : this.speedOptions[2];
      // emit exponent value so parent maps to speed
      this.$emit('update-turn-slider-exp', Number(opt.exp));
    },
    onTurnBtnClick(opt) {
      const n = Number(opt);
      if (!isFinite(n)) return;
      if (this.isDisabledByEra(opt) || !this.turnYrEnabled) return;
      this.$emit('change-turn-yr', n);
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
.speed-labels {
  display: flex;
  gap: 8px;
  margin-left: 8px;
  align-items: center;
}
.turn-buttons {
  display: flex;
  gap: 6px;
  margin-left: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.turn-btn {
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.turn-btn.active {
  background: #eef;
  border-color: #88a;
  font-weight: bold;
}
.turn-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.speed-label {
  font-size: 0.9em;
  opacity: 0.75;
  padding: 2px 4px;
}
.speed-label.active {
  font-weight: bold;
  opacity: 1;
}
.status {
  margin-top: 6px;
  color: #333;
}
.controls-break {
  flex-basis: 100%;
  height: 0;
}
</style>


