<template>
  <div class="grid" :style="gridStyle">
    <div
      v-for="(color, idx) in displayColors"
      :key="idx"
      class="cell"
      :style="{ backgroundColor: color, width: (cellSizePx + 'px'), height: (cellSizePx + 'px') }"
    />
  </div>
</template>

<script>
import { deriveDisplayColorsFromGridData } from '../utils/colors.js'
import { getEraTerrainColors } from '../utils/colors.js'
// このコンポーネントは「描画専用」です。
// - 親から受け取ったgridDataを、gridWidth/gridHeightに合わせてグリッド表示します。
// - 余白の黒枠は配列側で付与済み（上下左右+1）。ここでは純粋に描画のみを行います。
export default {
  name: 'Terrain_Display',
  props: {
    gridWidth: { type: Number, required: true },
    gridHeight: { type: Number, required: true },
    gridData: { type: Array, required: false, default: () => [] },
    // 平面色を直接受け取る場合（枠なし N=width*height）。優先して使用
    planeColors: { type: Array, required: false, default: () => [] },
    // 時代（未指定時はstoreから取得を試行）
    era: { type: String, required: false, default: null }
  },
  computed: {
    cellSizePx() {
      const v = (typeof this.$store?.getters?.planeGridCellPx === 'number')
        ? this.$store.getters.planeGridCellPx
        : 3;
      const iv = Math.round(Number(v));
      if (!isFinite(iv)) return 3;
      if (iv < 1) return 1;
      if (iv > 10) return 10;
      return iv;
    },
    displayColors() {
      const width = this.gridWidth;
      const height = this.gridHeight;
      const displayWidth = width + 2;
      const displayHeight = height + 2;
      // 1) planeColors が与えられていればそれを優先（+2枠を付けて返す）
      if (this.planeColors && this.planeColors.length === width * height) {
        const out = new Array(displayWidth * displayHeight);
        const border = '#000000';
        for (let gy = 0; gy < displayHeight; gy++) {
          for (let gx = 0; gx < displayWidth; gx++) {
            const di = gy * displayWidth + gx;
            if (gy === 0 || gy === displayHeight - 1 || gx === 0 || gx === displayWidth - 1) {
              out[di] = border;
            } else {
              const y = gy - 1;
              const x = gx - 1;
              const si = y * width + x;
              out[di] = this.planeColors[si] || border;
            }
          }
        }
        return out;
      }
      // 2) gridData があれば、時代色を優先して導出（colorHexは無視）
      if (this.gridData && this.gridData.length === this.gridWidth * this.gridHeight) {
        const era = this.era || (this.$store?.getters?.era ?? null);
        const eraColors = getEraTerrainColors(era);
        return deriveDisplayColorsFromGridData(this.gridData, this.gridWidth, this.gridHeight, undefined, eraColors, /*preferPalette*/ true);
      } 
      // gridData not provided: render a full black grid placeholder
      const placeholder = new Array(displayWidth * displayHeight);
      for (let i = 0; i < placeholder.length; i++) placeholder[i] = 'rgb(0,0,0)';
      return placeholder;
    },
    gridStyle() {
      const displayGridWidth = this.gridWidth + 2;
      return {
        display: 'grid',
        gridTemplateColumns: `repeat(${displayGridWidth}, ${this.cellSizePx}px)`,
        gridAutoRows: `${this.cellSizePx}px`
      };
    }
  }
}
</script>

<style scoped>
.grid { display: grid; }
</style>


