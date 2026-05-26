// Traduz erros técnicos do Supabase/Postgres pra mensagens em português amigáveis.
export function traduzErro(err: unknown): string {
  // PostgrestError: {message, details, hint, code}
  let raw: string
  if (err instanceof Error) raw = err.message
  else if (typeof err === 'object' && err !== null && 'message' in err) {
    raw = String((err as { message: unknown }).message)
  } else raw = String(err)
  const msg = raw.toLowerCase()

  // Quotas (raise exception 'Limite de X recurso atingido no plano Y')
  const quotaMatch = raw.match(/Limite de (\d+) (unidades|pessoas|usu[áa]rios) atingido no plano (\w+)\.?/i)
  if (quotaMatch) {
    const [, n, recurso, plano] = quotaMatch
    return `🚫 Limite atingido: seu plano "${plano}" permite até ${n} ${recurso}. Faça upgrade pra adicionar mais.`
  }

  // Postgres unique constraint
  if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
    if (msg.includes('email')) return 'Esse e-mail já está cadastrado.'
    if (msg.includes('cpf')) return 'Esse CPF já está cadastrado.'
    if (msg.includes('cnpj')) return 'Esse CNPJ já está cadastrado.'
    if (msg.includes('codigo')) return 'Esse código já existe. Escolha outro.'
    return 'Esse registro já existe.'
  }

  // Postgres foreign key violation
  if (msg.includes('violates foreign key')) {
    return 'Não foi possível salvar: referência inválida (registro relacionado não existe).'
  }

  // Postgres not null violation
  if (msg.includes('null value in column')) {
    const m = raw.match(/null value in column "(\w+)"/i)
    return `Preencha o campo "${m?.[1] ?? '?'}".`
  }

  // Postgres check constraint
  if (msg.includes('check constraint')) {
    if (msg.includes('perfis_admin_cross_condo')) {
      return 'Administrador OnWay não pode estar vinculado a um condomínio específico.'
    }
    return 'Valor inválido pra esse campo.'
  }

  // RLS
  if (msg.includes('row-level security') || msg.includes('insufficient_privilege') || msg.includes('permission denied')) {
    return 'Sem permissão pra essa ação.'
  }

  // Auth Supabase
  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (msg.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (msg.includes('signups not allowed')) return 'Esse e-mail ainda não tem conta. Peça um convite.'
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos.'
  if (msg.includes('password should be at least')) return 'Senha muito curta. Mínimo 8 caracteres.'
  if (msg.includes('weak password') || msg.includes('password should contain')) {
    return 'Senha fraca. Use minúscula, maiúscula e número.'
  }
  if (msg.includes('user already registered') || msg.includes('user already exists')) {
    return 'Esse e-mail já tem conta. Vá em "Entrar".'
  }
  if (msg.includes('unsupported provider')) return 'Esse método de login ainda não está disponível.'
  if (msg.includes('aal2') || msg.includes('mfa')) return 'Esta ação requer 2FA. Confirme seu código.'

  // Network
  if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
    return 'Sem conexão com o servidor. Verifique sua internet.'
  }
  if (msg.includes('timeout')) return 'Servidor demorou pra responder. Tente novamente.'

  // Fallback: retorna a mensagem original (já em PT no caso de raise exception nossas)
  return raw
}
