import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

const FEATURES = [
  {
    icon: '🏢',
    titulo: 'Portaria Digital',
    desc: 'Controle de encomendas, registro de visitas e liberação de acessos. Porteiro no celular, não em um caderno.',
    cor: 'from-sky-500/20 to-sky-600/10 border-sky-500/20',
    tag: 'Operação',
  },
  {
    icon: '📣',
    titulo: 'Comunicação Centralizada',
    desc: 'Mural, comunicados oficiais, chat interno e calendário. Fim dos grupos de WhatsApp desorganizados.',
    cor: 'from-pink-500/20 to-pink-600/10 border-pink-500/20',
    tag: 'Comunicação',
  },
  {
    icon: '🗳',
    titulo: 'Assembleias Digitais',
    desc: 'Votações online com quórum automático e ata em PDF com assinaturas digitais. Válido em cartório.',
    cor: 'from-violet-500/20 to-violet-600/10 border-violet-500/20',
    tag: 'Governança',
  },
  {
    icon: '🔑',
    titulo: 'Acessos e Segurança',
    desc: 'Moradores autorizam visitas pelo app. Histórico completo de entradas e saídas. Sem ligações para portaria.',
    cor: 'from-teal-500/20 to-teal-600/10 border-teal-500/20',
    tag: 'Segurança',
  },
  {
    icon: '⚠️',
    titulo: 'Ocorrências e Chamados',
    desc: 'Moradores registram ocorrências. Síndico acompanha e resolve. Tudo rastreado com histórico completo.',
    cor: 'from-amber-500/20 to-amber-600/10 border-amber-500/20',
    tag: 'Gestão',
  },
  {
    icon: '🏷',
    titulo: 'Classificados',
    desc: 'Moradores anunciam itens à venda, serviços e imóveis. Comunidade mais conectada e ativa.',
    cor: 'from-fuchsia-500/20 to-fuchsia-600/10 border-fuchsia-500/20',
    tag: 'Comunidade',
  },
]

const STEPS = [
  {
    n: '01',
    titulo: 'Cadastre o condomínio',
    desc: 'Crie sua conta, configure o condomínio e personalize com a identidade visual. Leva menos de 5 minutos.',
  },
  {
    n: '02',
    titulo: 'Convide sua equipe',
    desc: 'Adicione síndico, portaria, subsíndico e moradores. Cada um acessa só o que precisa.',
  },
  {
    n: '03',
    titulo: 'Tudo funcionando no mesmo dia',
    desc: 'Sem instalação, sem treinamento longo. O app é intuitivo e funciona em qualquer celular ou computador.',
  },
]

const PLANOS = [
  {
    id: 'basico',
    nome: 'Básico',
    preco: 149,
    desc: 'Para condomínios pequenos que querem portaria digital.',
    features: ['Portaria digital', 'Acessos autorizados', 'Cadastro de moradores', 'Mural informativo', 'Ocorrências'],
    limite: 'Até 30 unidades',
    destaque: false,
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    preco: 349,
    desc: 'Comunicação completa + gestão operacional.',
    features: ['Tudo do Básico', 'Chat interno', 'Comunicados oficiais', 'Classificados', 'Multas e chamados', 'Calendário de eventos'],
    limite: 'Até 150 unidades',
    destaque: true,
  },
  {
    id: 'enterprise',
    nome: 'Enterprise',
    preco: 799,
    desc: 'Tudo incluído para administradoras profissionais.',
    features: ['Tudo do Profissional', 'Assembleias digitais', 'Votações com ata em PDF', 'Relatórios gerenciais', 'Auditoria completa', 'Storage 50 GB'],
    limite: 'Unidades ilimitadas',
    destaque: false,
  },
]

const FAQS = [
  {
    q: 'Os moradores precisam instalar algum aplicativo?',
    a: 'Não. O OnWay Condomínio funciona direto no navegador do celular ou computador, sem instalação obrigatória. Também pode ser adicionado à tela inicial como PWA para uma experiência de app nativo.',
  },
  {
    q: 'Como funciona o período de teste gratuito?',
    a: 'São 30 dias com acesso completo a todas as funcionalidades, sem necessidade de cartão de crédito. Ao final, você escolhe o plano que melhor se encaixa no seu condomínio.',
  },
  {
    q: 'Os dados do condomínio são seguros?',
    a: 'Sim. Utilizamos a infraestrutura Supabase (Postgres) com criptografia em trânsito e em repouso, backups automáticos diários e isolamento total entre condomínios (multi-tenant com Row Level Security).',
  },
  {
    q: 'O app funciona para condomínios de qualquer tamanho?',
    a: 'Sim. Do condomínio de 10 unidades ao complexo residencial com centenas de apartamentos. O plano Enterprise não tem limite de unidades e suporta múltiplos blocos.',
  },
  {
    q: 'Posso migrar os dados do meu sistema atual?',
    a: 'Sim. Oferecemos importação de moradores, unidades e veículos via planilha Excel. Nossa equipe auxilia na migração sem custo adicional durante o trial.',
  },
]

export default function Landing() {
  const [faqAberto, setFaqAberto] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    document.title = 'OnWay Condomínio — Gestão inteligente do seu condomínio'
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-x-hidden">

      {/* NAV */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-bold text-slate-100 text-sm leading-tight">
              OnWay<br /><span className="text-brand-400 font-medium">Condomínio</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            <a href="#funcionalidades" className="hover:text-slate-100 transition">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-slate-100 transition">Como funciona</a>
            <a href="#planos" className="hover:text-slate-100 transition">Planos</a>
            <a href="#faq" className="hover:text-slate-100 transition">FAQ</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/entrar" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition">
              Entrar
            </Link>
            <Link
              to="/signup"
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold transition"
            >
              Começar grátis
            </Link>
          </div>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950 px-4 py-4 flex flex-col gap-3 text-sm">
            <a href="#funcionalidades" onClick={() => setMenuOpen(false)} className="text-slate-300 py-1">Funcionalidades</a>
            <a href="#como-funciona" onClick={() => setMenuOpen(false)} className="text-slate-300 py-1">Como funciona</a>
            <a href="#planos" onClick={() => setMenuOpen(false)} className="text-slate-300 py-1">Planos</a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="text-slate-300 py-1">FAQ</a>
            <hr className="border-slate-800" />
            <Link to="/entrar" className="text-slate-300 py-1">Entrar</Link>
            <Link to="/signup" className="block text-center py-2.5 rounded-lg bg-brand-600 text-white font-semibold">
              Começar grátis
            </Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        {/* Glow de fundo */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-brand-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-64 h-64 rounded-full bg-violet-600/8 blur-[80px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-300 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            30 dias grátis · Sem cartão de crédito
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Gerencie seu condomínio{' '}
            <span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
              com inteligência.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 leading-relaxed mb-10 max-w-2xl mx-auto">
            Portaria digital, assembleias online, comunicação centralizada e votações com ata em PDF.
            Tudo no mesmo app, acessível de qualquer dispositivo, sem instalação.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
            <Link
              to="/signup"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-base transition shadow-lg shadow-brand-600/25"
            >
              Começar 30 dias grátis →
            </Link>
            <Link
              to="/entrar"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white font-medium text-base transition"
            >
              Já tenho conta
            </Link>
          </div>

          {/* App preview */}
          <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 shadow-2xl shadow-black/40 max-w-3xl mx-auto">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
              <div className="flex-1 mx-3 h-5 rounded-md bg-slate-800 text-[10px] text-slate-500 flex items-center px-2">
                onway-condominio.vercel.app
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { emoji: '📦', label: 'Encomendas', badge: '3' },
                { emoji: '🔑', label: 'Acessos', badge: null },
                { emoji: '📣', label: 'Mural', badge: '1' },
                { emoji: '💬', label: 'Chat', badge: '5' },
                { emoji: '🗳', label: 'Votação', badge: null },
                { emoji: '⚠️', label: 'Ocorrências', badge: '2' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="relative flex items-center gap-3 rounded-lg border border-slate-700/60 bg-slate-800/60 p-3"
                >
                  <span className="text-xl">{item.emoji}</span>
                  <span className="text-xs font-medium text-slate-300">{item.label}</span>
                  {item.badge && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-brand-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-12 border-y border-slate-800/60 bg-slate-900/30">
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { valor: '30 dias', label: 'Trial gratuito' },
            { valor: '100%', label: 'Web, sem instalação' },
            { valor: '99.9%', label: 'Uptime garantido' },
            { valor: '5 min', label: 'Para começar' },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl sm:text-3xl font-bold text-brand-400 mb-1">{s.valor}</div>
              <div className="text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="funcionalidades" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3 block">Funcionalidades</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">
              Tudo que seu condomínio precisa
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Uma plataforma completa que cobre cada ponto de contato entre síndico, portaria e moradores.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.titulo}
                className={`relative rounded-xl border bg-gradient-to-br p-6 transition hover:scale-[1.02] ${f.cor}`}
              >
                <span className="inline-block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
                  {f.tag}
                </span>
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-base font-bold text-slate-100 mb-2">{f.titulo}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ANTES vs DEPOIS */}
      <section className="py-24 px-4 bg-slate-900/30 border-y border-slate-800/60">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3 block">Transformação</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">
              Antes e depois do OnWay
            </h2>
            <p className="text-slate-400 max-w-lg mx-auto">
              Veja como cada tarefa muda quando o condomínio sai do improviso e passa a ter um sistema.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SEM ONWAY */}
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-lg">😩</span>
                <h3 className="text-base font-bold text-red-400">Sem OnWay</h3>
              </div>
              <ul className="space-y-3">
                {[
                  { icon: '📦', text: 'Porteiro anota encomendas num caderno. Morador liga pra saber se chegou.' },
                  { icon: '📱', text: 'Comunicados vão pro grupo de WhatsApp. Acabam sumidos entre memes.' },
                  { icon: '📋', text: 'Assembleia requer impressão, folha de presença e ata manuscrita.' },
                  { icon: '🚪', text: 'Morador liga pra portaria liberar cada visita. Porteiro esquece.' },
                  { icon: '⚠️', text: 'Ocorrências são mandadas por mensagem. Ninguém acompanha o status.' },
                  { icon: '📄', text: 'Multas são cobradas por e-mail. Morador diz que não recebeu.' },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                    <span className="text-sm text-slate-400 leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* COM ONWAY */}
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-lg">✅</span>
                <h3 className="text-base font-bold text-emerald-400">Com OnWay</h3>
              </div>
              <ul className="space-y-3">
                {[
                  { icon: '📦', text: 'App registra a encomenda e notifica o morador na hora. Zero ligação.' },
                  { icon: '📣', text: 'Comunicado publicado no mural. Todos veem, confirmam leitura.' },
                  { icon: '🗳', text: 'Votação online com quórum automático e ata em PDF com assinaturas.' },
                  { icon: '🔑', text: 'Morador autoriza a visita pelo app. Portaria libera com um clique.' },
                  { icon: '✅', text: 'Ocorrência aberta, acompanhada e encerrada com histórico completo.' },
                  { icon: '📲', text: 'Multa emitida com notificação, prazo e recibo. Rastreável.' },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                    <span className="text-sm text-slate-300 leading-relaxed">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition shadow-lg shadow-brand-600/25"
            >
              Quero o depois →
            </Link>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-24 px-4 bg-slate-900/30 border-y border-slate-800/60">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3 block">Como funciona</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">
              Pronto para usar no mesmo dia
            </h2>
            <p className="text-slate-400 max-w-lg mx-auto">
              Sem implantação longa, sem treinamento extenso. Você configura, convida e começa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-[calc(50%+2rem)] right-0 h-px border-t border-dashed border-slate-700" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-black text-brand-400">{step.n}</span>
                </div>
                <h3 className="text-base font-bold text-slate-100 mb-2">{step.titulo}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3 block">Planos</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">
              Preço justo, sem surpresas
            </h2>
            <p className="text-slate-400 max-w-lg mx-auto">
              Todos os planos incluem 30 dias grátis. Cancele quando quiser, sem multa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANOS.map((plano) => (
              <div
                key={plano.id}
                className={`relative rounded-2xl border p-7 flex flex-col transition ${
                  plano.destaque
                    ? 'border-brand-500 bg-gradient-to-b from-brand-500/10 to-slate-900/60 shadow-xl shadow-brand-500/10'
                    : 'border-slate-700 bg-slate-900/40'
                }`}
              >
                {plano.destaque && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-brand-600 text-white text-xs font-bold whitespace-nowrap">
                    Mais popular
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-slate-100">{plano.nome}</h3>
                  <p className="text-sm text-slate-400 mt-1">{plano.desc}</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-black text-slate-100">R$ {plano.preco.toLocaleString('pt-BR')}</span>
                  <span className="text-slate-500 text-sm">/mês</span>
                  <div className="text-xs text-slate-500 mt-1">{plano.limite}</div>
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plano.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <span className="text-emerald-400 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition ${
                    plano.destaque
                      ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/25'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  Começar grátis
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-500">
              Precisa de algo personalizado?{' '}
              <a href="mailto:contato@onway.com.br" className="text-brand-400 hover:text-brand-300 transition">
                Fale com a gente sobre o plano à la carte.
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-4 bg-slate-900/30 border-y border-slate-800/60">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3 block">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-100">
              Dúvidas frequentes
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-700/60 bg-slate-900/40 overflow-hidden"
              >
                <button
                  onClick={() => setFaqAberto(faqAberto === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-slate-100">{faq.q}</span>
                  <span className={`shrink-0 text-slate-400 transition-transform ${faqAberto === i ? 'rotate-45' : ''}`}>
                    +
                  </span>
                </button>
                {faqAberto === i && (
                  <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed border-t border-slate-800">
                    <div className="pt-3">{faq.a}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 via-transparent to-violet-600/8 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">
            Seu condomínio merece uma gestão moderna.
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Comece hoje com 30 dias grátis. Sem cartão de crédito, sem compromisso.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/signup"
              className="w-full sm:w-auto px-10 py-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-base transition shadow-xl shadow-brand-600/30"
            >
              Criar conta grátis →
            </Link>
            <a
              href="mailto:contato@onway.com.br"
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-white font-medium text-base transition"
            >
              Falar com a equipe
            </a>
          </div>
          <p className="text-xs text-slate-600 mt-6">
            30 dias grátis · Cancele quando quiser · Dados seguros com Supabase
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <div>
              <div className="text-sm font-bold text-slate-200">OnWay Condomínio</div>
              <div className="text-xs text-slate-500">Gestão condominial inteligente</div>
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
            <a href="#funcionalidades" className="hover:text-slate-300 transition">Funcionalidades</a>
            <a href="#planos" className="hover:text-slate-300 transition">Planos</a>
            <Link to="/termos" className="hover:text-slate-300 transition">Termos</Link>
            <Link to="/privacidade" className="hover:text-slate-300 transition">Privacidade</Link>
            <a href="mailto:contato@onway.com.br" className="hover:text-slate-300 transition">Contato</a>
          </nav>

          <p className="text-xs text-slate-600 text-center md:text-right">
            © {new Date().getFullYear()} OnWay. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
