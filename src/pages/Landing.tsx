import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'

// ─── Palette ──────────────────────────────────────────────────────────────────
const NAVY   = '#080d1a'
const AMBER  = '#e8a838'
const AMBER8 = 'rgba(232,168,56,0.08)'
const AMBER15= 'rgba(232,168,56,0.15)'
const W6  = 'rgba(255,255,255,0.06)'
const W8  = 'rgba(255,255,255,0.08)'
const W12 = 'rgba(255,255,255,0.12)'

// ─── Data ─────────────────────────────────────────────────────────────────────
const FEATURES = [
  { n: '01', titulo: 'Portaria Digital',           desc: 'Controle de encomendas, visitas e acessos pelo celular. Chega de porteiro anotando em caderno.' },
  { n: '02', titulo: 'Comunicação Centralizada',   desc: 'Mural oficial, comunicados, chat e calendário em um único lugar. Fim dos grupos de WhatsApp.' },
  { n: '03', titulo: 'Assembleias Digitais',       desc: 'Votações com quórum automático e ata em PDF assinada digitalmente. Juridicamente válido.' },
  { n: '04', titulo: 'Acessos e Segurança',        desc: 'Moradores autorizam visitas pelo app. Histórico de entradas e saídas. Sem ligações para portaria.' },
  { n: '05', titulo: 'Ocorrências e Chamados',     desc: 'Registro, acompanhamento e encerramento com histórico completo e rastreável.' },
  { n: '06', titulo: 'Classificados e Comunidade', desc: 'Moradores anunciam itens, serviços e imóveis. Comunidade mais conectada.' },
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
  { q: 'Os moradores precisam instalar algum aplicativo?', a: 'Não. O OnWay Condomínio funciona direto no navegador, sem instalação obrigatória. Pode ser adicionado à tela inicial como PWA.' },
  { q: 'Como funciona o período de teste gratuito?',       a: '10 dias com acesso completo a todas as funcionalidades, sem cartão de crédito. Ao final você escolhe o plano ideal.' },
  { q: 'Os dados do condomínio são seguros?',              a: 'Sim. Infraestrutura Supabase com criptografia em trânsito e em repouso, backups diários e isolamento total entre condomínios via Row Level Security.' },
  { q: 'Funciona para condomínios de qualquer tamanho?',   a: 'Sim. Do condomínio de 10 unidades ao complexo com centenas de apartamentos. O plano Completo não tem limite de unidades.' },
  { q: 'Posso migrar dados do sistema atual?',             a: 'Sim. Importação de moradores, unidades e veículos via planilha. Nossa equipe auxilia na migração sem custo adicional durante o trial.' },
]

const TESTIMONIALS = [
  {
    initials: 'CM',
    nome: 'Carlos Mendes',
    cargo: 'Síndico',
    cond: 'Residencial das Palmeiras',
    texto: 'Antes eu passava horas tentando organizar reclamações no WhatsApp. Com o OnWay encerro tudo pelo app e o histórico fica registrado. Mudou completamente.',
  },
  {
    initials: 'AP',
    nome: 'Ana Paula Lima',
    cargo: 'Administradora',
    cond: 'Vista Verde Condomínios',
    texto: 'Administramos 8 condomínios e o OnWay nos deu controle total em um só lugar. A portaria parou de ligar a cada encomenda que chegava. Simples assim.',
  },
  {
    initials: 'RS',
    nome: 'Roberto Silva',
    cargo: 'Síndico',
    cond: 'Edifício Center Plaza',
    texto: 'A assembleia digital foi um divisor de águas. Quórum atingido em horas, ata gerada automaticamente. Nunca mais vou fazer assembleia presencial desnecessária.',
  },
]

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

function useCounter(target: number, duration = 1300, active = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 4)
      setVal(Math.round(ease * target))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [active, target, duration])
  return val
}

// ─── AnimatedSection ──────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '', style }: { children: ReactNode; delay?: number; className?: string; style?: React.CSSProperties }) {
  const { ref, inView } = useInView()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'none' : 'translateY(26px)',
        transition: `opacity 0.72s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.72s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Blueprint SVG ────────────────────────────────────────────────────────────
function BlueprintSVG() {
  const LINE = { stroke: 'white', strokeLinecap: 'round' as const }
  const draw = (delay: number, dashLen: number): React.CSSProperties => ({
    strokeDasharray: dashLen,
    strokeDashoffset: dashLen,
    animation: `lp-draw 1.2s cubic-bezier(0.4,0,0.2,1) forwards ${delay}s`,
  })
  const fadeLabel = (delay: number): React.CSSProperties => ({
    opacity: 0,
    animation: `lp-fade-in 0.5s ease forwards ${delay}s`,
  })

  return (
    <svg viewBox="0 0 400 480" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <g strokeWidth="1.5" {...LINE}>
        {/* Outer walls */}
        <rect x="16" y="16" width="368" height="448" rx="2" style={draw(0.3, 1700)} />
        {/* Main vertical divider */}
        <line x1="220" y1="16" x2="220" y2="464" style={draw(1.1, 450)} />
        {/* Horizontal walls - left */}
        <line x1="16" y1="220" x2="220" y2="220" style={draw(1.4, 210)} />
        <line x1="16" y1="345" x2="220" y2="345" style={draw(1.6, 210)} />
        {/* Horizontal walls - right */}
        <line x1="220" y1="190" x2="384" y2="190" style={draw(1.8, 170)} />
        {/* Vertical walls - right */}
        <line x1="296" y1="190" x2="296" y2="464" style={draw(2.0, 280)} />
        {/* Door arcs */}
        <path d="M 220 245 A 25 25 0 0 0 195 220" strokeWidth="1" style={draw(2.2, 60)} />
        <path d="M 220 140 A 25 25 0 0 1 245 165" strokeWidth="1" style={draw(2.3, 60)} />
      </g>
      {/* Dimension lines */}
      <g strokeWidth="0.5" strokeDasharray="3 5" {...LINE}>
        <line x1="5" y1="16" x2="5" y2="464" style={fadeLabel(2.5)} />
        <line x1="16" y1="5" x2="384" y2="5" style={fadeLabel(2.5)} />
      </g>
      {/* Compass rose */}
      <g style={fadeLabel(2.8)} stroke="white" strokeWidth="1">
        <line x1="370" y1="450" x2="370" y2="440" />
        <line x1="365" y1="445" x2="375" y2="445" />
        <text x="370" y="437" fill="white" fillOpacity="0.6" fontSize="7" textAnchor="middle"
          fontFamily="'DM Sans', sans-serif" letterSpacing="0.05em">N</text>
      </g>
      {/* Room labels */}
      <g fill="white" fillOpacity="0.55" fontFamily="'DM Sans', sans-serif" fontSize="8.5" letterSpacing="0.16em">
        <text x="108" y="118" textAnchor="middle" style={fadeLabel(2.3)}>SALA</text>
        <text x="108" y="286" textAnchor="middle" style={fadeLabel(2.4)}>COZINHA</text>
        <text x="108" y="400" textAnchor="middle" style={fadeLabel(2.5)}>SERV.</text>
        <text x="296" y="100" textAnchor="middle" style={fadeLabel(2.4)}>QUARTO 1</text>
        <text x="252" y="330" textAnchor="middle" style={fadeLabel(2.5)}>Q. 2</text>
        <text x="338" y="330" textAnchor="middle" style={fadeLabel(2.6)}>BWC</text>
      </g>
    </svg>
  )
}

// ─── App Preview ──────────────────────────────────────────────────────────────
function AppPreview() {
  const activities = [
    { color: '#22c55e', label: 'Encomenda · Ap. 402',    sub: 'Aguardando retirada · agora'         },
    { color: AMBER,     label: 'Ocorrência · 3º andar',  sub: 'Barulho após meia-noite · 2h atrás'  },
    { color: '#6366f1', label: 'Assembleia marcada',      sub: '15/07 às 19h · Confirmado'            },
  ]

  return (
    <div style={{ perspective: '900px' }}>
      <div style={{ transform: 'rotateX(5deg) rotateY(-4deg)', transformOrigin: 'center top' }}>
        <div className="rounded-2xl overflow-hidden shadow-2xl relative"
          style={{ border: `1px solid ${W12}`, backgroundColor: '#090e1c', boxShadow: '0 40px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05)' }}>

          {/* Browser chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3" style={{ backgroundColor: '#0b1020', borderBottom: `1px solid ${W6}` }}>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
            <div className="flex-1 mx-3 h-5 rounded text-[10px] font-mono flex items-center px-2"
              style={{ backgroundColor: W6, color: 'rgba(255,255,255,0.2)' }}>
              onwaycondominio.com
            </div>
          </div>

          {/* Layout */}
          <div className="flex" style={{ minHeight: '340px' }}>
            {/* Sidebar */}
            <div className="flex flex-col items-center py-5 gap-4" style={{ width: 52, backgroundColor: '#070c19', borderRight: `1px solid ${W6}` }}>
              {['■','▲','◆','●','▼'].map((ic, i) => (
                <div key={i} className="w-8 h-8 flex items-center justify-center rounded-lg text-[8px]"
                  style={{ color: i === 0 ? AMBER : 'rgba(255,255,255,0.18)', backgroundColor: i === 0 ? AMBER8 : 'transparent' }}>
                  {ic}
                </div>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>Residencial Flores</div>
                  <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>Painel de controle</div>
                </div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: AMBER8, border: `1px solid ${AMBER15}` }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: AMBER }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-5">
                {[{ n: '3', l: 'Encomendas' }, { n: '1', l: 'Ocorrências' }, { n: '5', l: 'Avisos' }].map((s) => (
                  <div key={s.l} className="rounded-xl p-3" style={{ backgroundColor: W6, border: `1px solid ${W6}` }}>
                    <div className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.9)', fontFamily: "'Playfair Display', serif" }}>{s.n}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.l}</div>
                  </div>
                ))}
              </div>

              <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Atividade recente
              </div>
              {activities.map((a) => (
                <div key={a.label} className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: `1px solid ${W6}` }}>
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

        {/* Floating status badge */}
        <div className="absolute -bottom-4 -right-3 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xl"
          style={{ backgroundColor: '#0c1221', border: `1px solid ${W8}`, color: 'rgba(255,255,255,0.65)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Sistema operacional
        </div>
      </div>
    </div>
  )
}

// ─── Metrics (with counter animation) ────────────────────────────────────────
function MetricsStrip() {
  const { ref, inView } = useInView(0.4)
  const c10 = useCounter(10, 1100, inView)
  const c5  = useCounter(5,  800,  inView)
  const serif = { fontFamily: "'Playfair Display', serif" }

  return (
    <div ref={ref} style={{ borderTop: `1px solid ${W6}`, borderBottom: `1px solid ${W6}`, backgroundColor: 'rgba(12,18,33,0.6)' }}>
      <div className="max-w-5xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {[
          { val: `${c10}`, suf: ' dias', label: 'de trial gratuito'     },
          { val: `${c5}`,  suf: ' min',  label: 'para configurar'       },
          { val: '100%',   suf: '',       label: 'online, sem instalação' },
          { val: 'Zero',   suf: '',       label: 'taxa de cancelamento'  },
        ].map((m) => (
          <div key={m.label}>
            <div className="text-3xl sm:text-4xl font-bold mb-1" style={{ ...serif, color: '#f0f4ff' }}>
              {m.val}<span style={{ color: AMBER, fontSize: '1.1rem' }}>{m.suf}</span>
            </div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sticky CTA ───────────────────────────────────────────────────────────────
function StickyCta({ show }: { show: boolean }) {
  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 transition-transform duration-500"
      style={{
        transform: show ? 'translateY(0)' : 'translateY(100%)',
        backgroundColor: 'rgba(8,13,26,0.92)',
        borderTop: `1px solid ${W8}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Logo size={22} />
          <span className="text-sm font-semibold hidden sm:block" style={{ color: 'rgba(255,255,255,0.55)' }}>
            OnWay Condomínio
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs hidden md:block" style={{ color: 'rgba(255,255,255,0.28)' }}>
            10 dias grátis · Sem cartão de crédito
          </span>
          <Link
            to="/comecar"
            className="px-5 py-2 rounded-lg text-sm font-bold transition hover:brightness-110"
            style={{ backgroundColor: AMBER, color: NAVY }}
          >
            Começar grátis →
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const [faqAberto, setFaqAberto] = useState<number | null>(null)
  const [menuOpen,  setMenuOpen]   = useState(false)
  const [scrolled,  setScrolled]   = useState(false)
  const [showCta,   setShowCta]    = useState(false)
  const [anual,     setAnual]      = useState(false)

  useEffect(() => {
    document.title = 'OnWay Condomínio — Gestão condominial com precisão'
    const onScroll = () => {
      setScrolled(window.scrollY > 48)
      setShowCta(window.scrollY > window.innerHeight * 0.85)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const serif = { fontFamily: "'Playfair Display', serif" }
  const price = (base: number) => anual ? Math.round(base * 0.8) : base

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
      <StickyCta show={showCta} />

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={scrolled ? { backgroundColor: 'rgba(8,13,26,0.9)', borderBottom: `1px solid ${W8}`, backdropFilter: 'blur(20px)' } : {}}
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
            <Link to="/entrar" className="text-sm px-3 py-1.5 hover:text-white transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Entrar
            </Link>
            <Link
              to="/comecar"
              className="px-5 py-2 text-sm font-semibold rounded-lg transition hover:brightness-110"
              style={{ border: `1px solid ${AMBER}`, color: AMBER }}
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
          <div className="md:hidden px-6 py-5 flex flex-col gap-4 text-sm"
            style={{ borderTop: `1px solid ${W8}`, backgroundColor: 'rgba(8,13,26,0.97)' }}>
            {[['#funcionalidades','Funcionalidades'],['#como-funciona','Como funciona'],['#planos','Planos'],['#faq','FAQ']].map(([h, l]) => (
              <a key={h} href={h} onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.45)' }}>{l}</a>
            ))}
            <hr style={{ borderColor: W8 }} />
            <Link to="/entrar" style={{ color: 'rgba(255,255,255,0.45)' }}>Entrar</Link>
            <Link to="/comecar" className="text-center py-2.5 rounded-lg font-semibold"
              style={{ border: `1px solid ${AMBER}`, color: AMBER }}>
              Começar grátis
            </Link>
          </div>
        )}
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Blueprint SVG — decorative, right half */}
        <div className="absolute right-0 top-0 bottom-0 pointer-events-none overflow-hidden hidden lg:block" style={{ width: '50%', opacity: 0.055 }}>
          <BlueprintSVG />
        </div>

        {/* Ambient glows */}
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(232,168,56,0.055) 0%, transparent 65%)' }} />

        <div className="max-w-6xl mx-auto px-6 py-24 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-center relative">
          {/* Left: copy */}
          <div className="lp-fade-up" style={{ animationDelay: '0s' }}>
            {/* Amber accent line */}
            <div className="w-10 h-0.5 mb-8 rounded-full" style={{ backgroundColor: AMBER }} />

            {/* Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-7"
              style={{ border: `1px solid rgba(232,168,56,0.25)`, backgroundColor: AMBER8, color: AMBER }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: AMBER }} />
              10 dias grátis · Sem cartão de crédito
            </div>

            {/* Headline */}
            <h1 className="text-5xl lg:text-6xl xl:text-[4.2rem] font-bold leading-[1.06] mb-6"
              style={{ ...serif, letterSpacing: '-0.02em', color: '#f0f4ff' }}>
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
              <Link to="/comecar" className="px-8 py-3.5 rounded-xl text-sm font-bold text-center transition hover:brightness-110"
                style={{ backgroundColor: AMBER, color: NAVY }}>
                Criar conta grátis →
              </Link>
              <Link to="/entrar" className="px-8 py-3.5 rounded-xl text-sm font-medium text-center transition"
                style={{ border: `1px solid ${W12}`, color: 'rgba(255,255,255,0.45)' }}>
                Já tenho conta
              </Link>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {['Sem contrato de fidelidade', 'Cancele quando quiser', 'Dados criptografados'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  <span style={{ color: AMBER }}>✓</span> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right: App Preview */}
          <div className="relative lp-fade-up hidden lg:block" style={{ animationDelay: '0.2s' }}>
            <AppPreview />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
          <span className="text-[9px] uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.15)' }}>scroll</span>
          <svg width="14" height="20" viewBox="0 0 14 22" fill="none" style={{ color: 'rgba(232,168,56,0.25)' }}>
            <rect x="4.5" y="1" width="5" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.2"/>
            <line x1="7" y1="4" x2="7" y2="6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
              style={{ animation: 'lp-bounce 1.6s ease-in-out infinite' }}/>
            <path d="M3 15l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-20 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, transparent, ${NAVY})` }} />
      </section>

      {/* ── METRICS ──────────────────────────────────────────────────────── */}
      <MetricsStrip />

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="funcionalidades" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal className="mb-20">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: AMBER }}>Funcionalidades</div>
            <h2 className="text-4xl sm:text-5xl font-bold leading-tight" style={{ ...serif, color: '#f0f4ff' }}>
              O que o OnWay resolve.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2">
            {FEATURES.map((f, i) => {
              const isLeft = i % 2 === 0
              const isLastRow = i >= FEATURES.length - 2
              return (
                <Reveal key={f.n} delay={i * 0.07}
                  style={{
                    borderBottom: isLastRow ? 'none' : `1px solid ${W6}`,
                    borderRight:  isLeft ? `1px solid ${W6}` : 'none',
                    paddingRight: isLeft ? '3rem' : '0',
                    paddingLeft:  isLeft ? '0' : '3rem',
                  } as React.CSSProperties}
                  className="group flex gap-6 py-9 cursor-default transition-colors"
                >
                  <div className="text-[3.2rem] font-black leading-none select-none shrink-0 transition-colors group-hover:text-[#e8a838]/20"
                    style={{ ...serif, color: 'rgba(255,255,255,0.048)' }}>
                    {f.n}
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.85)' }}>{f.titulo}</div>
                    <p className="text-sm leading-relaxed font-light" style={{ color: 'rgba(255,255,255,0.38)' }}>{f.desc}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── BEFORE / AFTER ───────────────────────────────────────────────── */}
      <section className="py-28 px-6" style={{ borderTop: `1px solid ${W6}`, borderBottom: `1px solid ${W6}`, backgroundColor: 'rgba(12,18,33,0.5)' }}>
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-16">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: AMBER }}>Transformação</div>
            <h2 className="text-4xl sm:text-5xl font-bold" style={{ ...serif, color: '#f0f4ff' }}>Antes e depois.</h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Reveal>
              <div className="rounded-2xl p-8 h-full" style={{ border: '1px solid rgba(239,68,68,0.12)', backgroundColor: 'rgba(239,68,68,0.04)' }}>
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
            </Reveal>

            <Reveal delay={0.1}>
              <div className="rounded-2xl p-8 h-full" style={{ border: `1px solid ${AMBER15}`, backgroundColor: AMBER8 }}>
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
            </Reveal>
          </div>

          <Reveal delay={0.15} className="mt-12 text-center">
            <Link to="/comecar" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold transition hover:brightness-110"
              style={{ backgroundColor: AMBER, color: NAVY }}>
              Quero o depois →
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="como-funciona" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-20">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: AMBER }}>Como funciona</div>
            <h2 className="text-4xl sm:text-5xl font-bold" style={{ ...serif, color: '#f0f4ff' }}>Pronto no mesmo dia.</h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-8 left-1/3 right-1/3 h-px" style={{ borderTop: `1px dashed rgba(232,168,56,0.18)` }} />
            {[
              { n: '1', titulo: 'Cadastre o condomínio', desc: 'Crie sua conta, configure e personalize em menos de 5 minutos. Sem instalação, sem técnico.' },
              { n: '2', titulo: 'Convide sua equipe',    desc: 'Adicione síndico, portaria e moradores. Cada perfil acessa exatamente o que precisa.' },
              { n: '3', titulo: 'Use no mesmo dia',      desc: 'Interface intuitiva que funciona em qualquer celular ou computador. Sem treinamento extenso.' },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 0.12}>
                <div className="text-7xl font-black leading-none mb-6" style={{ ...serif, color: 'rgba(232,168,56,0.14)' }}>{s.n}</div>
                <h3 className="text-base font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.88)' }}>{s.titulo}</h3>
                <p className="text-sm font-light leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section className="py-28 px-6" style={{ borderTop: `1px solid ${W6}`, borderBottom: `1px solid ${W6}`, backgroundColor: 'rgba(12,18,33,0.5)' }}>
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-16">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: AMBER }}>Depoimentos</div>
            <h2 className="text-4xl sm:text-5xl font-bold" style={{ ...serif, color: '#f0f4ff' }}>Quem já usa.</h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.nome} delay={i * 0.1}>
                <div className="rounded-2xl p-7 flex flex-col h-full" style={{ border: `1px solid ${W8}`, backgroundColor: 'rgba(12,18,33,0.7)', borderLeft: `3px solid ${AMBER15}` }}>
                  {/* Open quote */}
                  <div className="text-7xl leading-none mb-3 select-none" style={{ ...serif, color: 'rgba(232,168,56,0.18)', lineHeight: '0.8' }}>"</div>

                  {/* Quote */}
                  <p className="text-sm font-light leading-relaxed flex-1 mb-7" style={{ color: 'rgba(255,255,255,0.52)' }}>
                    {t.texto}
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: AMBER8, border: `1px solid ${AMBER15}`, color: AMBER }}>
                      {t.initials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.78)' }}>{t.nome}</div>
                      <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{t.cargo} · {t.cond}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANOS ───────────────────────────────────────────────────────── */}
      <section id="planos" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-10">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: AMBER }}>Planos</div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4" style={{ ...serif, color: '#f0f4ff' }}>Preço justo, sem surpresas.</h2>
          </Reveal>

          {/* Toggle */}
          <Reveal className="flex items-center justify-center gap-4 mb-14">
            <span className="text-sm" style={{ color: !anual ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}>Mensal</span>
            <button
              onClick={() => setAnual(v => !v)}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ backgroundColor: anual ? AMBER : 'rgba(255,255,255,0.1)' }}
            >
              <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
                style={{ left: anual ? '1.375rem' : '0.125rem' }} />
            </button>
            <span className="text-sm" style={{ color: anual ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}>
              Anual{' '}
              <span className="text-[11px] font-semibold rounded-full px-2 py-0.5"
                style={{ backgroundColor: AMBER8, color: AMBER }}>
                -20%
              </span>
            </span>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLANOS.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.1}>
                <div className="rounded-2xl p-8 flex flex-col h-full transition-transform hover:scale-[1.015]"
                  style={p.destaque
                    ? { border: `1px solid ${AMBER15}`, backgroundColor: AMBER8 }
                    : { border: `1px solid ${W8}`, backgroundColor: 'rgba(12,18,33,0.6)' }
                  }>
                  {p.destaque && (
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] mb-4" style={{ color: AMBER }}>
                      Mais popular
                    </div>
                  )}
                  <div className="text-sm font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>{p.nome}</div>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-bold transition-all duration-300" style={{ ...serif, color: '#f0f4ff' }}>
                      R$ {price(p.preco).toLocaleString('pt-BR')}
                    </span>
                    <span className="text-sm pb-1" style={{ color: 'rgba(255,255,255,0.28)' }}>/mês</span>
                  </div>
                  {anual && (
                    <div className="text-[11px] mb-1" style={{ color: 'rgba(232,168,56,0.6)' }}>
                      Cobrado anualmente · economia de R$ {(p.preco * 12 - price(p.preco) * 12).toLocaleString('pt-BR')}/ano
                    </div>
                  )}
                  <div className="text-xs mb-7" style={{ color: 'rgba(255,255,255,0.22)' }}>{p.limite}</div>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm font-light" style={{ color: 'rgba(255,255,255,0.48)' }}>
                        <span className="shrink-0 mt-px text-xs" style={{ color: p.destaque ? AMBER : 'rgba(255,255,255,0.22)' }}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/comecar" className="block text-center py-3 rounded-xl text-sm font-semibold transition hover:brightness-110"
                    style={p.destaque
                      ? { backgroundColor: AMBER, color: NAVY }
                      : { border: `1px solid ${W12}`, color: 'rgba(255,255,255,0.45)' }
                    }>
                    Começar grátis
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1} className="mt-8 text-center">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Precisa de algo personalizado?{' '}
              <a href="mailto:contato@onway.com.br" className="transition-colors hover:text-[#e8a838]" style={{ color: 'rgba(232,168,56,0.6)' }}>
                Fale com a gente.
              </a>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-28 px-6" style={{ borderTop: `1px solid ${W6}`, backgroundColor: 'rgba(12,18,33,0.4)' }}>
        <div className="max-w-3xl mx-auto">
          <Reveal className="text-center mb-16">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: AMBER }}>FAQ</div>
            <h2 className="text-4xl sm:text-5xl font-bold" style={{ ...serif, color: '#f0f4ff' }}>Dúvidas frequentes.</h2>
          </Reveal>

          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <div className="rounded-xl overflow-hidden transition-colors"
                  style={{ border: `1px solid ${faqAberto === i ? 'rgba(232,168,56,0.2)' : W6}` }}>
                  <button onClick={() => setFaqAberto(faqAberto === i ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left">
                    <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.78)' }}>{faq.q}</span>
                    <span className="shrink-0 text-xl font-light transition-transform duration-200"
                      style={{ color: AMBER, transform: faqAberto === i ? 'rotate(45deg)' : 'none' }}>
                      +
                    </span>
                  </button>
                  <div style={{
                    maxHeight: faqAberto === i ? '200px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1)',
                  }}>
                    <div className="px-6 pb-5 text-sm font-light leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)', borderTop: `1px solid ${W6}` }}>
                      <div className="pt-4">{faq.a}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ────────────────────────────────────────────────────── */}
      <section className="relative py-28 px-6 overflow-hidden" style={{ borderTop: `1px solid ${W6}` }}>
        <div className="absolute top-0 inset-x-0 h-px"
          style={{ background: `linear-gradient(to right, transparent, ${AMBER}, transparent)`, opacity: 0.4 }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 0%, rgba(232,168,56,0.07) 0%, transparent 70%)' }} />

        <div className="relative max-w-3xl mx-auto text-center">
          <Reveal>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6"
              style={{ ...serif, color: '#f0f4ff' }}>
              Seu condomínio<br />
              merece <em style={{ fontStyle: 'italic', color: AMBER }}>ordem.</em>
            </h2>
            <p className="text-lg mb-10 font-light" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Comece hoje com 10 dias grátis. Sem cartão, sem compromisso.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/comecar" className="w-full sm:w-auto px-10 py-4 rounded-xl font-bold text-base transition hover:brightness-110"
                style={{ backgroundColor: AMBER, color: NAVY }}>
                Criar conta grátis →
              </Link>
              <a href="mailto:contato@onway.com.br" className="w-full sm:w-auto px-8 py-4 rounded-xl font-medium text-base transition"
                style={{ border: `1px solid ${W12}`, color: 'rgba(255,255,255,0.38)' }}>
                Falar com a equipe
              </a>
            </div>
            <p className="text-xs mt-8" style={{ color: 'rgba(255,255,255,0.18)' }}>
              10 dias grátis · Cancele quando quiser · Dados criptografados
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
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
