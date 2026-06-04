import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { useAuth } from '../components/AuthProvider'

interface FAQ {
  q: string
  a: string
  paraQuem?: ('gestor' | 'morador' | 'portaria')[]
}

const FAQS: FAQ[] = [
  {
    q: 'Como cadastro um novo morador?',
    a: 'Em Pessoas, clique em "+ Novo". Preencha nome, CPF, e-mail e vínculo com a unidade. Para liberar acesso ao app, marque "Convidar por e-mail" — a pessoa recebe um link de cadastro de senha. Para muitos moradores de uma vez, use "Importar em massa" no topo da tela com uma planilha XLSX.',
    paraQuem: ['gestor'],
  },
  {
    q: 'Como funciona a análise de IA das ocorrências?',
    a: 'Toda ocorrência cadastrada é analisada automaticamente em segundo plano. A IA cruza a descrição com o regimento do condomínio (RAG via embeddings), considera o histórico da unidade e sugere se cabe multa, qual artigo se aplica, valor sugerido e minuta. Você sempre decide o desfecho — a IA não aplica multas sozinha. Ela cita literalmente trechos do regimento para justificar.',
    paraQuem: ['gestor'],
  },
  {
    q: 'O regimento subiu mas não gerou artigos. O que faço?',
    a: 'O sistema tenta primeiro extrair pelo padrão "Art. 1", "Artigo 1°" via regex. Se não encontrar, usa IA como fallback. Os dois casos comuns de falha: (1) PDF escaneado sem OCR — rode o PDF em ilovepdf.com ou Adobe primeiro; (2) formato muito diferente — tente subir como tipo Modelo em vez de Regimento, ou cadastre artigos manualmente em /regimento.',
    paraQuem: ['gestor'],
  },
  {
    q: 'Como envio um comunicado oficial?',
    a: 'Acesse Comunicados → "+ Novo comunicado". Descreva em poucas linhas o que precisa avisar. O agente IA gera o texto polido seguindo o modelo padrão do condomínio. Você revisa, pode editar, baixa o PDF e dispara o envio por e-mail a todos os moradores ativos com 1 clique.',
    paraQuem: ['gestor'],
  },
  {
    q: 'Como autorizo um visitante?',
    a: 'Em Acessos autorizados → "+ Liberar acesso". Escolha o tipo (visitante, prestador, entregador etc.), informe nome e documento, defina a vigência (só hoje, data específica, período, sem prazo ou recorrente). A portaria recebe a autorização e libera quando a pessoa chegar. Você pode receber push quando a portaria registrar a entrada.',
    paraQuem: ['morador'],
  },
  {
    q: 'Posso contestar uma multa?',
    a: 'Sim. Na sua multa, clique em "Contestar". Você abre uma conversa direta com a administração no chat interno. Toda interação fica registrada para auditoria. O síndico pode responder, ajustar o valor ou cancelar a multa após análise.',
    paraQuem: ['morador'],
  },
  {
    q: 'Como mudo de condomínio sem precisar sair?',
    a: 'Se você atua em mais de um condomínio, vá em Meu perfil. Na seção "Meus condomínios" aparecem todos os seus vínculos. Clique em "Acessar" no condomínio desejado — o app recarrega com o tema, dados e permissões dele. O administrador OnWay vincula você a um segundo condomínio sem precisar de novo cadastro.',
  },
  {
    q: 'Como funciona a tela de login personalizada do condomínio?',
    a: 'Cada condomínio tem um slug único (ex.: jardim-paulista). Os moradores acessam pelo link onwaytech.com.br/c/<slug>/entrar, que aplica logo, cor primária, mensagem e imagem de fundo definidos no cadastro. Quando o DNS wildcard estiver configurado, o subdomínio jardim-paulista.onwaytech.com.br também passa a funcionar automaticamente.',
    paraQuem: ['gestor'],
  },
  {
    q: 'Como faço para receber notificações no celular?',
    a: 'Vá em Meu perfil → Segurança e ative "Notificações por push". Você receberá avisos de nova multa, encomenda chegando, votação aberta, evento se aproximando e comunicado importante. Funciona em desktop e mobile via Web Push (sem precisar instalar app).',
  },
  {
    q: 'Como crio uma enquete rápida no mural?',
    a: 'Em "+ Nova publicação", marque "Adicionar enquete". Defina a pergunta (opcional) e 2 a 4 opções. Os moradores votam diretamente no card da publicação e veem o resultado em tempo real com barras de porcentagem. Útil para decisões rápidas que não precisam de assembleia.',
    paraQuem: ['gestor'],
  },
  {
    q: 'O que é um story de 24h?',
    a: 'Publicação que some automaticamente após 24h. Ideal para avisos rápidos do tipo "água vai faltar hoje 14h-16h" ou "entrada lateral fechada por reforma". Marque "Story" ao criar a publicação. Você pode ter um story e um post fixado ao mesmo tempo, mas não os dois no mesmo card.',
    paraQuem: ['gestor'],
  },
  {
    q: 'A portaria pode abrir ocorrências e chamados?',
    a: 'Sim. O perfil Portaria registra encomendas (função principal), libera acessos autorizados, abre ocorrências e abre chamados de manutenção. Não consegue aplicar multas nem ver dados de outras unidades além das ocorrências que registra.',
    paraQuem: ['portaria', 'gestor'],
  },
  {
    q: 'Como funciona a triagem automática de prioridade dos chamados?',
    a: 'Ao abrir um chamado com prioridade média (padrão), a IA Haiku analisa o título, descrição e categoria em segundo plano e ajusta para baixa, alta ou urgente. Critérios: urgente = risco imediato (gás, choque, alagamento); alta = afeta uso essencial (elevador parado); média = incômodo significativo; baixa = cosmético. Se você escolher a prioridade manualmente, ela é respeitada.',
    paraQuem: ['gestor'],
  },
  {
    q: 'Quem pode excluir um condomínio definitivamente?',
    a: 'Apenas o administrador OnWay (equipe interna). O síndico ou administradora consegue arquivar (oculta da operação preservando os dados). Só o admin OnWay pode restaurar ou apagar de vez. A exclusão definitiva remove todos os usuários do condomínio, todas as multas, ocorrências, pessoas, encomendas, mural, chat. Ação irreversível.',
    paraQuem: ['gestor'],
  },
  {
    q: 'O resumo executivo mensal é automático?',
    a: 'Sim. No primeiro dia útil de cada mês, às 09h UTC, o sistema gera um e-mail para síndico, subsíndico e administradora com KPIs do mês anterior (ocorrências, multas, chamados, e-mails, mural) e um resumo textual em 3 parágrafos gerado por IA, destacando pontos de atenção e recomendações.',
    paraQuem: ['gestor'],
  },
]

export default function Help() {
  const { perfil } = useAuth()
  const [busca, setBusca] = useState('')
  const [abertaIdx, setAbertaIdx] = useState<number | null>(null)

  const role = perfil?.role
  const meuPerfilEscopo: 'gestor' | 'morador' | 'portaria' | null =
    role === 'morador' ? 'morador'
    : role === 'portaria' || role === 'ronda' ? 'portaria'
    : role && ['admin_onway','administradora','sindico','subsindico','conselheiro'].includes(role) ? 'gestor'
    : null

  const filtradas = FAQS.filter((f) => {
    const matchBusca = !busca.trim()
      || f.q.toLowerCase().includes(busca.toLowerCase())
      || f.a.toLowerCase().includes(busca.toLowerCase())
    const matchPerfil = !f.paraQuem || !meuPerfilEscopo || f.paraQuem.includes(meuPerfilEscopo)
    return matchBusca && matchPerfil
  })

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      <PageHeader
        title="Ajuda"
        subtitle="Perguntas frequentes sobre o OnWay Condomínio."
        actions={
          <Link to="/">
            <Button variant="ghost">← Voltar</Button>
          </Link>
        }
      />

      <div className="mb-6">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar na ajuda..."
          className="w-full h-10 px-4 rounded-lg bg-slate-950/60 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {filtradas.length === 0 ? (
        <div className="text-sm text-slate-500 italic text-center py-8">
          Nenhuma pergunta encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((f, i) => {
            const aberta = abertaIdx === i
            return (
              <div
                key={i}
                className={`rounded-lg border bg-slate-900/40 transition ${
                  aberta ? 'border-brand-500/40' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setAbertaIdx(aberta ? null : i)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
                >
                  <span className="text-sm font-medium text-slate-100">{f.q}</span>
                  <span className="text-slate-500 text-lg shrink-0">{aberta ? '−' : '+'}</span>
                </button>
                {aberta && (
                  <div className="px-4 pb-4 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                    {f.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-10 rounded-lg border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-400">
        <div className="text-slate-200 font-medium mb-2">Não encontrou o que procurava?</div>
        <p>
          Fale com a administração do seu condomínio pelo chat interno, ou envie um e-mail para o
          suporte do OnWay com o assunto da dúvida. Estamos sempre adicionando novas respostas
          a partir do que aparece no dia a dia.
        </p>
      </div>
    </div>
  )
}
