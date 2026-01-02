<template>
  <div v-if="stats" class="stats">
    <div v-if="stats.lowlandDistanceToSea" class="block">
      <div class="title">低地グリッドの海まで距離（BFS距離）:</div>
      <div class="row"><span class="label">平均:</span><span>{{ stats.lowlandDistanceToSea.avg.toFixed(2) }}</span></div>
      <div class="row"><span class="label">最小:</span><span>{{ stats.lowlandDistanceToSea.min.toFixed(2) }}</span></div>
      <div class="row"><span class="label">最大:</span><span>{{ stats.lowlandDistanceToSea.max.toFixed(2) }}</span></div>
      <div class="row"><span class="label">低地グリッド数:</span><span>{{ stats.lowlandDistanceToSea.count }}</span></div>
    </div>

    <div v-if="stats.driftMetrics" class="block">
      <div class="title">Drift metrics:</div>
      <div class="row"><span class="label">phase:</span><span>{{ stats.driftMetrics.phase }}</span></div>
      <div class="row"><span class="label">avgDist:</span><span>{{ formatNum(stats.driftMetrics.avgDist) }}</span></div>
      <div class="row"><span class="label">superPloom:</span><span>{{ formatNum(stats.driftMetrics.superPloom) }}</span></div>
      <div class="row"><span class="label">superPloom_calc:</span><span>{{ formatNum(stats.driftMetrics.superPloom_calc) }}</span></div>
    </div>
  </div>
</template>

<script>
/**
 * @typedef {import('../../types/index.js').ParametersStats} ParametersStats
 */
export default {
  name: 'StatsPanel',
  props: {
    // 想定構造: `ParametersStats` (see `src/types/index.js`)
    stats: { type: Object, required: true },
  },
  methods: {
    formatNum(v) {
      const n = Number(v);
      if (!isFinite(n)) return String(v ?? '');
      return n.toFixed(2);
    },
  },
};
</script>

<style scoped>
.stats {
  margin-top: 16px;
  text-align: left;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}
.block {
  margin-top: 12px;
}
.title {
  font-weight: bold;
  margin-bottom: 6px;
}
.row {
  display: flex;
  gap: 8px;
}
.label {
  min-width: 160px;
}
</style>


