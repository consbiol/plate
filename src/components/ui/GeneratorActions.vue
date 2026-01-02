<template>
  <div>
    <div class="actions">
      <button class="action-btn" @click="$emit('generate')" :disabled="disabled">Generate (Popup + Render)</button>
      <button class="action-btn" @click="$emit('update')" :disabled="disabled">Update (中心点を保持して再生成)</button>
      <button class="action-btn" @click="$emit('revise')" :disabled="disabled">Revise 氷河・乾燥地</button>
      <button class="action-btn" @click="$emit('drift')" :disabled="disabled">Drift 大陸中心点 + ノイズ再抽選</button>
    </div>

    <div class="events">
      <div class="events-title">イベント</div>
      <div class="event-group">
        <div class="event-label">太陽活動の上昇</div>
        <div class="event-buttons">
          <button @click="adjustSol(10)">Lv1</button>
          <button @click="adjustSol(20)">Lv2</button>
          <button @click="adjustSol(40)">Lv3</button>
          <button @click="adjustSol(60)">Lv4</button>
          <button @click="adjustSol(100)">Lv5</button>
        </div>
      </div>
      <div class="event-group">
        <div class="event-label">太陽活動の下降</div>
        <div class="event-buttons">
          <button @click="adjustSol(-10)">Lv1</button>
          <button @click="adjustSol(-20)">Lv2</button>
          <button @click="adjustSol(-40)">Lv3</button>
          <button @click="adjustSol(-60)">Lv4</button>
          <button @click="adjustSol(-100)">Lv5</button>
        </div>
      </div>
      <div class="sol-display">sol_event: {{ solEvent }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GeneratorActions',
  props: {
    disabled: { type: Boolean, required: false, default: false }
  },
  computed: {
    solEvent() {
      const c = (this.$store && this.$store.state && this.$store.state.climate) ? this.$store.state.climate : null;
      return (c && c.events && typeof c.events.sol_event === 'number') ? c.events.sol_event : (c && c.events ? Number(c.events.sol_event || 0) : 0);
    }
  },
  methods: {
    adjustSol(delta) {
      this.$store.commit('adjustSolEvent', Number(delta));
    }
  }
};
</script>

<style scoped>
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 8px 12px 8px;
}
.action-btn {
  margin: 0;
}
.events {
  border: 1px solid #ccc;
  padding: 8px;
  margin: 8px;
  border-radius: 4px;
}
.events-title {
  font-weight: bold;
  margin-bottom: 6px;
}
.event-group {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}
.event-label {
  width: 140px;
}
.event-buttons > button {
  margin-right: 6px;
}
.sol-display {
  margin-top: 6px;
  font-size: 12px;
  color: #333;
}
</style>