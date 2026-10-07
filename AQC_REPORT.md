# AQC — MEU TERREIRO V0.4.9.2

## Score automatizado: 100%
## JavaScript: ✅ sintaxe validada
## Teste funcional (DOM simulado): ✅ sem erros

## Verificações
- ✅ version
- ✅ imagens_preservadas
- ✅ pro_preservado
- ✅ demo_safe_preservado
- ✅ termos_preservados
- ✅ pdf_footer_preservado
- ✅ agendar_atendimento
- ✅ atendimento_presencial_endereco
- ✅ atendimento_online_link
- ✅ atendimento_registrado_agenda
- ✅ convite_gira_fila
- ✅ convite_marcacao_enviados
- ✅ consulente_quer_convite
- ✅ atalhos_pessoas_agenda_comunicacao
- ✅ mensalista
- ✅ agenda_degrade
- ✅ layout_desktop_celular

## Testes executados
- Agendamento presencial: evento criado na Agenda com o consulente vinculado; mensagem de WhatsApp com data, dia da semana, horário e endereço.
- Agendamento online: campo de endereço some e o de link aparece; mensagem sem link avisa que o link será criado e enviado; com link, o link vai na mensagem.
- Convite de gira: fila abre um WhatsApp por clique, marca quem já foi, bloqueia o botão ao terminar; "Limpar marcações" e desmarcar pessoas atualizam a contagem.
- Quem não tem WhatsApp ou não quer convites fica fora da fila; o campo "quer receber convites" é salvo no cadastro.
- Telas de Pessoas, Ficha, Agenda e Comunicação renderizam com os novos atalhos.

## Observações
- O WhatsApp abre uma conversa por clique (limite do próprio WhatsApp/navegador); o app não envia mensagens sozinho.
- Para o endereço sair automático, preencha Configurações → Dados da Casa.
- Faça backup antes de instalar por cima da versão anterior. Teste visual no desktop e no celular.

## Integridade
- Nenhuma imagem interna removida. Plano PRO e gerador preservados.
- Item 6 ainda não iniciado.
