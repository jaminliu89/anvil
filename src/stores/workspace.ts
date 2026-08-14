// 工作区管理
// MVP：保存一个工作区路径列表，支持增删查

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { Store } from '@tauri-apps/plugin-store'
import { open } from '@tauri-apps/plugin-dialog'

let store: Store | null = null

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load('settings.json')
  }
  return store
}

export interface Workspace {
  id: string
  name: string
  path: string
  icon?: string
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaces = ref<Workspace[]>([])
  const currentWorkspaceId = ref<string>('')

  async function load() {
    const s = await getStore()
    const ws = await s.get<Workspace[]>('workspaces')
    if (ws) workspaces.value = ws
    const current = await s.get<string>('currentWorkspaceId')
    if (current) currentWorkspaceId.value = current
  }

  async function save() {
    const s = await getStore()
    await s.set('workspaces', workspaces.value)
    await s.set('currentWorkspaceId', currentWorkspaceId.value)
    await s.save()
  }

  /** 弹出系统对话框，选择文件夹作为工作区 */
  async function addWorkspace(): Promise<Workspace | null> {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择工作区文件夹',
    })

    if (!selected || typeof selected !== 'string') return null

    // 从路径提取名字
    const parts = selected.split(/[\\/]/)
    const name = parts[parts.length - 1] || '未命名工作区'

    const ws: Workspace = {
      id: `ws-${Date.now()}`,
      name,
      path: selected,
      icon: '📁',
    }

    workspaces.value.push(ws)
    currentWorkspaceId.value = ws.id
    await save()
    return ws
  }

  async function removeWorkspace(id: string) {
    const idx = workspaces.value.findIndex((w) => w.id === id)
    if (idx >= 0) {
      workspaces.value.splice(idx, 1)
      if (currentWorkspaceId.value === id) {
        currentWorkspaceId.value = workspaces.value[0]?.id || ''
      }
      await save()
    }
  }

  async function setCurrent(id: string) {
    currentWorkspaceId.value = id
    await save()
  }

  const currentWorkspace = () =>
    workspaces.value.find((w) => w.id === currentWorkspaceId.value) || null

  return {
    workspaces,
    currentWorkspaceId,
    load,
    save,
    addWorkspace,
    removeWorkspace,
    setCurrent,
    currentWorkspace,
  }
})
