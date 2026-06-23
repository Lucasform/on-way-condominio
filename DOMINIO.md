# Domínio — OnWay Condomínio

> Conhecimento de domínio externalizado para a IA (o "moat" do cap. 6 do playbook).
> O Claude lê isto antes de implementar lógica de ocorrência, multa ou comunicação.
> Crítico para a IA não sugerir valores/decisões ilegais. **Lucas: adicione edge
> cases reais conforme aparecem.**

## Base legal (não inventar fora disso)

- **Lei 4.591/64** e **Código Civil arts. 1.331 a 1.358** regem condomínios.
- Hierarquia das regras: **lei > convenção do condomínio > regimento interno**.
  A IA deve citar o artigo do regimento, mas nunca sugerir algo que viole a lei.

## Multas (a IA gera minuta, humano decide)

- **Multa de mora (atraso de pagamento):** até **2%** sobre o valor da cobrança
  (CC art. 1.336 §1º). Juros de até 1% ao mês salvo convenção.
- **Condômino antissocial / infração de conduta:** multa de até **5x** o valor da
  contribuição mensal (CC art. 1.337); comportamento reiterado, até **10x**.
- A IA **nunca** aplica multa sozinha. Sempre minuta + revisão humana.
- A IA não deve sugerir valor acima do limite legal/convencional.

## Estrutura e governança

- **Fração ideal:** participação de cada unidade; base do rateio de despesas.
- **Taxa ordinária** (custeio mensal) x **extraordinária** (obras/eventos) x **fundo de reserva**.
- **Assembleia** (AGO/AGE) com quórum por tipo de decisão; gera ata.
- **Papéis:** síndico, subsíndico, conselho fiscal (mandato); administradora terceirizada.

## Responsabilidade (quem responde)

- Unidade pode ter **múltiplos proprietários**.
- **Locatário x proprietário:** dependendo da infração, a responsabilidade muda. O
  proprietário responde pela taxa; o locatário pode responder por uso de área comum.

## Multi-tenant

- Cada condomínio é isolado por `condominio_id` + RLS. Administradora vê só os seus.
  Visão consolidada é exclusiva do Administrador OnWay.

## Edge cases conhecidos (expandir sempre)

- Reincidência (a multa escala conforme histórico da unidade).
- Obras/reformas em unidade (NBR 16.280 exige projeto/responsável técnico).
- Animais, barulho (lei do silêncio), vagas de garagem, áreas comuns.
- Inadimplência: cobrança, negativação, restrição de uso de áreas (com cautela legal).
