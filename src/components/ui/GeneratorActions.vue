<template>
  <div>
    <div class="actions">
      <button class="action-btn" @click="$emit('generate')" :disabled="disabled">Generate (Popup + Render)</button>
      <button class="action-btn" @click="$emit('update')" :disabled="disabled">Update (中心点を保持して再生成)</button>
      <button class="action-btn" @click="$emit('revise')" :disabled="disabled">Revise 氷河・乾燥地</button>
      <button class="action-btn" @click="$emit('drift')" :disabled="disabled">Drift 大陸中心点 + ノイズ再抽選</button>
    </div>
  <slot name="inline-views"></slot>

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
      <div class="event-group">
        <div class="event-label">隕石落下 (Meteo)</div>
        <div class="event-buttons">
          <button @click="triggerMeteo(1)">Lv1</button>
          <button @click="triggerMeteo(2)">Lv2</button>
          <button @click="triggerMeteo(3)">Lv3</button>
          <button @click="triggerMeteo(4)">Lv4</button>
          <button @click="triggerMeteo(5)">Lv5</button>
        </div>
      </div>
      <div class="event-group">
        <div class="event-label">森林火災 (Fire)</div>
        <div class="event-buttons">
          <button @click="triggerFire(1)">Lv1</button>
          <button @click="triggerFire(2)">Lv2</button>
          <button @click="triggerFire(3)">Lv3</button>
          <button @click="triggerFire(4)">Lv4</button>
          <button @click="triggerFire(5)">Lv5</button>
        </div>
      </div>
      <div class="event-group">
        <div class="event-label">近傍超新星 (Cosmic)</div>
        <div class="event-buttons">
          <button @click="triggerCosmic()">発火 (3ターン)</button>
        </div>
      </div>
      <div class="event-group">
        <div class="event-label">ガンマ線バースト (Gamma)</div>
        <div class="event-buttons">
          <button @click="triggerGamma()">発火 (1ターン)</button>
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
    ,
    meteoEff() {
      const c = (this.$store && this.$store.state && this.$store.state.climate) ? this.$store.state.climate : null;
      return (c && c.events && typeof c.events.Meteo_eff === 'number') ? c.events.Meteo_eff : 1;
    }
    ,
    fireCO2() {
      const c = (this.$store && this.$store.state && this.$store.state.climate) ? this.$store.state.climate : null;
      return (c && c.events && typeof c.events.Fire_event_CO2 === 'number') ? c.events.Fire_event_CO2 : 0;
    }
    ,
    cosmicVal() {
      const c = (this.$store && this.$store.state && this.$store.state.climate) ? this.$store.state.climate : null;
      return (c && c.events && typeof c.events.CosmicRay === 'number') ? c.events.CosmicRay : 1;
    }
  },
  methods: {
    adjustSol(delta) {
      this.$store.commit('adjustSolEvent', Number(delta));
    }
    ,
    triggerMeteo(level) {
      this.$store.commit('triggerMeteoLevel', { level: Number(level) });
    }
    ,
    triggerFire(level) {
      this.$store.commit('triggerFireLevel', { level: Number(level) });
    }
    ,
    triggerCosmic() {
      this.$store.commit('triggerCosmicEvent', {});
    }
    ,
    triggerGamma() {
      this.$store.commit('triggerGammaEvent', {});
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