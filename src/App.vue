<template>
  <div id="app">
    <Parameters_Display :gridWidth="gridWidth" :gridHeight="gridHeight" @generated="onGenerated" />
    <div style="height: 16px;"></div>
    <Terrain_Display :gridWidth="gridWidth" :gridHeight="gridHeight" :gridData="gridData" />
  </div>
</template>

<script>
import Parameters_Display from './components/Parameters_Display.vue'
import Terrain_Display from './components/Terrain_Display.vue'

export default {
  name: 'App',
  components: {
    Parameters_Display,
    Terrain_Display
  },
  data() {
    return {
      gridWidth: 200,
      gridHeight: 100,
    gridData: []
    };
  },
  methods: {
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
