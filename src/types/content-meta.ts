// 内容固化与定稿机制 类型定义

export interface FieldMeta {
  status: 'draft' | 'finalized'
  lastEditedAt?: number
  lastEditSource?: 'user' | 'ai'
  lastEditBy?: string       // 最后编辑者用户名
  finalizedAt?: number
  finalizedBy?: string      // 定稿操作者用户名
  baseContent?: string      // yongge编辑前的基准文本（用于diff对比）
  approvedSummary?: string  // 审核通过时的摘要，供其他模块引用
}

export interface ContentField {
  content: string
  meta: FieldMeta
}

export function createDefaultFieldMeta(): FieldMeta {
  return { status: 'draft' }
}

/** 模块级别的 _meta 对象，key 为字段路径（如 'upper.past', 'summary'） */
export type ModuleMeta = Record<string, FieldMeta>
