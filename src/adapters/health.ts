// 工具健康检查 — 统一从 bridge /tools/status 拉取，60s 缓存
// 所有 adapter 的 status() 和 intent 的可用性判断都走这里

const BRIDGE = 'http://127.0.0.1:18443'

export interface ToolStatus {
  available: boolean
  healthy: boolean
  message: string
}

interface StatusCache {
  ts: number
  data: Record<string, ToolStatus>
}

const CACHE_TTL = 60_000 // 60 秒
let cache: StatusCache | null = null
let fetchPromise: Promise<Record<string, ToolStatus>> | null = null

/**
 * 获取所有工具状态。优先读缓存，过期了就后台刷新。
 * 第一次调用如果缓存为空，会等 fetch 完成。
 */
export async function getToolsStatus(force = false): Promise<Record<string, ToolStatus>> {
  const now = Date.now()

  // 缓存有效且不强制刷新 → 直接返回
  if (!force && cache && (now - cache.ts) < CACHE_TTL) {
    return cache.data
  }

  // 已经在 fetch 中 → 复用 promise
  if (fetchPromise) {
    return fetchPromise
  }

  fetchPromise = fetchStatus()
    .then(data => {
      cache = { ts: Date.now(), data }
      return data
    })
    .catch(() => {
      // 失败了返回空（所有工具状态未知）
      return cache?.data || {}
    })
    .finally(() => {
      fetchPromise = null
    })

  return fetchPromise
}

/** 获取单个工具的状态 */
export async function getToolStatus(toolId: string, force = false): Promise<ToolStatus | null> {
  const all = await getToolsStatus(force)
  return all[toolId] || null
}

/** 获取健康的工具 ID 列表（available && healthy） */
export async function getHealthyToolIds(force = false): Promise<string[]> {
  const all = await getToolsStatus(force)
  return Object.entries(all)
    .filter(([, s]) => s.available && s.healthy)
    .map(([id]) => id)
}

async function fetchStatus(): Promise<Record<string, ToolStatus>> {
  try {
    const res = await fetch(`${BRIDGE}/tools/status`, {
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const json = await res.json()
    return json.tools || {}
  } catch {
    // bridge 没启动或挂了，返回空（所有工具状态未知）
    return {}
  }
}
