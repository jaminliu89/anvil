<script setup lang="ts">
// 训练页 — MVP 占位
</script>

<template>
  <div class="view">
    <div class="page-head">
      <h1 class="page-title">训练</h1>
      <p class="page-sub">让 AI 更懂你的领域</p>
    </div>

    <div class="placeholder">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="placeholder-icon">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
      </svg>
      <h2 class="placeholder-title">训练功能即将推出</h2>
      <p class="placeholder-desc">
        上传你的文档、资料或对话记录，AI 会学习你的表达方式<br/>
        和工作习惯，变得更懂你。
      </p>
      <div class="placeholder-features">
        <div class="feature-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="feature-check"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>上传 PDF、Word、TXT</span>
        </div>
        <div class="feature-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="feature-check"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>导入对话记录</span>
        </div>
        <div class="feature-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="feature-check"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>定制回答风格</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.view {
  padding: var(--space-8) var(--space-8);
  max-width: 600px;
}

.page-head {
  margin-bottom: var(--space-8);
}

.page-title {
  font-size: var(--font-lg);
  font-weight: var(--font-semibold);
  letter-spacing: -0.01em;
}

.page-sub {
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
  margin-top: var(--space-1);
}

.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-16) var(--space-8);
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border-soft);
  border-radius: var(--radius-lg);
}

.placeholder-icon {
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-4);
}

.placeholder-title {
  font-size: var(--font-md);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-2);
}

.placeholder-desc {
  font-size: var(--font-sm);
  color: var(--color-text-tertiary);
  line-height: 1.6;
  margin-bottom: var(--space-6);
}

.placeholder-features {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  text-align: left;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-xs);
  color: var(--color-text-secondary);
}

.feature-check {
  color: var(--color-success);
  flex-shrink: 0;
}
</style>