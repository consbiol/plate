<template>
  <div class="actions">
    <button class="action-btn" @click="$emit('generate')" :disabled="disabled">Generate (Popup + Render)</button>
    <button class="action-btn" @click="$emit('update')" :disabled="disabled">Update (中心点を保持して再生成)</button>
    <button class="action-btn" @click="$emit('revise')" :disabled="disabled">Revise 氷河・乾燥地</button>
    <button class="action-btn" @click="$emit('drift')" :disabled="disabled">Drift 大陸中心点 + ノイズ再抽選</button>
  </div>
</template>

<script>
export default {
  name: 'GeneratorActions',
  props: {
    disabled: { type: Boolean, required: false, default: false }
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
</style>


