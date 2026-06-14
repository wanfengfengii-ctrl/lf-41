<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useWeaveStore } from '@/stores/weave'

const store = useWeaveStore()
const scrollRef = ref<HTMLDivElement | null>(null)
const matrixRef = ref<HTMLDivElement | null>(null)

const matrix = computed(() => store.threadingMatrix)
const unthreadedSet = computed(() => new Set(store.validation.unthreadedWarps))
const floatWarningSet = computed(() => store.warpFloatWarningSet)
const unlinkedSet = computed(() => new Set(store.validation.unlinkedHarnesses))

function onCellClick(harnessIndex: number, warpIndex: number) {
  const warpId = warpIndex + 1
  const harnessId = harnessIndex + 1
  if (matrix.value[harnessIndex][warpIndex] !== 1) {
    store.setWarpHarness(warpId, harnessId)
  }
}

function cellClass(hIdx: number, wIdx: number) {
  const warpId = wIdx + 1
  const harnessId = hIdx + 1
  const isSelected = matrix.value[hIdx][wIdx] === 1
  const isUnthreaded = unthreadedSet.value.has(warpId)
  const hasFloatWarning = floatWarningSet.value.has(warpId)
  const isUnlinked = unlinkedSet.value.has(harnessId)
  const isFocused =
    (store.focusTarget.type === 'warp' && store.focusTarget.id === warpId) ||
    (store.focusTarget.type === 'harness' && store.focusTarget.id === harnessId)

  return {
    'matrix-cell--selected': isSelected,
    'matrix-cell--unthreaded': isUnthreaded && !isSelected,
    'matrix-cell--float-warning': hasFloatWarning && isSelected,
    'matrix-cell--unlinked': isUnlinked && isSelected,
    'matrix-cell--focused': isFocused,
  }
}

function colHeaderClass(warpId: number) {
  return {
    'col-header--unthreaded': unthreadedSet.value.has(warpId),
    'col-header--float-warning': floatWarningSet.value.has(warpId),
    'col-header--focused': store.focusTarget.type === 'warp' && store.focusTarget.id === warpId,
  }
}

function rowHeaderClass(harnessId: number) {
  return {
    'row-header--unlinked': unlinkedSet.value.has(harnessId),
    'row-header--focused': store.focusTarget.type === 'harness' && store.focusTarget.id === harnessId,
  }
}

watch(
  () => store.focusTarget,
  (target) => {
    if (target.type && target.id !== null) {
      nextTick(() => {
        if (scrollRef.value) {
          const cellWidth = 32
          const cellHeight = 32
          const offset = 100

          if (target.type === 'warp') {
            const scrollLeft = (target.id - 1) * cellWidth - offset
            scrollRef.value.scrollTo({
              left: Math.max(0, scrollLeft),
              behavior: 'smooth',
            })
          }

          if (target.type === 'harness') {
            const scrollTop = (target.id - 1) * cellHeight - offset
            scrollRef.value.scrollTo({
              left: 0,
              top: Math.max(0, scrollTop),
              behavior: 'smooth',
            })
          }
        }
      })
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="threading-matrix-wrapper">
    <div class="matrix-legend">
      <span class="legend-item">
        <span class="legend-swatch legend-swatch--selected" />
        <span class="legend-label">已穿线</span>
      </span>
      <span class="legend-item">
        <span class="legend-swatch legend-swatch--unthreaded" />
        <span class="legend-label">未穿线</span>
      </span>
      <span class="legend-item">
        <span class="legend-swatch legend-swatch--float" />
        <span class="legend-label">浮线过长</span>
      </span>
      <span class="legend-item">
        <span class="legend-swatch legend-swatch--unlinked" />
        <span class="legend-label">未关联踏板</span>
      </span>
    </div>
    <div class="threading-matrix-scroll" ref="scrollRef">
      <div
        class="threading-matrix"
        ref="matrixRef"
        :style="{
          gridTemplateColumns: `48px repeat(${store.warpEnds.length}, 30px)`,
          gridTemplateRows: `28px repeat(${store.harnesses.length}, 30px)`,
        }"
      >
        <div class="corner-cell"></div>
        <div
          v-for="warp in store.warpEnds"
          :key="'wh-' + warp.id"
          class="col-header"
          :class="colHeaderClass(warp.id)"
        >
          {{ warp.id }}
        </div>

        <template v-for="(harness, hIdx) in store.harnesses" :key="'row-' + harness.id">
          <div
            class="row-header"
            :class="rowHeaderClass(harness.id)"
          >
            {{ harness.label }}
          </div>
          <div
            v-for="(warp, wIdx) in store.warpEnds"
            :key="'cell-' + harness.id + '-' + warp.id"
            class="matrix-cell"
            :class="cellClass(hIdx, wIdx)"
            @click="onCellClick(hIdx, wIdx)"
          >
            <span v-if="matrix[hIdx][wIdx] === 1" class="cell-indicator" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.threading-matrix-wrapper {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #2a2a4a;
}

.matrix-legend {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid transparent;
}

.legend-swatch--selected {
  background: #e8b84b;
  border-color: #c99a30;
}

.legend-swatch--unthreaded {
  background: #3a1525;
  border-color: #5a2030;
}

.legend-swatch--float {
  background: #c0392b;
  border-color: #a03020;
}

.legend-swatch--unlinked {
  background: #5a4020;
  border-color: #7a6030;
}

.legend-label {
  font-size: 11px;
  color: #8888aa;
}

.threading-matrix-scroll {
  overflow-x: auto;
  overflow-y: hidden;
}

.threading-matrix-scroll::-webkit-scrollbar {
  height: 6px;
}

.threading-matrix-scroll::-webkit-scrollbar-track {
  background: #1a1a2e;
  border-radius: 3px;
}

.threading-matrix-scroll::-webkit-scrollbar-thumb {
  background: #3a3a5a;
  border-radius: 3px;
}

.threading-matrix-scroll::-webkit-scrollbar-thumb:hover {
  background: #4a4a6a;
}

.threading-matrix {
  display: grid;
  gap: 2px;
  width: max-content;
}

.corner-cell {
  background: #12122a;
  border-radius: 4px 0 0 0;
}

.col-header {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #8888aa;
  background: #16163a;
  border-radius: 4px 4px 0 0;
  user-select: none;
  transition: background 0.2s, color 0.2s;
}

.col-header--unthreaded {
  background: #3a1525;
  color: #e85a6a;
}

.col-header--float-warning {
  background: #3a2020;
  color: #e74c3c;
}

.col-header--focused {
  background: #4a3520 !important;
  color: #ffd700 !important;
  font-weight: 700;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  animation: pulse-focus 1.5s ease-in-out infinite;
}

.row-header {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #aaaacc;
  background: #16163a;
  border-radius: 4px 0 0 4px;
  user-select: none;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s;
}

.row-header--unlinked {
  background: #2a2518;
  color: #e67e22;
}

.row-header--focused {
  background: #4a3520 !important;
  color: #ffd700 !important;
  font-weight: 700;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
  animation: pulse-focus 1.5s ease-in-out infinite;
}

.matrix-cell {
  background: #22223a;
  border: 1px solid #2e2e4e;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.matrix-cell:hover {
  background: #2e2e52;
  border-color: #3e3e62;
}

.matrix-cell--selected {
  background: #e8b84b;
  border-color: #c99a30;
  box-shadow: 0 0 6px rgba(232, 184, 75, 0.3);
}

.matrix-cell--selected:hover {
  background: #d4a53e;
  border-color: #b8892a;
}

.matrix-cell--unthreaded {
  border-color: #5a2030;
}

.matrix-cell--unthreaded:hover {
  border-color: #7a3040;
}

.matrix-cell--float-warning {
  background: #c0392b;
  border-color: #a03020;
  box-shadow: 0 0 8px rgba(192, 57, 43, 0.5);
  animation: pulse-warning 2s ease-in-out infinite;
}

.matrix-cell--float-warning:hover {
  background: #d44637;
  border-color: #b03828;
}

.matrix-cell--unlinked {
  background: #b8860b;
  border-color: #8a6508;
  box-shadow: 0 0 6px rgba(230, 126, 34, 0.3);
}

.matrix-cell--unlinked:hover {
  background: #c99a1e;
  border-color: #9a750a;
}

.matrix-cell--focused {
  border-color: #ffd700 !important;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.6) !important;
  animation: pulse-focus 1.5s ease-in-out infinite;
}

.cell-indicator {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: rgba(15, 15, 26, 0.6);
}

@keyframes pulse-warning {
  0%, 100% {
    box-shadow: 0 0 8px rgba(192, 57, 43, 0.5);
  }
  50% {
    box-shadow: 0 0 14px rgba(192, 57, 43, 0.8);
  }
}

@keyframes pulse-focus {
  0%, 100% {
    box-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
  }
  50% {
    box-shadow: 0 0 18px rgba(255, 215, 0, 0.8);
  }
}
</style>
