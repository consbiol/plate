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
        <select
          :value="selectedTurnYr"
          @change="$emit('change-turn-yr', toNumber($event && $event.target ? $event.target.value : selectedTurnYr))"
        >
          <option v-for="v in turnYrOptions" :key="v" :value="v">{{ v }} yr</option>
        </select>
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
  },
  methods: {
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


