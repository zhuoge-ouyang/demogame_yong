# 项目快照索引

## 快照信息

- **快照时间**: 2026-04-14
- **快照描述**: 包含五大派系+混沌之神、命运女神、第十魂令主角、湮灭魔族、九大陆凡界定位等全部最新设定

---

## 备份文件清单

### 数据文件 (`data/`)

| 文件名 | 原始路径 | 说明 |
|--------|----------|------|
| world.json | `data/world.json` | 世界观核心数据 |
| continents.json | `data/continents.json` | 九大陆配置数据 |
| landing.json | `data/landing.json` | 落地页数据 |
| history.json | `data/history.json` | 历史记录数据 |

### 项目根目录数据文件

| 文件名 | 原始路径 | 说明 |
|--------|----------|------|
| 世界观完整数据.json | `世界观完整数据.json` | 世界观完整导出数据 |

### Prompt文件 (`src/services/prompts/`)

| 文件名 | 原始路径 | 说明 |
|--------|----------|------|
| system-prompt.ts | `src/services/prompts/system-prompt.ts` | 系统提示词配置 |
| index.ts | `src/services/prompts/index.ts` | Prompt索引文件 |
| phase1-prompts.ts | `src/services/prompts/phase1-prompts.ts` | 第一阶段Prompt |
| phase2-prompts.ts | `src/services/prompts/phase2-prompts.ts` | 第二阶段Prompt |
| phase3-prompts.ts | `src/services/prompts/phase3-prompts.ts` | 第三阶段Prompt |
| assessment-prompts.ts | `src/services/prompts/assessment-prompts.ts` | 评测Prompt |

### 项目根目录Prompt文件

| 文件名 | 原始路径 | 说明 |
|--------|----------|------|
| 新版综合Prompt.txt | `新版综合Prompt.txt` | 新版综合Prompt文本 |
| 第一份prompt.txt | `docx/第一份prompt.txt` | 原始Prompt文档 |

### HTML报告 (`public/`)

| 文件名 | 原始路径 | 说明 |
|--------|----------|------|
| 世界观报告.html | `public/世界观报告.html` | 世界观HTML报告 |

### 类型定义 (`src/types/`)

| 文件名 | 原始路径 | 说明 |
|--------|----------|------|
| world.ts | `src/types/world.ts` | 世界观类型定义 |
| continent.ts | `src/types/continent.ts` | 大陆类型定义 |
| landing.ts | `src/types/landing.ts` | 落地页类型定义 |
| ai.ts | `src/types/ai.ts` | AI相关类型定义 |

### Store配置 (`src/stores/`)

| 文件名 | 原始路径 | 说明 |
|--------|----------|------|
| world.ts | `src/stores/world.ts` | 世界观状态管理 |
| continents.ts | `src/stores/continents.ts` | 大陆状态管理 |
| landing.ts | `src/stores/landing.ts` | 落地页状态管理 |
| app.ts | `src/stores/app.ts` | 应用全局状态管理 |

### 常量配置 (`src/constants/`)

| 文件名 | 原始路径 | 说明 |
|--------|----------|------|
| defaults.ts | `src/constants/defaults.ts` | 默认值配置 |
| continents.ts | `src/constants/continents.ts` | 大陆常量配置 |
| phase-config.ts | `src/constants/phase-config.ts` | 阶段配置 |

### 服务端

| 文件名 | 原始路径 | 说明 |
|--------|----------|------|
| server.js | `server.js` | Node.js服务端文件 |

---

## 恢复说明

### 如何将快照恢复到项目中

在项目根目录 `demogame_yong/` 下执行以下PowerShell命令：

```powershell
# 定义快照目录
$snapshotDir = "snapshots/2026-04-14"

# 恢复数据文件
Copy-Item "$snapshotDir/data/world.json" "data/" -Force
Copy-Item "$snapshotDir/data/continents.json" "data/" -Force
Copy-Item "$snapshotDir/data/landing.json" "data/" -Force
Copy-Item "$snapshotDir/data/history.json" "data/" -Force -ErrorAction SilentlyContinue

# 恢复项目根目录数据文件
Copy-Item "$snapshotDir/世界观完整数据.json" "./" -Force

# 恢复Prompt文件
Copy-Item "$snapshotDir/src/services/prompts/*" "src/services/prompts/" -Force

# 恢复项目根目录Prompt文件
Copy-Item "$snapshotDir/新版综合Prompt.txt" "./" -Force
Copy-Item "$snapshotDir/第一份prompt.txt" "docx/" -Force

# 恢复HTML报告
Copy-Item "$snapshotDir/public/世界观报告.html" "public/" -Force

# 恢复类型定义
Copy-Item "$snapshotDir/src/types/*" "src/types/" -Force

# 恢复Store配置
Copy-Item "$snapshotDir/src/stores/*" "src/stores/" -Force

# 恢复常量配置
Copy-Item "$snapshotDir/src/constants/*" "src/constants/" -Force

# 恢复服务端文件
Copy-Item "$snapshotDir/server.js" "./" -Force

Write-Host "快照恢复完成！"
```

### 手动恢复步骤

1. 打开快照目录 `snapshots/2026-04-14/`
2. 按照上述文件清单，将文件复制回对应的原始路径
3. 注意保持目录结构一致

---

## 备注

- 此快照包含项目所有核心设定文件的完整备份
- 恢复前建议先备份当前文件，以免数据丢失
- 快照不包含 `node_modules`、`dist` 等生成目录
