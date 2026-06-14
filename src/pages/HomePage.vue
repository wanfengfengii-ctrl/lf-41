<script setup lang="ts">
import ConfigPanel from '@/components/ConfigPanel.vue'
import TreadleConfig from '@/components/TreadleConfig.vue'
import ThreadingMatrix from '@/components/ThreadingMatrix.vue'
import WeavePreview from '@/components/WeavePreview.vue'
import StatsPanel from '@/components/StatsPanel.vue'
import ImportExport from '@/components/ImportExport.vue'
import ScoreCenter from '@/components/ScoreCenter.vue'
</script>

<template>
  <div class="workbench">
    <header class="workbench-header">
      <div class="header-brand">
        <span class="brand-icon">⬡</span>
        <h1 class="brand-title">织工穿线设计</h1>
        <span class="brand-subtitle">Weave Draft Designer</span>
      </div>
    </header>

    <main class="workbench-body">
      <aside class="sidebar-left">
        <ConfigPanel />
        <TreadleConfig />
        <ImportExport />
      </aside>

      <section class="main-content">
        <div class="section-label">穿线矩阵</div>
        <ThreadingMatrix />
      </section>

      <aside class="sidebar-right">
        <ScoreCenter />
        <WeavePreview />
        <StatsPanel />
      </aside>
    </main>
  </div>
</template>

<style scoped>
.workbench {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-deep);
}

.workbench-header {
  padding: 10px 24px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  display: flex;
  align-items: center;
}

.header-brand {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.brand-icon {
  font-size: 22px;
  color: var(--color-accent-gold);
  line-height: 1;
}

.brand-title {
  margin: 0;
  font-family: 'Noto Serif SC', serif;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: 2px;
}

.brand-subtitle {
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 400;
  letter-spacing: 1px;
}

.workbench-body {
  flex: 1;
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  gap: 0;
  overflow: hidden;
}

.sidebar-left {
  padding: 12px;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  max-height: calc(100vh - 48px);
}

.main-content {
  padding: 16px;
  background: var(--color-bg-deep);
  display: flex;
  flex-direction: column;
  overflow: auto;
  max-height: calc(100vh - 48px);
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
}

.sidebar-right {
  padding: 12px;
  border-left: 1px solid var(--color-border);
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  max-height: calc(100vh - 48px);
}

@media (max-width: 1280px) {
  .workbench-body {
    grid-template-columns: 260px 1fr;
  }
  .sidebar-right {
    grid-column: 1 / -1;
    flex-direction: row;
    flex-wrap: wrap;
    max-height: none;
    border-left: none;
    border-top: 1px solid var(--color-border);
  }
  .sidebar-right > * {
    flex: 1 1 300px;
    min-width: 280px;
  }
}

@media (max-width: 768px) {
  .workbench-body {
    grid-template-columns: 1fr;
  }
  .sidebar-left,
  .sidebar-right {
    max-height: none;
    border-right: none;
    border-left: none;
  }
  .sidebar-left {
    border-bottom: 1px solid var(--color-border);
  }
  .brand-subtitle {
    display: none;
  }
}
</style>
