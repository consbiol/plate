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
        <div class="event-label">太陽活動 (sol_event)</div>
        <div class="sol-event-controls">
          <button class="sol-step-btn" @click="bumpSol(-10)" :disabled="disabled">-</button>
          <input
            class="sol-slider"
            type="range"
            min="-500"
            max="500"
            step="1"
            :value="solEvent"
            disabled
          />
          <button class="sol-step-btn" @click="bumpSol(10)" :disabled="disabled">+</button>
          <div class="sol-value">sol_event: {{ solEvent }}</div>
        </div>
      </div>
      <div class="event-group">
        <div class="event-label">マントル活動</div>
        <div class="sol-event-controls">
          <button class="sol-step-btn" @click="bumpVolcanoMag(-1)" :disabled="disabled || volcanoMagAtMin">-</button>
          <input
            class="sol-slider"
            type="range"
            min="0"
            max="12"
            step="1"
            :value="volcanoMagIndex"
            disabled
          />
          <button class="sol-step-btn" @click="bumpVolcanoMag(1)" :disabled="disabled || volcanoMagAtMax">+</button>
          <div class="sol-value">Volcano_event x{{ volcanoMagLabel }}</div>
        </div>
      </div>
      <div class="event-group">
        <div class="event-label">Land Ratio</div>
        <div class="sol-event-controls">
          <button class="sol-step-btn" @click="bumpLandRatio(-0.01)" :disabled="disabled || landRatioAtMin">-</button>
          <input
            class="sol-slider"
            type="range"
            min="-0.1"
            max="0.1"
            step="0.01"
            :value="landRatioDelta"
            disabled
          />
          <button class="sol-step-btn" @click="bumpLandRatio(0.01)" :disabled="disabled || landRatioAtMax">+</button>
          <div class="sol-value">Δ land_ratio: {{ landRatioDeltaLabel }}</div>
        </div>
      </div>
      <div class="event-group">
        <div class="event-label">隕石落下</div>
        <div class="event-buttons">
          <button @click="triggerMeteo(1)">Lv1</button>
          <button @click="triggerMeteo(2)">Lv2</button>
          <button @click="triggerMeteo(3)">Lv3</button>
          <button @click="triggerMeteo(4)">Lv4</button>
          <button @click="triggerMeteo(5)">Lv5</button>
        </div>
      </div>
      <div class="event-group">
        <div class="event-label">森林火災</div>
        <div class="event-buttons">
          <button @click="triggerFire(1)">Lv1</button>
          <button @click="triggerFire(2)">Lv2</button>
          <button @click="triggerFire(3)">Lv3</button>
          <button @click="triggerFire(4)">Lv4</button>
          <button @click="triggerFire(5)">Lv5</button>
        </div>
      </div>
      <div class="event-group">
        <div class="event-label">近傍超新星</div>
        <div class="event-buttons">
          <button @click="triggerCosmic()">発火 (3ターン)</button>
        </div>
      </div>
      <div class="event-group">
        <div class="event-label">ガンマ線バースト</div>
        <div class="event-buttons">
          <button @click="triggerGamma()">発火 (1ターン)</button>
        </div>
      </div>
      <div class="event-group">
        <div class="event-label">火山イベント</div>
        <div class="event-buttons">
          <button @click="triggerVolcano(1)">Lv1</button>
          <button @click="triggerVolcano(2)">Lv2</button>
          <button @click="triggerVolcano(3)">Lv3</button>
          <button @click="triggerVolcano(4)">Lv4</button>
          <button @click="triggerVolcano(5)">Lv5</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  VOLCANO_EVENT_MAG_LABELS,
  VOLCANO_EVENT_MAG_DEFAULT_INDEX,
  clampVolcanoEventMagIndex
} from '../../utils/climate/volcanoEventMagnification.js';

export default {
  name: 'GeneratorActions',
  props: {
    disabled: { type: Boolean, required: false, default: false },
    // Land Ratio (陸の割合 x): Parameters_Display.vue の local.seaLandRatio を受け取る
    landRatioX: { type: Number, required: false, default: 0.3 },
    // イベントパネルの slider は「base からの差分（±0.1）」として扱う
    landRatioBase: { type: Number, required: false, default: 0.3 },
  },
  computed: {
    solEvent() {
      const c = (this.$store && this.$store.state && this.$store.state.climate) ? this.$store.state.climate : null;
      return (c && c.events && typeof c.events.sol_event === 'number') ? c.events.sol_event : (c && c.events ? Number(c.events.sol_event || 0) : 0);
    }
    ,
    volcanoMagIndex() {
      const c = (this.$store && this.$store.state && this.$store.state.climate) ? this.$store.state.climate : null;
      const idxRaw = (c && c.events) ? c.events.Volcano_event_mag_idx : VOLCANO_EVENT_MAG_DEFAULT_INDEX;
      return clampVolcanoEventMagIndex(idxRaw);
    }
    ,
    volcanoMagLabel() {
      const i = this.volcanoMagIndex;
      return VOLCANO_EVENT_MAG_LABELS[i] || '1';
    }
    ,
    volcanoMagAtMin() {
      return this.volcanoMagIndex <= 0;
    }
    ,
    volcanoMagAtMax() {
      return this.volcanoMagIndex >= (VOLCANO_EVENT_MAG_LABELS.length - 1);
    }
    ,
    landRatioDelta() {
      const x = Number(this.landRatioX);
      const base = Number(this.landRatioBase);
      if (!isFinite(x) || !isFinite(base)) return 0;
      let d = x - base;
      // slider range: -0.10..+0.10
      d = Math.max(-0.1, Math.min(0.1, d));
      // 0.01刻みに寄せる（表示の安定化）
      d = Math.round(d * 100) / 100;
      return d;
    },
    landRatioAtMin() {
      return this.landRatioDelta <= -0.1;
    },
    landRatioAtMax() {
      return this.landRatioDelta >= 0.1;
    },
    landRatioDeltaLabel() {
      const d = Number(this.landRatioDelta) || 0;
      const sign = d > 0 ? '+' : '';
      return `${sign}${d.toFixed(2)}`;
    },
 
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
    bumpSol(delta) {
      if (!this.$store) return;
      this.$store.commit('bumpSolEvent', Number(delta));
    }
    ,
    bumpVolcanoMag(delta) {
      if (!this.$store) return;
      const d = Math.sign(Number(delta) || 0);
      if (d === 0) return;
      this.$store.commit('bumpVolcanoEventMagIndex', { delta: d });
    }
    ,
    bumpLandRatio(delta) {
      const d = Number(delta || 0);
      if (!isFinite(d) || d === 0) return;
      // 親（Parameters_Display.vue）へ通知して、陸の割合 x を更新してもらう
      this.$emit('bump-land-ratio', d);
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
    ,
    triggerVolcano(level) {
      this.$store.commit('triggerVolcanoManualLevel', { level: Number(level) });
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
.sol-event-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.sol-step-btn {
  width: 28px;
  height: 24px;
  line-height: 22px;
  padding: 0;
}
.sol-slider {
  flex: 1;
  min-width: 120px;
}
.sol-value {
  margin-left: 6px;
  font-size: 12px;
  color: #333;
  white-space: nowrap;
}
</style>