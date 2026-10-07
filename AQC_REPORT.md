# AQC — MEU TERREIRO V0.4.9.8

## Verificações executadas
- JavaScript completo: `node --check`, aprovado.
- Testes das funções reais em Node com DOM/persistência simulados: aprovados.
- Datas impossíveis (31/02, 29/02 em ano não bissexto) rejeitadas; 29/02/2028 aceito.
- Dia 32 rejeitado; dia 31 ajustado para 28/02/2026 e 29/02/2028.
- Salvar/editar cadastro preserva vencimento, valor, motivo e forma preferida.
- Formulário reaberto inclui a data e o motivo salvos.
- Convidado com pagamento avulso aceito; cadastro sem lançamento automático.
- Pré-preenchimento financeiro: pessoa, valor, motivo, forma, vencimento e status Pendente.
- Registro recebido de mensalidade usa data de recebimento separada do vencimento.
- Pagamento recebido reconhecido no controle da competência.
- Avulso sem valor não herda o valor padrão da mensalidade.
- Imagens internas idênticas às da entrada; arquivos exigidos pelo cache incluídos.

## Limitações da verificação
Não foi possível executar Chromium neste ambiente (navegador indisponível e download não utilizável). Layout responsivo, interação visual completa, instalação PWA e restauração de backup não foram testados nesta atualização. Não se atribui score global de 100% nem aprovação visual sem evidência.

## Uso
Faça backup antes da atualização. Os vencimentos antigos ficam sem dia/data definido até serem preenchidos; os registros anteriores não são apagados. As cobranças são registradas manualmente pelo Financeiro. O cadastro avulso mostra a data de vencimento de referência; o status do pagamento deve ser consultado no Financeiro.
