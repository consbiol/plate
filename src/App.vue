<template>
  <div id="app">
    <Parameters_Display :gridWidth="gridWidth" :gridHeight="gridHeight" @generated="onGenerated" />
  </div>
</template>

<script>
import Parameters_Display from './components/Parameters_Display.vue'

/**
 * Payload emitted by `Parameters_Display`'s `generated` event.
 * The payload follows the unified TerrainEventPayload shape (plus grid size for convenience).
 *
 * @typedef {import('./types/index.js').TerrainEventPayload} TerrainEventPayload
 * @typedef {TerrainEventPayload & {gridWidth?: number, gridHeight?: number}} GeneratedEventPayload
 */

export default {
  name: 'App',
  components: {
    Parameters_Display
  },
  data() {
    return {
      gridWidth: 200,
      gridHeight: 100,
    gridData: []
    };
  },
  methods: {
    /** @param {GeneratedEventPayload} payload */
    onGenerated(payload) {
      // gridData を優先して受け取り、width/height が提供されていれば適用
      if (payload && Array.isArray(payload.gridData)) {
        this.gridData = payload.gridData;
        if (typeof payload.gridWidth === 'number') this.gridWidth = payload.gridWidth;
        if (typeof payload.gridHeight === 'number') this.gridHeight = payload.gridHeight;
      }
    }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 20px;
}
</style>
