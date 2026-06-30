# Writing Plan · 城堡与女神 两步式 Prompt 改造

> **对应 Spec**：`城堡与女神设定-两步式Prompt改造-writing-spec.md`
> **创建日期**：2026-05-10
> **预估总工时**：2.5-3.5 小时（净编码）
> **实施风格**：小步提交、每任务可独立回滚

---

## Goal

将「城堡与女神设定」模块从单次 Prompt 生成 10 字段的模式，改造为**真两步 AI 调用**的生成流程：Step 1 生成设定纲要（锚定上游已定稿设定，不落库） → Step 2 基于纲要扩展为 10 个正式字段（写入 `world.json`）。同步修订 `world.json` 的 `castle.description` / `goddess.appearance` 两字段以消除设定漂移。

## Architecture Overview

**复用项目已有机制（无需新建底层设施）：**

- `AIPanel.vue` 已支持 `:extra-context` prop 做宏占位符注入（如 `OVERVIEW_CONTEXT`、`PREVIOUS_CHAPTERS_CONTEXT`），新增 `OUTLINE_CONTEXT` 宏即可
- `MainStoryline.vue` 已有完整的 `generationScope` ref + `currentModuleId` computed + `extraContext` computed 模式，直接作为 `CastleGoddess.vue` 改造的范式
- `src/services/prompts/index.ts` 已有"未替换占位符兜底清理"逻辑（802-804 行），只需追加 `OUTLINE_CONTEXT` 一行
- Parser 逻辑（`sectionToField` 映射）在 `CastleGoddess.vue` 的 `handleAIAccept` 函数内，Step 2 沿用即可，无需改独立 parser

**文件改动清单（5 个文件 vs Spec 原预估 8 个）：**

| # | 文件 | 改动 |
|---|---|---|
| F1 | `src/services/prompts/phase1-prompts.ts` | 新增 `castle-goddess-outline` + `castle-goddess-detail` 两个模板；旧 `castle-goddess` 标 `@deprecated` |
| F2 | `src/services/prompts/index.ts` | 追加 `OUTLINE_CONTEXT` 未替换兜底清理 |
| F3 | `src/services/prompts/module-categories.ts` | `PHASE1_CATEGORY_MAP` 注册两个新 moduleId |
| F4 | `src/components/phase1/CastleGoddess.vue` | Step 切换器 + 纲要卡片 + localStorage + `handleAIAccept` 分流 |
| F5 | `data/world.json` | 修订 `castle.description` 与 `goddess.appearance` 两字段 |

Spec 中原列的 F3 aiService / F4 aiStore / F5 useOutlineStorage / F7 castleGoddess-parser / F8 constants 均**不需要改动**。

## Tech Stack

Vue 3 + TypeScript + Pinia、`AIPanel` 模块化 Prompt 系统、`worldStore` 数据契约、`CollabTextField` 协作字段。

---

## Task 1 — 新增两个 Prompt 模板并标注旧模板

**目标**：在 `phase1-prompts.ts` 中落地 `castle-goddess-outline` 和 `castle-goddess-detail`，并把旧 `castle-goddess` 标注 `@deprecated`。

### 1.1 定位插入位置
- 打开 `src/services/prompts/phase1-prompts.ts`
- 定位到现有 `castle-goddess` 模板段（约 707-766 行），新模板插入在**旧模板之前**（符合阅读顺序：outline → detail → deprecated old）

### 1.2 新增 `castle-goddess-outline` 模板
- `id: 'castle-goddess-outline'`
- `label: '城堡与女神-设定纲要'`
- `contextDependencies`: `['realm-overview', 'realm-upper', 'realm-mortal', 'player-identity', 'hero-system']`
- `contextMaxChars: 1000`
- `userPromptTemplate`: 使用 Spec **附录 A.1** 完整文本
- `outputFormatInstructions`: 使用 Spec §3.1 的 outputFormatInstructions 文本（纲要格式）
- 不包含 `OUTLINE_CONTEXT` 占位符（outline 无需读入自己）

### 1.3 新增 `castle-goddess-detail` 模板
- `id: 'castle-goddess-detail'`
- `label: '城堡与女神-完整详述'`
- `contextDependencies`: 同 outline
- `contextMaxChars: 1500`
- `userPromptTemplate`: 使用 Spec **附录 A.2** 完整文本
  - ⚠️ **占位符对齐项目规范**：Spec 附录 A.2 中的 `{{outline}}` 需改为裸宏 `OUTLINE_CONTEXT`（与 `OVERVIEW_CONTEXT` 同风格），具体位置：
    - 替换 `## 上一步产出的纲要（必须严格遵守，不得偏离）\n\n{{outline}}` 中的 `{{outline}}` → `OUTLINE_CONTEXT`
- `outputFormatInstructions`: 使用 Spec §3.2 的【标记】格式文本（兼容现有 parser）

### 1.4 标注旧模板
- 在旧 `castle-goddess` 模板对象上方添加 JSDoc：
  ```ts
  /**
   * @deprecated 2026-05-10 起改用两步式 `castle-goddess-outline` + `castle-goddess-detail`。
   * 保留此模板以兼容历史会话；新功能请勿再引用此 moduleId。
   */
  ```
- **不要删除**旧模板（避免历史会话失效，对应 Spec RK5）

### 1.5 验证
- 运行 `npm run type-check`（或 `vue-tsc --noEmit`），确保无 TS 报错
- 运行 `npm run dev` 打开首页，CastleGoddess 页面在本任务未改前应能正常打开

### 1.6 Commit
- 信息：`feat(prompts): add castle-goddess outline/detail two-step templates`

---

## Task 2 — 注册 `OUTLINE_CONTEXT` 未替换兜底

**目标**：避免 `castle-goddess-outline` 流程调用时（未传 extraContext），详述模板中残留 `OUTLINE_CONTEXT` 原始文本污染 Prompt。

### 2.1 定位
- 打开 `src/services/prompts/index.ts`
- 定位到 802-806 行附近的未替换占位符清理区块：
  ```ts
  user = user.replace(/OVERVIEW_CONTEXT/g, '')
  user = user.replace(/PREVIOUS_CHAPTERS_CONTEXT/g, '')
  user = user.replace(/HERO_CURRENT_DATA/g, '')
  user = user.replace(/CLIENT_OPINIONS/g, '')
  ```

### 2.2 追加一行
- 在该区块内追加：
  ```ts
  user = user.replace(/OUTLINE_CONTEXT/g, '')
  ```
- 位置建议放在 `OVERVIEW_CONTEXT` 下一行（同为"上游产物注入类"宏）

### 2.3 验证
- `npm run type-check` 通过
- 此步骤本身无运行时副作用，编译通过即可

### 2.4 Commit
- 信息：`feat(prompts): register OUTLINE_CONTEXT macro fallback cleanup`

---

## Task 3 — 在 `module-categories.ts` 注册两个新 moduleId

**目标**：让 `getModuleCategory()` 对新 moduleId 返回正确的 `'character'` 类别，保证 systemPrompt 分层注入与上下文摘要行为正确。

### 3.1 定位
- 打开 `src/services/prompts/module-categories.ts`
- 定位到 `PHASE1_CATEGORY_MAP`（约 130-141 行）

### 3.2 追加两个键值
- 在 `'castle-goddess': 'character'` 下方紧邻追加：
  ```ts
  'castle-goddess-outline': 'character',   // 新增：两步式 Step 1
  'castle-goddess-detail': 'character',    // 新增：两步式 Step 2
  ```

### 3.3 验证
- `npm run type-check` 通过
- 可选：在 Vue devtools / 控制台快速验证 `getModuleCategory('castle-goddess-outline') === 'character'`

### 3.4 Commit
- 信息：`feat(prompts): register two-step castle-goddess module categories`

---

## Task 4 — 改造 `CastleGoddess.vue`（核心任务）

**目标**：加入 Step 切换器、纲要卡片、localStorage 持久化、`handleAIAccept` 按 moduleId 分流。以 `MainStoryline.vue` 为直接参照。

### 4.1 引入 `generationScope` 与 `currentModuleId`

在 `<script setup>` 顶部（靠近现有 imports / ref 定义处）添加：

```ts
// === 两步式生成范围 ===
type GenerationScope = 'outline' | 'detail'
const generationScope = ref<GenerationScope>('outline')

const currentModuleId = computed(() => (
  generationScope.value === 'outline'
    ? 'castle-goddess-outline'
    : 'castle-goddess-detail'
))
```

### 4.2 引入纲要 state + localStorage

```ts
const OUTLINE_STORAGE_KEY = 'castleGoddessOutline'

interface OutlineState {
  text: string
  generatedAt: number
  confirmed: boolean
}

const outline = ref<OutlineState>({ text: '', generatedAt: 0, confirmed: false })

// 初次挂载时恢复
const restored = localStorage.getItem(OUTLINE_STORAGE_KEY)
if (restored) {
  try { outline.value = JSON.parse(restored) } catch { /* ignore */ }
}

function persistOutline() {
  localStorage.setItem(OUTLINE_STORAGE_KEY, JSON.stringify(outline.value))
}

function confirmOutline() {
  outline.value.confirmed = true
  persistOutline()
}

function clearOutline() {
  outline.value = { text: '', generatedAt: 0, confirmed: false }
  localStorage.removeItem(OUTLINE_STORAGE_KEY)
  generationScope.value = 'outline'
}
```

### 4.3 引入 `extraContext` computed（仅 detail 需要）

```ts
const extraContext = computed(() => {
  const ctx: Record<string, string> = {}
  if (generationScope.value === 'detail' && outline.value.text) {
    ctx['OUTLINE_CONTEXT'] = outline.value.text
  }
  return ctx
})
```

### 4.4 改造 `handleAIAccept` —— 按 moduleId 分流

现有函数签名保留，按 `currentModuleId.value` 分流处理：

```ts
async function handleAIAccept(content: string) {
  if (currentModuleId.value === 'castle-goddess-outline') {
    // outline 分支：不触碰 world.json，只写入 outline state
    outline.value = {
      text: content,
      generatedAt: Date.now(),
      confirmed: false  // 需用户显式点"确认"
    }
    persistOutline()
    return
  }
  // detail 分支：沿用现有 sectionToField 解析 + 写入 world.json 逻辑
  // （保留原有 parseSections / sectionToField / forEach 写字段的代码不动）
  ...
}
```

> **实施细节**：只在函数体最顶部加入 outline 分支的 early-return，**原有 detail 解析代码不改**，确保 Step 2 的 parser 行为零回归。

### 4.5 添加 Step 切换器 UI

参照 `MainStoryline.vue` 的 `.generation-scope-selector` 样式，在 `<template>` 中 `<AIPanel>` 之前插入：

```html
<div class="generation-scope-selector">
  <button
    v-for="item in scopeOptions"
    :key="item.value"
    :class="['scope-btn', { active: generationScope === item.value }]"
    :disabled="item.value === 'detail' && !outline.confirmed"
    :title="item.value === 'detail' && !outline.confirmed ? '请先完成并确认 Step 1 的设定纲要' : ''"
    @click="generationScope = item.value"
  >
    {{ item.label }}
  </button>
</div>
```

对应的 `scopeOptions`：

```ts
const scopeOptions = [
  { value: 'outline' as const, label: 'Step 1 · 设定纲要' },
  { value: 'detail'  as const, label: 'Step 2 · 完整详述' }
]
```

### 4.6 添加纲要预览/编辑卡片 UI

在 Step 切换器之下、`<AIPanel>` 之上插入（`v-if="outline.text"` 保证无纲要时不显示）：

```html
<div v-if="outline.text" class="outline-card" :class="{ confirmed: outline.confirmed }">
  <div class="outline-card-header">
    <span class="outline-label">设定纲要</span>
    <span class="outline-status">{{ outline.confirmed ? '✓ 已确认' : '草稿' }}</span>
  </div>
  <textarea
    v-model="outline.text"
    class="outline-textarea"
    :maxlength="5000"
    :readonly="outline.confirmed"
    @blur="persistOutline"
  />
  <div class="outline-card-actions">
    <button v-if="!outline.confirmed" class="btn-primary" @click="confirmOutline">确认作为 Step 2 输入</button>
    <button v-if="outline.confirmed" class="btn-secondary" @click="outline.confirmed = false; persistOutline()">解锁编辑</button>
    <button class="btn-danger" @click="clearOutline">清空纲要并重新开始</button>
  </div>
</div>
```

### 4.7 更新 `<AIPanel>` 绑定

将现有 `<AIPanel :module-id="'castle-goddess'" ... />` 改为：

```html
<AIPanel
  :module-id="currentModuleId"
  :extra-context="extraContext"
  :context-labels="['三界结构', '玩家身份', '英雄系统']"
  @accept="handleAIAccept"
  ... 其他原有绑定保持不变
/>
```

### 4.8 添加 CSS

在 `<style scoped>` 末尾追加（直接参考 `MainStoryline.vue` 的 `.generation-scope-selector` / `.scope-btn` 样式，加上本组件特有的 `.outline-card`）。关键类：
- `.generation-scope-selector` — flex 容器
- `.scope-btn` / `.scope-btn.active` / `.scope-btn:disabled`
- `.outline-card` / `.outline-card.confirmed`（确认后加绿色边框）
- `.outline-textarea`（min-height: 200px; font-family 用 code 字体以利于审阅短句条目）

### 4.9 验证
- `npm run type-check` 通过
- `npm run dev`，进入城堡与女神页面：
  - ✅ 顶部看到两个 Tab：`Step 1 · 设定纲要`（默认选中）、`Step 2 · 完整详述`（disabled）
  - ✅ 切到 Step 1，点 AI 生成，纲要显示在卡片中（draft 状态）
  - ✅ 点"确认作为 Step 2 输入" → Step 2 Tab 可点击
  - ✅ 切到 Step 2 → AI 生成 → 10 字段填入表单
  - ✅ 刷新页面，纲要仍在（localStorage 恢复）
  - ✅ 点"清空纲要并重新开始" → 回到初始态

### 4.10 Commit
- 信息：`feat(castle-goddess): implement two-step outline/detail UI with localStorage`

---

## Task 5 — 修订 `world.json` 两字段

**目标**：消除 `castle.description` 中的"圣心城废墟"错位；补充 `goddess.appearance` 的光翼核心视觉符号与常驻语义。

### 5.1 前置：停止前端服务
- 停止 `npm run dev` 及 `server.cjs`（若运行中）
- 理由：防止前端自动保存覆盖手动编辑（历史教训）

### 5.2 修订 `castleGoddess.castle.description`

- 打开 `data/world.json`，搜索 `"castleGoddess"` 定位节点
- 替换 `castle.description` 文本为：

> 方舟堡并非人类建造的要塞，而是世界树意志在凡界生成的活体建筑——它初生于翠森大陆深处的根核节点，依托世界树地下根脉网络而存在。根脉是它的血管、魂能是它的血液，表面覆盖着树皮般的纹理与石化苔藓；塔身随玩家心绪轻微起伏，仿佛在缓慢呼吸。它的底层是根核所在——那里寄宿着玩家（世界树种子的灵魂），因此方舟堡不是玩家居住的基地，而是玩家在凡界的"身体"本身。当方舟堡沿根脉在九大陆之间迁移，它每一次在新大陆扎根，都要重新适应当地的元素环境、重新生成与之共鸣的防御结构。

- **确保**：删除任何"圣心城""圣心城废墟""祈光塔"等词（全字段搜索确认）

### 5.3 修订 `castleGoddess.goddess.appearance`

- 替换为：

> 她以半透明的光影形态常驻于方舟堡最高塔楼的顶端，如一尊永不离位的守护神像——舒展的光翼从她肩后绽开，金色羽翎与柔光交织，身姿挺立面朝远方。她的轮廓优雅而略显模糊，如同阳光穿过薄雾后留下的温暖残影；长发如流动的星光，面容在美丽与哀愁之间徘徊。当她神力衰弱时，光翼会收敛黯淡、身影变得更加沉静，但从不消失——她始终在城堡上方守望。

- **确保**：必含关键词"光翼""羽翎""塔楼顶端"；**不含**"越透明""隐没""消失"等可被误读的词

### 5.4 保留 `finalized` 状态
- 若修订前该两字段 `finalized.castle.description === true`：**保留不动**（直接覆盖文本即可，不清除 finalized 标志）
- 若 JSON 中存在独立的 `finalized` 对象，仅修改 text 字段本身

### 5.5 JSON 格式验证
- 用 VSCode / 任意 JSON validator 打开文件，确认无语法错误（逗号、引号、转义）
- 中文段落内的换行必须用 `\n`（若原字段含换行），一般单段直接作为一整串字符串

### 5.6 重启服务并自检
- `npm run dev`
- 进入城堡与女神页面，确认：
  - ✅ `castle.description` 展示新文本，不含"圣心城"
  - ✅ `goddess.appearance` 展示新文本，含"光翼""塔楼顶端"
  - ✅ 定稿状态（🔒 图标）与修订前一致

### 5.7 Commit
- 信息：`fix(world): revise castle.description & goddess.appearance per spec`

---

## Task 6 — 内容验收（3 次生成测试）

**目标**：用真实 AI 调用验证 Prompt 稳定性（对应 Spec §7.2 验收清单）。

### 6.1 测试场景准备
- 确保 `data/world.json` 中上游依赖模块（realm-overview、realm-upper、realm-mortal、player-identity、hero-system）已 finalized，内容为最新版
- 清空 localStorage 中 `castleGoddessOutline`

### 6.2 执行 3 轮生成（每轮独立检查）

每轮流程：
1. 点 Step 1 AI 生成 → 记录纲要
2. 确认纲要 → Step 2 AI 生成 → 记录 10 字段
3. 逐项勾选 Spec §7.2 清单：
   - [ ] 城堡名唯一为"方舟堡"
   - [ ] 不出现"圣心城""第十魂令""魂令化身"等禁用词
   - [ ] 方舟堡 = 活体建筑 / 玩家身体 / 世界树意志生成
   - [ ] 女神名为"艾蕾尼娅（Elennia）"
   - [ ] 女神外观含"光翼 / 翅膀 / 金色羽翎"
   - [ ] 女神引导字段含"常驻 / 不消失 / 从不离开"
   - [ ] 女神身份涉及"源流议会 + 三界存续"双重动机
   - [ ] 真假策略三阶段曲线清晰

### 6.3 若出现回归
- 回归项写入日志 `docx/城堡女神-生成回归记录.md`
- 若 3 轮中出现 ≥1 次严重偏离（禁用词泄漏、核心锚点缺失），回到 Task 1 强化 Prompt 中相应约束措辞，再次执行 Task 6

### 6.4 验收通过后
- 不用 commit，但在下一个任务的 commit 信息中记录"3/3 生成测试通过"

---

## Task 7 — 最终验收与收尾

**目标**：完成 Spec §7.1 功能验收 + §7.3 数据验收，整理文档。

### 7.1 功能验收（Spec §7.1）
逐项勾选：
- [ ] 页面可见 Step 1/Step 2 切换器
- [ ] Step 2 在纲要未确认时 disabled + tooltip 正确
- [ ] 纲要卡片可编辑、可确认、可清空
- [ ] Step 2 正确注入 OUTLINE_CONTEXT（F12 网络面板查看 request 体）
- [ ] Step 2 输出的 10 字段 parser 无报错
- [ ] localStorage 跨刷新保留
- [ ] 旧 `castle-goddess` moduleId 仍在（搜索代码），但新页面不再引用

### 7.2 数据验收（Spec §7.3）
- [ ] `data/world.json` 中 `castle.description` 不含"圣心城"
- [ ] `goddess.appearance` 含"光翼""羽翎""塔楼顶端"
- [ ] `goddess.appearance` 不含"消失""越透明"等误导词
- [ ] 修订前 finalized 的字段修订后仍 finalized

### 7.3 代码质量检查
- `npm run type-check` 最终一次全量通过
- `npm run lint`（若项目配置）通过

### 7.4 快照备份
- 按项目惯例创建 `snapshots/2026-05-10_XX-XX-XX/` 目录快照（参考已有快照文件夹结构）

### 7.5 总 Commit / Push
- 若前面每任务单独 commit，此处只需 push；否则整体 squash commit：`feat(castle-goddess): migrate to two-step outline/detail prompt flow`

---

## 回滚策略

| 失败点 | 回滚操作 |
|---|---|
| Task 1-3 编译报错 | `git reset --hard HEAD~N`（对应步数） |
| Task 4 UI 破坏页面 | revert 该 commit，localStorage 数据可手动清除 |
| Task 5 JSON 损坏 | 从最近 `snapshots/` 或 git 还原 `data/world.json` |
| Task 6 内容不达标 | 不回滚代码，只迭代 Prompt 文案（回到 Task 1.2 / 1.3） |

---

## 附：Prompt 对齐补丁（Spec → 实施映射）

Spec 附录 A.2 第 427 行原写：
```
{{outline}}
```
**实施时改为**：
```
OUTLINE_CONTEXT
```
原因：与项目已有 `OVERVIEW_CONTEXT` / `PREVIOUS_CHAPTERS_CONTEXT` 的裸宏风格一致，且在 `src/services/prompts/index.ts` 有统一的未替换兜底清理。

---

**End of Writing Plan.**
