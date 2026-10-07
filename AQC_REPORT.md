# AQC — MEU TERREIRO V0.4.9.5

## Score automatizado: 100%
## JavaScript: ✅ sintaxe validada
## Teste funcional (DOM simulado): ✅ sem erros
## Teste visual em navegador real (Chromium): ✅ tela de Frequência e chamada, desktop e celular

## Verificações
- ✅ version
- ✅ imagens_preservadas
- ✅ pro_preservado
- ✅ demo_safe_preservado
- ✅ termos_preservados
- ✅ pdf_footer_preservado
- ✅ chamada_status_4
- ✅ fazer_chamada_agenda_evento
- ✅ chamada_marcar_todos_busca_incluir
- ✅ relatorio_frequencia_pessoa_periodo_tipo
- ✅ pdf_relatorio_e_chamada
- ✅ meta_e_regras
- ✅ tipos_que_contam
- ✅ alerta_home_faltas_seguidas_meta_pendente
- ✅ whatsapp_sentimos_falta
- ✅ controlar_frequencia_mensalista
- ✅ config_frequencia
- ✅ mascaras
- ✅ barra_lateral_rolagem
- ✅ consulentes_atendimento
- ✅ layout_desktop_celular

## Testes executados
- Chamada: abrir pelo evento, marcar todos presentes, marcar falta/atraso, desfazer com segundo toque, busca, incluir outra pessoa, salvar; a pendência some.
- Relatório: % por pessoa, faltas seguidas (Carlos: 3 seguidas, 43%), alertas abaixo da meta, por tipo, filtros.
- Regras: meta alterada para 80%, falta justificada como neutra/presença/falta (cálculo muda: 43% → 38%), validação de meta inválida.
- Alertas na tela Inicial (chamada pendente, faltas seguidas, abaixo da meta).
- WhatsApp "Sentimos sua falta" com mensagem acolhedora; consulente fica fora da lista de frequência.
- PDFs: relatório, lista de chamada e ficha com frequência.
- Celular 390 px: sem rolagem horizontal; botões de status com 44 px de altura.

## Observações
- Defina a meta e como a falta justificada conta em Configurações → Frequência; o padrão é 75% e justificada neutra (não entra no cálculo).
- Compromissos antigos não têm chamada; o relatório começa a valer a partir das chamadas registradas.
- O WhatsApp abre uma conversa por clique; o app não envia mensagens sozinho.
- Faça backup antes de instalar por cima da versão anterior.

## Integridade
- Nenhuma imagem interna removida. Plano PRO e gerador preservados.
- Item 6 ainda não iniciado.
