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
        const displayWidth = this.gridWidth + 2;
        const displayHeight = this.gridHeight + 2;
        const display = new Array(displayWidth * displayHeight);
        const deepSea = 'rgb(30, 80, 140)';
        const shallowSea = 'rgb(60, 120, 180)';
        const lowland = 'rgb(34, 139, 34)';
        const desert = 'rgb(150, 130, 110)';
        const highland = 'rgb(145, 100, 75)';
        const alpine = 'rgb(95, 80, 70)';
        const tundra = 'rgb(104, 131, 56)';
        const glacier = 'rgb(255, 255, 255)';
        for (let gy = 0; gy < displayHeight; gy++) {
          for (let gx = 0; gx < displayWidth; gx++) {
            const displayIdx = gy * displayWidth + gx;
            if (gy === 0 || gy === displayHeight - 1 || gx === 0 || gx === displayWidth - 1) {
              display[displayIdx] = 'rgb(0,0,0)';
            } else {
              const originalGy = gy - 1;
              const originalGx = gx - 1;
              const idx = originalGy * this.gridWidth + originalGx;
              const cell = this.gridData[idx];
              let col = lowland;
              if (cell && cell.terrain) {
                if (cell.terrain.type === 'sea') {
                  if (cell.terrain.sea === 'shallow') col = shallowSea;
                  else if (cell.terrain.sea === 'glacier') col = glacier;
                  else col = deepSea;
                } else if (cell.terrain.type === 'land') {
                  const l = cell.terrain.land;
                  if (l === 'tundra') col = tundra;
                  else if (l === 'glacier') col = glacier;
                  else if (l === 'lake') col = shallowSea;
                  else if (l === 'highland') col = highland;
                  else if (l === 'alpine') col = alpine;
                  else if (l === 'desert') col = desert;
                  else col = lowland;
                }
              }
              display[displayIdx] = col;
            }
          }
        }
        return display;
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


