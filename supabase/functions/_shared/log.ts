// supabase/functions/_shared/log.ts
// Logger estruturado pra edges. Saída JSON num único console.log por evento,
// indexável no Logs Explorer do Supabase. Inclui correlation_id automático
// pra rastrear request inteira.

type Level = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  fn: string
  request_id?: string
  user_id?: string | null
  condominio_id?: string | null
  [key: string]: unknown
}

export class Logger {
  private ctx: LogContext

  constructor(fn: string, extra: Omit<LogContext, 'fn'> = {}) {
    const request_id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
    this.ctx = { fn, request_id, ...extra }
  }

  /** Anota contexto adicional para todos os logs seguintes. */
  with(extra: Omit<LogContext, 'fn'>): Logger {
    Object.assign(this.ctx, extra)
    return this
  }

  debug(message: string, data?: Record<string, unknown>) { this.emit('debug', message, data) }
  info(message: string, data?: Record<string, unknown>)  { this.emit('info',  message, data) }
  warn(message: string, data?: Record<string, unknown>)  { this.emit('warn',  message, data) }
  error(message: string, data?: Record<string, unknown>) { this.emit('error', message, data) }

  private emit(level: Level, message: string, data?: Record<string, unknown>) {
    const entry = {
      level,
      ts: new Date().toISOString(),
      message,
      ...this.ctx,
      ...(data ?? {}),
    }
    const json = JSON.stringify(entry)
    if (level === 'error') console.error(json)
    else if (level === 'warn') console.warn(json)
    else console.log(json)
  }
}
