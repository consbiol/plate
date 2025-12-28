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
  // props を廃止し store に完全依存する（gridData / gridWidth / gridHeight / era は store 側で提供）
  computed: {
    gridWidth() {
      return this.$store?.getters?.gridWidth ?? 200;
    },
    gridHeight() {
      return this.$store?.getters?.gridHeight ?? 100;
    },
    gridData() {
      return this.$store?.getters?.gridData ?? [];
    },
    // planeColors: もし将来 store に入れるならここで参照する。現状は未使用。
    planeColors() {
      return null;
    },
    era() {
      return this.$store?.getters?.era ?? null;
    },
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
      // If gridData exists in store, derive display colors from it.
      if (this.gridData && this.gridData.length === width * height) {
        const era = this.era;
        const eraColors = getEraTerrainColors(era);
        return deriveDisplayColorsFromGridData(this.gridData, width, height, undefined, eraColors, /*preferPalette*/ true);
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


