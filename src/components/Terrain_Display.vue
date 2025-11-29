<template>
  <div class="grid" :style="gridStyle">
    <div
      v-for="(color, idx) in displayColors"
      :key="idx"
      class="cell"
      :style="{ backgroundColor: color }"
    />
  </div>
</template>

<script>
import { deriveDisplayColorsFromGridData } from '../utils/colors.js'
// このコンポーネントは「描画専用」です。
// - 親から受け取ったgridDataを、gridWidth/gridHeightに合わせてグリッド表示します。
// - 余白の黒枠は配列側で付与済み（上下左右+1）。ここでは純粋に描画のみを行います。
export default {
  name: 'Terrain_Display',
  props: {
    gridWidth: { type: Number, required: true },
    gridHeight: { type: Number, required: true },
    gridData: { type: Array, required: false, default: () => [] }
  },
  computed: {
    displayColors() {
      // if gridData provided, derive displayColors (with +2 border)
      if (this.gridData && this.gridData.length === this.gridWidth * this.gridHeight) {
        return deriveDisplayColorsFromGridData(this.gridData, this.gridWidth, this.gridHeight);
      } 
      // gridData not provided: render a full black grid placeholder
      const displayWidth = this.gridWidth + 2;
      const displayHeight = this.gridHeight + 2;
      const placeholder = new Array(displayWidth * displayHeight);
      for (let i = 0; i < placeholder.length; i++) placeholder[i] = 'rgb(0,0,0)';
      return placeholder;
    },
    gridStyle() {
      const displayGridWidth = this.gridWidth + 2;
      return {
        display: 'grid',
        gridTemplateColumns: `repeat(${displayGridWidth}, 6px)`,
        gridAutoRows: '6px'
      };
    }
  }
}
</script>

<style scoped>
.grid { display: grid; }
.cell { width: 6px; height: 6px; }
</style>


