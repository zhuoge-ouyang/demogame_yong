// 内容固化与定稿机制 类型定义

export interface FieldMeta {
  status: 'draft' | 'finalized'
  lastEditedAt?: number
  lastEditSource?: 'user' | 'ai'
  finalizedAt?: number
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
