import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

// ─── Palette ─────────────────────────────────────────────────────────────────
const NAVY   = '#080d1a'
const NAVY2  = '#0c1221'
const AMBER  = '#e8a838'
const AMBER8 = 'rgba(232,168,56,0.08)'
const AMBER15= 'rgba(232,168,56,0.15)'
const W6  = 'rgba(255,255,255,0.06)'
const W8  = 'rgba(255,255,255,0.08)'
const W12 = 'rgba(255,255,255,0.12)'

// ─── Data ─────────────────────────────────────────────────────────────────────
const FEATURES = [
  { n: '01', titulo: 'Portaria Digital',           desc: 'Controle de encomendas, registro de visitas e liberação de acessos pelo celular. Chega de porteiro anotando em caderno.' },
  { n: '02', titulo: 'Comunicação Centralizada',   desc: 'Mural oficial, comunicados, chat interno e calendário em um único lugar. Fim dos grupos de WhatsApp.' },
  { n: '03', titulo: 'Assembleias Digitais',       desc: 'Votações com quórum automático e ata em PDF assinada digitalmente. Juridicamente válido.' },
  { n: '04', titulo: 'Acessos e Segurança',        desc: 'Moradores autorizam visitas pelo app. Histórico completo de entradas e saídas. Sem ligações para a portaria.' },
  { n: '05', titulo: 'Ocorrências e Chamados',     desc: 'Registro, acompanhamento e encerramento com histórico completo e rastreável para síndico e morador.' },
  { n: '06', titulo: 'Classificados e Comunidade', desc: 'Moradores anunciam itens, serviços e imóveis. Comunidade mais conectada, condomínio mais ativo.' },
]

const PLANOS = [
  {
    id: 'starter',
    nome: 'Starter',
    preco: 149,
    limite: 'Até 30 unidades',
    features: ['Portaria digital', 'Acessos autorizados', 'Cadastro de moradores', 'Mural informativo', 'Ocorrências e chamados'],
    destaque: false,
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    preco: 269,
    limite: 'Até 150 unidades',
    features: ['Tudo do Starter', 'Chat interno', 'Comunicados oficiais', 'Classificados', 'Multas', 'Calendário de eventos'],
    destaque: true,
  },
  {
    id: 'completo',
    nome: 'Completo',
    preco: 509,
    limite: 'Unidades ilimitadas',
    features: ['Tudo do Profissional', 'Assembleias digitais', 'Votações com ata em PDF', 'IA assistente', 'Relatórios', 'Auditoria'],
    destaque: false,
  },
]

const FAQS = [
  { q: 'Os moradores precisam instalar algum aplicativo?', a: 'Não. O OnWay Condomínio funciona direto no navegador, sem instalação obrigatória. Pode ser adicionado à tela inicial como PWA para uma experiência de app nativo.' },
  { q: 'Como funciona o período de teste gratuito?',       a: '10 dias com acesso completo a todas as funcionalidades, sem cartão de crédito. Ao final você escolhe o plano ideal para o seu condomínio.' },
  { q: 'Os dados do condomínio são seguros?',              a: 'Sim. Infraestrutura Supabase com criptografia em trânsito e em repouso, backups automáticos diários e isolamento total entre condomínios via Row Level Security.' },
  { q: 'Funciona para condomínios de qualquer tamanho?',   a: 'Sim. Do condomínio de 10 unidades ao complexo com centenas de apartamentos. O plano Completo não tem limite de unidades e suporta múltiplos blocos.' },
  { q: 'Posso migrar dados do meu sistema atual?',         a: 'Sim. Importação de moradores, unidades e veículos via planilha. Nossa equipe auxilia na migração sem custo adicional durante o trial.' },
]

// ─── App Preview (hero right) ─────────────────────────────────────────────────
function AppPreview() {
  const activities = [
    { color: '#22c55e', label: 'Encomenda · Ap. 402',    sub: 'Aguardando retirada · agora'         },
    { color: AMBER,     label: 'Ocorrência · 3º andar',  sub: 'Barulho após meia-noite · 2h atrás'  },
    { color: '#6366f1', label: 'Assembleia marcada',      sub: '15/07 às 19h · Confirmado'            },
  ]

  return (
    <div
      style={{ fontFamily: "'DM Sans', sans-serif", perspective: '900px' }}
      className="w-full"
    >
      <div style={{ transform: 'rotateX(6deg) rotateY(-4deg)', transformOrigin: 'center top', transition: 'transform 0.4s ease' }}
           className="hover:rotate-0"
      >
        <div
          className="rounded-2xl overflow-hidden shadow-2xl"
          style={{ border: `1px solid ${W12}`, backgroundColor: '#090e1c', boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)' }}
        >
          {/* Browser chrome */}
          <div style={{ backgroundColor: '#0b1020', borderBottom: `1px solid ${W6}` }} className="flex items-center gap-1.5 px-4 py-3">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
            <div
              style={{ backgroundColor: W6, color: 'rgba(255,255,255,0.2)' }}
              className="flex-1 mx-3 h-5 rounded text-[10px] font-mono flex items-center px-2"
            >
              onwaycondominio.com
            </div>
          </div>

          {/* Sidebar + content */}
          <div className="flex" style={{ minHeight: '340px' }}>
            {/* Sidebar */}
            <div style={{ width: '52px', backgroundColor: '#070c19', borderRight: `1px solid ${W6}` }} className="flex flex-col items-center py-4 gap-4">
              {['■','▲','◆','●','▼'].map((icon, i) => (
                <div
                  key={i}
                  style={{ color: i === 0 ? AMBER : 'rgba(255,255,255,0.2)', fontSize: '8px' }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg"
                >
                  {icon}
                </div>
              ))}
            </div>

            {/* Main content */}
            <div className="flex-1 p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>Residencial Flores</div>
                  <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>Painel de controle</div>
                </div>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: AMBER8, border: `1px solid ${AMBER15}` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: AMBER }} />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[{ n: '3', l: 'Encomendas' }, { n: '1', l: 'Ocorrências' }, { n: '5', l: 'Avisos' }].map((s) => (
                  <div
                    key={s.l}
                    className="rounded-xl p-3"
                    style={{ backgroundColor: W6, border: `1px solid ${W6}` }}
                  >
                    <div className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.9)', fontFamily: "'Playfair Display', serif" }}>{s.n}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Activity */}
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Atividade recente
              </div>
              <div className="space-y-0">
                {activities.map((a) => (
                  <div
                    key={a.label}
                    className="flex items-start gap-2.5 py-2.5"
                    style={{ borderBottom: `1px solid ${W6}` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: a.color }} />
                    <div>
                      <div className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>{a.label}</div>
                      <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>{a.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Floating badge */}
        <div
          className="absolute -bottom-4 -right-4 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xl"
          style={{ backgroundColor: NAVY2, border: `1px solid ${W8}`, color: 'rgba(255,255,255,0.7)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Sistema operacional
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const [faqAberto, setFaqAberto] = useState<number | null>(null)
  const [menuOpen, setMenuOpen]   = useState(false)
  const [scrolled, setScrolled]   = useState(false)

  useEffect(() => {
    document.title = 'OnWay Condomínio — Gestão condominial com precisão'
    const onScroll = () => setScrolled(window.scrollY > 48)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navBg = scrolled
    ? `backdrop-blur-xl border-b`
    : ''

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        backgroundColor: NAVY,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)
        `,
        backgroundSize: '52px 52px',
        color: '#e2e8f8',
      }}
      className="min-h-screen overflow-x-hidden"
    >

      {/* ── NAV ────────────────────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${navBg}`}
        style={scrolled ? { backgroundColor: 'rgba(8,13,26,0.88)', borderColor: W8 } : {}}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="text-sm font-semibold tracking-tight" style={{ color: 'rgba(255,255,255,0.85)' }}>
              OnWay <span style={{ color: AMBER }}>Condomínio</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {[
              ['#funcionalidades', 'Funcionalidades'],
              ['#como-funciona',   'Como funciona'],
              ['#planos',          'Planos'],
              ['#faq',             'FAQ'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="hover:text-white transition-colors">{label}</a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/entrar" className="text-sm px-3 py-1.5 transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Entrar
            </Link>
            <Link
              to="/comecar"
              className="px-5 py-2 text-sm font-semibold rounded-lg transition-all hover:brightness-110"
              style={{ border: `1px solid ${AMBER}`, color: AMBER, backgroundColor: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = AMBER; (e.currentTarget as HTMLElement).style.color = NAVY }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = AMBER }}
            >
              Começar grátis
            </Link>
          </div>

          <button onClick={() => setMenuOpen(v => !v)} className="md:hidden p-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div
            className="md:hidden px-6 py-5 flex flex-col gap-4 text-sm"
            style={{ borderTop: `1px solid ${W8}`, backgroundColor: 'rgba(8,13,26,0.97)' }}
          >
            {[
              ['#funcionalidades', 'Funcionalidades'],
              ['#como-funciona',   'Como funciona'],
              ['#planos',          'Planos'],
              ['#faq',             'FAQ'],
            ].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</a>
            ))}
            <hr style={{ borderColor: W8 }} />
            <Link to="/entrar" style={{ color: 'rgba(255,255,255,0.45)' }}>Entrar</Link>
            <Link
              to="/comecar"
              className="text-center py-2.5 rounded-lg font-semibold"
              style={{ border: `1px solid ${AMBER}`, color: AMBER }}
            >
              Começar grátis
            </Link>
          </div>
        )}
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-16">
        {/* Ambient glows */}
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, rgba(232,168,56,0.055) 0%, transparent 65%)` }} />
        <div className="absolute bottom-1/3 right-1/5 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)` }} />

        <div className="max-w-6xl mx-auto px-6 py-24 w-full grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-16 lg:gap-20 items-center">

          {/* Left: copy */}
          <div className="lp-fade-up" style={{ animationDelay: '0s' }}>
            {/* Pill */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8"
              style={{ border: `1px solid rgba(232,168,56,0.25)`, backgroundColor: AMBER8, color: AMBER }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: AMBER }} />
              10 dias grátis · Sem cartão de crédito
            </div>

            {/* Headline */}
            <h1
              className="text-5xl lg:text-6xl xl:text-[4.25rem] font-bold leading-[1.06] mb-6"
              style={{ fontFamily: "'Playfair Display', serif", letterSpacing: '-0.02em', color: '#f0f4ff' }}
            >
              Administre com<br />
              <em style={{ fontStyle: 'italic', color: AMBER }}>precisão.</em><br />
              Não com improviso.
            </h1>

            {/* Subtitle */}
            <p className="text-lg leading-relaxed mb-10 max-w-md font-light" style={{ color: 'rgba(255,255,255,0.42)' }}>
              Portaria, comunicados, assembleias e acessos em um único sistema.
              Sem caderno, sem grupo de WhatsApp, sem confusão.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Link
                to="/comecar"
                className="px-8 py-3.5 rounded-xl text-sm font-bold text-center transition-all hover:brightness-110"
                style={{ backgroundColor: AMBER, color: NAVY }}
              >
                Criar conta grátis →
              </Link>
              <Link
                to="/entrar"
                className="px-8 py-3.5 rounded-xl text-sm font-medium text-center transition-all"
                style={{ border: `1px solid ${W12}`, color: 'rgba(255,255,255,0.45)' }}
              >
                Já tenho conta
              </Link>
            </div>

            {/* Trust */}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {['Sem contrato de fidelidade', 'Cancele quando quiser', 'Dados criptografados'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  <span style={{ color: AMBER }}>✓</span> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right: app preview */}
          <div className="relative lp-fade-up hidden lg:block" style={{ animationDelay: '0.18s' }}>
            <AppPreview />
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-24 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, transparent, ${NAVY})` }} />
      </section>

      {/* ── METRICS ────────────────────────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${W6}`, borderBottom: `1px solid ${W6}`, backgroundColor: 'rgba(12,18,33,0.6)' }}>
        <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { n: '10', suf: ' dias', label: 'de trial gratuito'      },
            { n: '5',  suf: ' min',  label: 'para configurar'        },
            { n: '100%', suf: '',    label: 'online, sem instalação'  },
            { n: 'Zero', suf: '',    label: 'taxa de cancelamento'    },
          ].map((m) => (
            <div key={m.label}>
              <div
                className="text-3xl sm:text-4xl font-bold mb-1"
                style={{ fontFamily: "'Playfair Display', serif", color: '#f0f4ff' }}
              >
                {m.n}<span style={{ color: AMBER, fontSize: '1.1rem' }}>{m.suf}</span>
              </div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ───────────────────────────────────────────────────────── */}
      <section id="funcionalidades" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Section label + title */}
          <div className="mb-20">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: AMBER }}>
              Funcionalidades
            </div>
            <h2
              className="text-4xl sm:text-5xl font-bold leading-tight"
              style={{ fontFamily: "'Playfair Display', serif", color: '#f0f4ff' }}
            >
              O que o OnWay resolve.
            </h2>
          </div>

          {/* Numbered grid */}
          <div className="grid grid-cols-1 md:grid-cols-2">
            {FEATURES.map((f, i) => {
              const isLeft  = i % 2 === 0
              const isLast  = i >= FEATURES.length - 2
              return (
                <div
                  key={f.n}
                  className="group flex gap-6 py-9 transition-colors cursor-default"
                  style={{
                    borderBottom: isLast ? 'none' : `1px solid ${W6}`,
                    borderRight:  isLeft ? `1px solid ${W6}` : 'none',
                    paddingRight: isLeft ? '3rem' : '0',
                    paddingLeft:  isLeft ? '0'    : '3rem',
                  }}
                >
                  <div
                    className="text-5xl font-black leading-none select-none shrink-0 transition-colors"
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      color: 'rgba(255,255,255,0.05)',
                    }}
                  >
                    {f.n}
                  </div>
                  <div>
                    <div
                      className="text-sm font-semibold mb-2 transition-colors"
                      style={{ color: 'rgba(255,255,255,0.85)' }}
                    >
                      {f.titulo}
                    </div>
                    <p className="text-sm leading-relaxed font-light" style={{ color: 'rgba(255,255,255,0.38)' }}>
                      {f.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── BEFORE / AFTER ─────────────────────────────────────────────────── */}
      <section
        className="py-28 px-6"
        style={{ borderTop: `1px solid ${W6}`, borderBottom: `1px solid ${W6}`, backgroundColor: 'rgba(12,18,33,0.5)' }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: AMBER }}>Transformação</div>
            <h2
              className="text-4xl sm:text-5xl font-bold"
              style={{ fontFamily: "'Playfair Display', serif", color: '#f0f4ff' }}
            >
              Antes e depois.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SEM */}
            <div className="rounded-2xl p-8" style={{ border: '1px solid rgba(239,68,68,0.12)', backgroundColor: 'rgba(239,68,68,0.04)' }}>
              <div className="flex items-center gap-2.5 mb-8">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-sm font-semibold" style={{ color: 'rgba(239,68,68,0.75)' }}>Sem OnWay</span>
              </div>
              <div className="space-y-5">
                {[
                  ['Portaria',    'Porteiro anota em caderno. Morador liga para saber se chegou.'],
                  ['Comunicados','Mensagem perdida no WhatsApp entre memes e figurinhas.'],
                  ['Assembleia', 'Impressão, folha de presença, ata manuscrita.'],
                  ['Acessos',    'Morador liga para a portaria liberar cada visita.'],
                  ['Ocorrências','Mensagem no WhatsApp. Ninguém sabe o status.'],
                ].map(([tit, desc]) => (
                  <div key={tit} className="flex gap-4">
                    <div className="text-[11px] font-semibold w-20 shrink-0 pt-px" style={{ color: 'rgba(239,68,68,0.4)' }}>{tit}</div>
                    <div className="text-sm font-light leading-relaxed" style={{ color: 'rgba(255,255,255,0.32)' }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* COM */}
            <div className="rounded-2xl p-8" style={{ border: `1px solid ${AMBER15}`, backgroundColor: AMBER8 }}>
              <div className="flex items-center gap-2.5 mb-8">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: AMBER }} />
                <span className="text-sm font-semibold" style={{ color: 'rgba(232,168,56,0.8)' }}>Com OnWay</span>
              </div>
              <div className="space-y-5">
                {[
                  ['Portaria',    'App registra e notifica o morador na hora. Zero ligação.'],
                  ['Comunicados','Publicado no mural. Todos recebem e confirmam leitura.'],
                  ['Assembleia', 'Votação online, quórum automático, ata em PDF assinada.'],
                  ['Acessos',    'Morador autoriza pelo app. Portaria libera com um toque.'],
                  ['Ocorrências','Abertura, acompanhamento e encerramento com histórico.'],
                ].map(([tit, desc]) => (
                  <div key={tit} className="flex gap-4">
                    <div className="text-[11px] font-semibold w-20 shrink-0 pt-px" style={{ color: 'rgba(232,168,56,0.5)' }}>{tit}</div>
                    <div className="text-sm font-light leading-relaxed" style={{ color: 'rgba(255,255,255,0.58)' }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              to="/comecar"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold transition hover:brightness-110"
              style={{ backgroundColor: AMBER, color: NAVY }}
            >
              Quero o depois →
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────── */}
      <section id="como-funciona" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: AMBER }}>Como funciona</div>
            <h2
              className="text-4xl sm:text-5xl font-bold"
              style={{ fontFamily: "'Playfair Display', serif", color: '#f0f4ff' }}
            >
              Pronto no mesmo dia.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {/* Connector line */}
            <div
              className="hidden md:block absolute top-8 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px"
              style={{ borderTop: `1px dashed rgba(232,168,56,0.18)` }}
            />

            {[
              { n: '1', titulo: 'Cadastre o condomínio', desc: 'Crie sua conta, configure o condomínio e personalize em menos de 5 minutos. Sem instalação, sem técnico.' },
              { n: '2', titulo: 'Convide sua equipe',    desc: 'Adicione síndico, portaria e moradores. Cada perfil acessa exatamente o que precisa, nada mais.' },
              { n: '3', titulo: 'Use no mesmo dia',      desc: 'Sem implantação longa, sem treinamento. Interface intuitiva que funciona em qualquer celular ou computador.' },
            ].map((s) => (
              <div key={s.n}>
                <div
                  className="text-7xl font-black leading-none mb-6"
                  style={{ fontFamily: "'Playfair Display', serif", color: 'rgba(232,168,56,0.14)' }}
                >
                  {s.n}
                </div>
                <h3 className="text-base font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.88)' }}>{s.titulo}</h3>
                <p className="text-sm font-light leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANOS ─────────────────────────────────────────────────────────── */}
      <section
        id="planos"
        className="py-28 px-6"
        style={{ borderTop: `1px solid ${W6}`, borderBottom: `1px solid ${W6}`, backgroundColor: 'rgba(12,18,33,0.5)' }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: AMBER }}>Planos</div>
            <h2
              className="text-4xl sm:text-5xl font-bold mb-4"
              style={{ fontFamily: "'Playfair Display', serif", color: '#f0f4ff' }}
            >
              Preço justo, sem surpresas.
            </h2>
            <p className="text-sm font-light" style={{ color: 'rgba(255,255,255,0.32)' }}>
              Todos com 10 dias grátis. Cancele quando quiser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANOS.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl p-8 flex flex-col transition-transform hover:scale-[1.01]"
                style={p.destaque
                  ? { border: `1px solid ${AMBER15}`, backgroundColor: AMBER8 }
                  : { border: `1px solid ${W8}`,  backgroundColor: 'rgba(12,18,33,0.6)' }
                }
              >
                {p.destaque && (
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] mb-5" style={{ color: AMBER }}>
                    Mais popular
                  </div>
                )}
                <div className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{p.nome}</div>
                <div className="flex items-end gap-1 mb-1">
                  <span
                    className="text-4xl font-bold"
                    style={{ fontFamily: "'Playfair Display', serif", color: '#f0f4ff' }}
                  >
                    R$ {p.preco.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-sm pb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>/mês</span>
                </div>
                <div className="text-xs mb-7" style={{ color: 'rgba(255,255,255,0.22)' }}>{p.limite}</div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm font-light" style={{ color: 'rgba(255,255,255,0.48)' }}>
                      <span className="shrink-0 mt-px text-xs" style={{ color: p.destaque ? AMBER : 'rgba(255,255,255,0.22)' }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/comecar"
                  className="block text-center py-3 rounded-xl text-sm font-semibold transition hover:brightness-110"
                  style={p.destaque
                    ? { backgroundColor: AMBER, color: NAVY }
                    : { border: `1px solid ${W12}`, color: 'rgba(255,255,255,0.45)' }
                  }
                >
                  Começar grátis
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Precisa de algo personalizado?{' '}
              <a href="mailto:contato@onway.com.br" style={{ color: 'rgba(232,168,56,0.65)' }} className="hover:text-[#e8a838] transition-colors">
                Fale com a gente.
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: AMBER }}>FAQ</div>
            <h2
              className="text-4xl sm:text-5xl font-bold"
              style={{ fontFamily: "'Playfair Display', serif", color: '#f0f4ff' }}
            >
              Dúvidas frequentes.
            </h2>
          </div>

          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden transition-colors"
                style={{ border: `1px solid ${faqAberto === i ? 'rgba(232,168,56,0.2)' : W6}` }}
              >
                <button
                  onClick={() => setFaqAberto(faqAberto === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.78)' }}>{faq.q}</span>
                  <span
                    className="shrink-0 text-lg font-light transition-transform"
                    style={{ color: AMBER, transform: faqAberto === i ? 'rotate(45deg)' : 'none' }}
                  >
                    +
                  </span>
                </button>
                {faqAberto === i && (
                  <div
                    className="px-6 pb-5 text-sm font-light leading-relaxed"
                    style={{ color: 'rgba(255,255,255,0.35)', borderTop: `1px solid ${W6}` }}
                  >
                    <div className="pt-4">{faq.a}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="relative py-28 px-6 overflow-hidden" style={{ borderTop: `1px solid ${W6}` }}>
        {/* Amber top line */}
        <div
          className="absolute top-0 inset-x-0 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${AMBER}, transparent)`, opacity: 0.35 }}
        />
        {/* Amber radial */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 55% 45% at 50% 0%, rgba(232,168,56,0.07) 0%, transparent 70%)` }}
        />

        <div className="relative max-w-3xl mx-auto text-center">
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            style={{ fontFamily: "'Playfair Display', serif", color: '#f0f4ff' }}
          >
            Seu condomínio<br />
            merece <em style={{ fontStyle: 'italic', color: AMBER }}>ordem.</em>
          </h2>
          <p className="text-lg mb-10 font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Comece hoje com 10 dias grátis. Sem cartão, sem compromisso.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/comecar"
              className="w-full sm:w-auto px-10 py-4 rounded-xl font-bold text-base transition hover:brightness-110"
              style={{ backgroundColor: AMBER, color: NAVY }}
            >
              Criar conta grátis →
            </Link>
            <a
              href="mailto:contato@onway.com.br"
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-medium text-base transition"
              style={{ border: `1px solid ${W12}`, color: 'rgba(255,255,255,0.38)' }}
            >
              Falar com a equipe
            </a>
          </div>
          <p className="text-xs mt-8" style={{ color: 'rgba(255,255,255,0.18)' }}>
            10 dias grátis · Cancele quando quiser · Dados criptografados
          </p>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6" style={{ borderTop: `1px solid ${W6}` }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Logo size={26} />
            <div>
              <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>OnWay Condomínio</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>Gestão condominial com precisão</div>
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm" style={{ color: 'rgba(255,255,255,0.22)' }}>
            <a href="#funcionalidades" className="hover:text-white/60 transition">Funcionalidades</a>
            <a href="#planos"          className="hover:text-white/60 transition">Planos</a>
            <Link to="/termos"         className="hover:text-white/60 transition">Termos</Link>
            <Link to="/privacidade"    className="hover:text-white/60 transition">Privacidade</Link>
            <a href="mailto:contato@onway.com.br" className="hover:text-white/60 transition">Contato</a>
          </nav>

          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
            © {new Date().getFullYear()} OnWay. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
