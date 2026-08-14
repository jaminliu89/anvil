// DSH 服务封装
// 封装 Tauri invoke + 事件监听，前端只调用这里的方法

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useDshStore } from '@/stores/dsh'

export interface DshState {
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'error'
  port: number | null
  message: string | null
}

/**
 * 获取 DSH 当前状态
 */
export async function getDshStatus(): Promise<DshState> {
  return invoke<DshState>('dsh_status')
}

/**
 * 启动 DSH
 */
export async function startDsh(): Promise<number> {
  return invoke<number>('dsh_start')
}

/**
 * 停止 DSH
 */
export async function stopDsh(): Promise<void> {
  return invoke<void>('dsh_stop')
}

/**
 * 获取 DSH 端口
 */
export async function getDshPort(): Promise<number | null> {
  return invoke<number | null>('dsh_port')
}

/**
 * 获取 DSH Web UI 的 URL
 */
export function getDshWebUrl(port: number): string {
  return `http://127.0.0.1:${port}`
}

/**
 * 监听 DSH 事件，同步到 store
 * 调用一次即可，返回取消监听函数
 */
export function setupDshEventListeners(): () => void {
  const store = useDshStore()

  const unlisteners: Promise<() => void>[] = []

  unlisteners.push(
    listen<number>('dsh-ready', (event) => {
      store.setPort(event.payload)
      store.setStatus('running')
    }),
  )

  unlisteners.push(
    listen<string>('dsh-error', (event) => {
      store.setError(event.payload)
    }),
  )

  return () => {
    unlisteners.forEach((p) => p.then((fn) => fn()))
  }
}

/**
 * 初始化：拉取一次状态 + 注册事件监听
 */
export async function initDsh(): Promise<void> {
  const store = useDshStore()
  try {
    const state = await getDshStatus()
    store.setStatus(state.status as any)
    if (state.port) store.setPort(state.port)
    if (state.message) store.setError(state.message)
  } catch (e) {
    console.error('获取 DSH 状态失败', e)
  }
}
