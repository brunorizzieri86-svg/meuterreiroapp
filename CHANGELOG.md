# MEU TERREIRO — V0.4.6.4 · ESTABILIZAÇÃO

## Financeiro — correção monetária crítica
- O app já armazenava valores corretamente em centavos.
- Corrigida a função de exibição `money()`.
- Exemplo validado:
  - digitado: `150,00`
  - armazenado: `15000` centavos
  - exibido agora: `R$ 150,00`
- A correção alcança telas e relatórios que usam a função monetária central.
- Nenhum lançamento existente é multiplicado, dividido ou migrado no banco.

## Datas
- `todayISO()` deixou de depender de UTC.
- A data atual passa a ser calculada pelo calendário local do aparelho.
- Evita avanço indevido de data no período noturno do Brasil.

## Marca
- Corrigido o texto legado `CASA DE AXÉ` visível na barra lateral.
- Agora exibe `MEU TERREIRO`.
- Nomes técnicos internos do banco não foram renomeados para não arriscar compatibilidade de dados.

## Buscas
- Corrigida perda de foco durante digitação.
- Aplicado a:
  - Filhos da Casa
  - Financeiro
  - Mensalidades
  - Estoque
  - Fornecedores
  - Documentos
  - Eventos/Agenda
- Adicionado debounce curto de 90 ms para reduzir renderizações desnecessárias.
- Campo recebe o foco e posição do cursor novamente após a atualização da lista.

## Preservado
- Todas as imagens internas.
- Home/Hoje.
- Estoque & Compras.
- Cotações.
- PDFs e dados extras da Casa.
- Plano PRO, 30 dias grátis e gerador de códigos.
