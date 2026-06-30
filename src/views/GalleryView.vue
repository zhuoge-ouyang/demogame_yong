<script setup lang="ts">
import { ref } from 'vue'
import { NModal } from 'naive-ui'
import EpicBanner from '@/components/shared/EpicBanner.vue'

interface ImageItem {
  src: string
  name: string
  category: string
}

const images: ImageItem[] = [
  { src: '/images/世界观01.png', name: '三界全景', category: '世界观' },
  { src: '/images/世界观02.png', name: '九大陆俯瞰图', category: '世界观' },
  { src: '/images/世界观03.png', name: '大陆区域划分', category: '世界观' },
  { src: '/images/世界观04.png', name: '区域细节地图', category: '世界观' },
  { src: '/images/探索界面.png', name: '探索界面设计', category: 'UI设计' },
  { src: '/images/探索玩法.jpg', name: '探索玩法', category: 'UI设计' },
  { src: '/images/玩法主界面.png', name: '玩法主界面', category: 'UI设计' },
  { src: '/images/深渊玩法.png', name: '深渊玩法', category: 'UI设计' },
  { src: '/images/金英雄.png', name: '金元素英雄', category: '角色设计' },
  { src: '/images/冰英雄.png', name: '冰元素英雄', category: '角色设计' }
]

const previewSrc = ref('')
const showPreview = ref(false)

function openPreview(src: string) {
  previewSrc.value = src
  showPreview.value = true
}
</script>

<template>
  <div class="gallery-page">
    <EpicBanner
      kicker="ARCHIVE · ATELIER"
      title="素材资源库"
      subtitle="概念图·角色·UI 原型 — 文明的画案之室"
      image="/images/banners/gallery.png"
      seal-char="✦"
      accent="moonlight"
      height="short"
    />
    <div class="content-section gallery-section">
    <h2>素材资源库</h2>
    <p class="section-desc">项目相关的概念图、角色设计和界面原型等参考素材。点击图片可查看大图。</p>

    <div class="gallery-grid">
      <button
        v-for="img in images"
        :key="img.src"
        class="gallery-card"
        @click="openPreview(img.src)"
      >
        <div class="card-image-wrapper">
          <img :src="img.src" :alt="img.name" loading="lazy" />
        </div>
        <div class="card-footer">
          <span class="card-name">{{ img.name }}</span>
          <span class="card-category">{{ img.category }}</span>
        </div>
      </button>
    </div>

    <NModal v-model:show="showPreview" preset="card" style="max-width:90vw;max-height:90vh;width:auto;" :title="undefined">
      <img
        :src="previewSrc"
        alt="预览"
        style="max-width:100%;max-height:80vh;display:block;margin:0 auto;object-fit:contain;"
      />
    </NModal>
  </div>
  </div>
</template>

<style scoped>
.gallery-page {
  height: calc(100vh - var(--header-height) - var(--tab-height));
  overflow-y: auto;
  width: 100%;
}

/* 覆盖全局 max-width，充分利用面板宽度 */
.gallery-section {
  max-width: 100%;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.gallery-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg-card);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  padding: 0;
  transition: all 0.3s;
}

.gallery-card:hover {
  border-color: var(--color-accent-gold-dark);
  box-shadow: 0 0 12px var(--color-glow-gold);
  transform: translateY(-2px);
}

.card-image-wrapper {
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--color-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}

.gallery-card:hover .card-image-wrapper img {
  transform: scale(1.03);
}

.card-footer {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.card-category {
  font-size: 13px;
  padding: 1px 8px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  border-radius: 8px;
}
</style>
