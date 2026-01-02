<template>
  <div class="actions">
    <button class="action-btn" @click="$emit('generate')">Generate (Popup + Render)</button>
    <button class="action-btn" @click="$emit('update')">Update (中心点を保持して再生成)</button>
    <button class="action-btn" @click="$emit('revise')">Revise 氷河・乾燥地</button>
    <button class="action-btn" @click="$emit('drift')">Drift 大陸中心点 + ノイズ再抽選</button>
  </div>
</template>

<script>
export default {
  name: 'GeneratorActions',
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
</style>


