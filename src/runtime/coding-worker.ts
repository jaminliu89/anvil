const DOCK_API = 'http://127.0.0.1:8710'

export interface CodingTask {
  repo: string
  intent: string
}

export interface CodingPlan {
  sessionId: string
  branch: string
  steps: string[]
}

export interface ApprovalResult {
  ok: boolean
  message: string
}

interface DockActivity {
  kind: string
  text?: string
}

async function dockGet<T>(path: string): Promise<T> {
  const res = await fetch(`${DOCK_API}${path}`)
  if (!res.ok) throw new Error(`Dock API ${res.status}`)
  return res.json()
}

async function dockPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${DOCK_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) throw new Error(`Dock API ${res.status}`)
  return res.json()
}

export async function getCodingWorkerStatus(): Promise<{ available: boolean; message: string }> {
  try {
    const sessions = await dockGet<unknown[]>('/api/sessions')
    return { available: true, message: `Dock ready · ${sessions.length} sessions` }
  } catch {
    return { available: false, message: 'Coding worker unavailable. Dock is not running.' }
  }
}

export async function createCodingPlan(task: CodingTask): Promise<CodingPlan> {
  const created = await dockPost<{ sid: string; branch: string }>('/api/sessions', {
    repo: task.repo,
    prompt: task.intent,
    auto: false,
  })

  const steps = await waitForPlan(created.sid)
  return { sessionId: created.sid, branch: created.branch, steps }
}

async function waitForPlan(sessionId: string): Promise<string[]> {
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    const activities = await dockGet<DockActivity[]>(`/api/sessions/${sessionId}/activities`)

    const plan = activities.find(activity => activity.kind === 'planReady' || activity.kind === 'plan')
    if (plan?.text) {
      const steps = plan.text.split('\n').map(line => line.trim()).filter(Boolean)
      return steps.length ? steps : ['Plan ready']
    }

    const executionStarted = activities.find(activity => activity.kind === 'phaseStarted' || activity.kind === 'executionComplete')
    if (executionStarted) return ['Execution already started']
  }

  throw new Error('Plan generation timed out')
}

export async function approveCodingPlan(sessionId: string): Promise<ApprovalResult> {
  try {
    await dockPost(`/api/sessions/${sessionId}/approve`)
    return { ok: true, message: 'Execution approved' }
  } catch (error) {
    return { ok: false, message: `Approval failed: ${String(error)}` }
  }
}
