# AQC — MEU TERREIRO V0.4.6.4 · ESTABILIZAÇÃO

## Score automatizado: 100%
## Sintaxe JavaScript: ✅ OK
## Testes funcionais de valores/data: ✅ OK

## Testes executados
- ✅ Versão V0.4.6.4
- ✅ money converte centavos para reais
- ✅ todayISO usa data local
- ✅ Marca lateral MEU TERREIRO
- ✅ Marca visível CASA DE AXÉ removida
- ✅ Busca com debounce
- ✅ Busca Financeiro preserva foco
- ✅ Busca Mensalidades preserva foco
- ✅ Busca Estoque preserva foco
- ✅ Busca Fornecedores preserva foco
- ✅ Busca Documentos preserva foco
- ✅ Busca Eventos preserva foco
- ✅ Busca Filhos preserva foco
- ✅ Imagens internas preservadas
- ✅ todayHero/Hoje preservado
- ✅ PDF custom footer preservado
- ✅ Cotações preservadas
- ✅ Plano PRO preservado
- ✅ Cache atualizado

## Casos monetários validados
- ✅ `150,00` → 15000 centavos → `R$ 150,00`
- ✅ `1.250,50` → 125050 centavos → `R$ 1.250,50`
- ✅ Nenhuma migração destrutiva dos valores existentes

## Datas
- ✅ Função base usa ano/mês/dia locais do dispositivo, e não `toISOString()` UTC.
- ✅ Caso noturno local validado em teste unitário.

## Buscas
- ✅ Renderização das buscas desacoplada da digitação imediata.
- ✅ Reposição programática de foco e cursor após atualização.

## Integridade
- Arquivos ausentes em relação à V0.4.6.3: 0
- Imagens embutidas antes/depois: 8/8
- Gerador PRO não alterado.
- Estrutura de dados não migrada de forma destrutiva.

## Validação manual recomendada no aparelho
- Criar uma despesa de R$ 150,00 e confirmar tela + PDF.
- Abrir o app após 21h e confirmar a data do dia.
- Digitar uma palavra inteira nas buscas sem o teclado/foco sumir.