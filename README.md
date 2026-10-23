# MEU TERREIRO — V0.6.1.0

Pacote de publicação para GitHub Pages.

## Publicação

Extraia o ZIP e envie o conteúdo para a raiz do repositório: index.html, manifest.json, sw.js, manual.html, assets/ e icons/. Preserve os nomes e as pastas. O aplicativo pode ser instalado quando servido por HTTPS. Para atualizar uma versão existente, faça backup no aplicativo antes de substituir os arquivos.

## Trabalhos Espirituais

- Desktop: menu lateral, abaixo de Festas & Eventos.
- Celular: botão Trabalhos na barra inferior. Estoque & Compras fica em Mais.
- Catálogo editável: mão e chão, bicho/item adicional e materiais.
- Orçamento para pessoa cadastrada ou destinatário avulso.
- Itens personalizados, quantidades, desconto, validade e vencimento.
- PDF com assinatura do aplicativo e WhatsApp com prévia.
- Anotação interna e checklist separados do conteúdo compartilhado.
- Agenda e cobrança financeira com confirmação e proteção contra duplicidade.

Cobranças geradas por "Gerar cobrança" começam Pendentes; o botão "Receber" lança o valor como Recebido no Financeiro. Alterar o catálogo não muda valores de orçamentos já salvos. Os nomes e serviços são definidos pelo responsável da casa.

## V0.6.1.0 · Terreiro Conectado, guia e painel de acessos
- Plano online renomeado para **Terreiro Conectado**.
- Botões "Quero assinar" abrem o WhatsApp (11) 95352-5141 com mensagens distintas: uma para o plano PRO (com ID do aparelho) e outra para o Terreiro Conectado; ambas dizem que vêm do app MEU TERREIRO.
- Nova tela **Como funciona o MEU TERREIRO** (seletor, login e cadastro).
- Convite de filhos/cambonos por um único link: a pessoa escolhe Filho(a) ou Cambono, cria a própria senha e aguarda aprovação.
- **Acessos & Nuvem** em abas: Convidar, Pessoas (Aprovar, Recusar, Desativar, Reativar, Remover, com filtros), Pagamentos, Avisos e orientações, Plano e sincronização.

## V0.6.0.3 · Telas de entrada mais claras
Seletor de módulos explica as duas formas de uso (somente neste aparelho, offline, ou **Terreiro Conectado**, online) e avisa que filhos, cambonos e consulentes dependem do convite do Pai/Mãe. Login do Pai/Mãe separa a Casa Conectada do modo offline (30 dias grátis). Cadastro explica o que é o cadastro e o código de liberação e oferece o modo offline sem código. Recuperação de senha informa que o link vai por e-mail. O nome do plano online fica na constante `MT_PLANO` e o WhatsApp para pedir código em `MT_CONTATO` (dentro do script `mt-cloud-js`). Novo `supabase/04_painel_dev.sql` (gerador privado de códigos, entregue à parte).

## V0.6.0.2 · Quatro módulos integrados

Novo na V0.6.0.2: **código de liberação** (uso único, gerado por você) para criar uma casa e **plano online por casa** com vencimento, aviso, suspensão e renovação por código. Rode também `supabase/03_liberacao.sql` (veja o passo 4-B do guia).

Correção V0.6.0.2: botão de mostrar senha funcionando; cadastro mostra qual campo está errado e como preencher; falha ao gravar no aparelho agora aparece na tela.

- Novo módulo **Consulentes**: autocadastro por link/código com aprovação do Pai/Mãe; vê giras abertas, avisos e as orientações/banhos enviados individualmente.
- **Agenda automática**: ao salvar no app, a agenda é publicada na nuvem sem botão.
- **Mensalidade com comprovante**: filho envia, Pai/Mãe valida (lança no Financeiro) e o filho é notificado.
- Convites por link no WhatsApp (QR Code fica para depois). Sem tela de configuração do Supabase para o usuário.
- Rodar no Supabase: `supabase/01_schema.sql` e depois `supabase/02_integracao.sql`. Cache do PWA: meuterreiro-v06000.

## Acessos por módulo e Supabase V0.5.0.0

Nova tela inicial de escolha do módulo: **Pai/Mãe da casa**, **Filhos da casa** e **Cambonos e apoio**, cada um com login e cadastro próprios (e-mail e senha, recuperação de senha por e-mail). Filhos e cambonos se cadastram com o **código da casa** e entram após a **aprovação** do Pai/Mãe.

- **Pai/Mãe**: continua com o app completo. Nova tela **Acessos & Nuvem** (menu lateral; no celular, Mais): código da casa, convite por WhatsApp, aprovar/desativar/remover pessoas, publicar a agenda e avisos.
- **Filhos**: portal com Início, Agenda (calendário), Avisos e Meu cadastro (edita os próprios dados e a senha).
- **Cambonos**: igual ao filho, com materiais e responsável dos eventos.
- Os dados administrativos (financeiro, trabalhos, estoque etc.) continuam locais no aparelho do Pai/Mãe. Na nuvem ficam só cadastros de acesso, agenda publicada e avisos.
- Sem Supabase configurado, o app abre o acesso local como nas versões anteriores.
- O acesso local (login e senha do aparelho) continua disponível em "Entrar com o acesso local deste aparelho".

Configuração: veja `SUPABASE_GUIA.md` e rode `supabase/01_schema.sql` no SQL Editor do Supabase. Preencha `MT_SUPABASE` no `index.html` com a URL e a chave **anon/publishable** (nunca a `service_role`). A pasta `supabase/` e o guia não são necessários na publicação do site.

O cache do PWA foi atualizado (meuterreiro-v05000) e chamadas a outros domínios deixam de ser guardadas em cache.

## Acesso e dados

Os recursos de acesso e plano PRO existentes foram mantidos. Os dados continuam locais ao aparelho; não há sincronização automática entre celular e computador. O catálogo e os trabalhos são incluídos nos dados de backup.

O gerador de códigos PRO não deve ser publicado junto com o aplicativo.

Os relatórios de mudanças e auditoria são entregues separadamente do ZIP de publicação.

## Atualização V0.4.10.2

Listas de categoria e pagamento padronizadas, com campo para opções próprias. Catálogo com busca, categorias, situação, ordenação e exibição compacta. DEMO preenchido neste módulo. Nova aba Financeiro → Trabalhos Espirituais, cobranças à vista ou até 24 parcelas mensais, atraso calculado pelo vencimento e PDF específico. Controle para incluir ou excluir o módulo e cada trabalho da prestação geral, sem remover lançamentos ou alterar saldos. Lembrete de pagamento por WhatsApp com prévia.

Os valores de materiais e bicho no orçamento não geram despesas automaticamente. Orçamentos não são recebimentos. Confirme cada recebimento no Financeiro, informando a data efetiva. O período do resumo usa a data dos lançamentos; a situação de pagamento considera o plano completo.

PDF: após salvar o trabalho, abra a ficha e escolha Gerar PDF / imprimir; na impressão, escolha Salvar como PDF. WhatsApp abre texto para confirmação; para enviar o arquivo PDF, anexe-o manualmente.

## Backup e Proteção V0.4.10.2

Backup completo com box de privacidade e escolha de destino: seletor nativo quando disponível, compartilhamento de arquivo no celular quando suportado e download como alternativa. O app informa separadamente solicitação, gravação e verificação; cancelar não conclui backup. Novos nomes têm horário e identificador.

Backup criptografado com senha própria (mínimo 10 caracteres), sem mudar o acesso local. Aceita o formato protegido antigo com PIN. Verificar arquivo não restaura dados. A restauração apresenta prévia, exige aceite e guarda estado anterior. Retenção: 7 diários, 4 semanais, 6 mensais, 3 manuais e 3 cópias anteriores. Inclusão de pontos no arquivo é opcional.

No Android, os destinos dependem do navegador e dos aplicativos instalados. Quando o app não puder abrir seletor ou compartilhar arquivo, baixe e mova a cópia pelo gerenciador de arquivos. Abra a publicação HTTPS para suporte completo. Guarde uma cópia fora do aparelho.

Excluir toda a conta também apaga pontos internos. Apagar dados operacionais mantém casa/acesso e cria uma cópia anterior. As ações têm aviso, frase de confirmação e aceite.

## Comunicação V0.4.10.3

Dez modelos com parágrafos reais e campos (.......), edição de mensagens salvas, revisão por destinatário e bloqueio de texto incompleto antes do WhatsApp. A data e a hora criam lembrete interno, sem envio automático. Convites de gira continuam usando preenchimento automático por consulente. Mensagens antigas são normalizadas na apresentação e só são substituídas ao salvar a edição.

## Trabalhos Espirituais V0.4.10.4

Ficha reorganizada: etapa e situação do pagamento com cores próprias, "Próximo passo" guiado, linha de etapas clicável e card Pagamento com parcelas. Botão **Receber** (Pix, dinheiro, débito, transferência ou crédito de 1x a 12x com juros opcionais) lança direto como Recebido no Financeiro, inclusive recebimento parcial; **Gerar cobrança** cria pendências futuras. Formulário de novo trabalho em 6 passos com explicações. Financeiro → Trabalhos Espirituais com filtros por situação e painel "Quem cobrar primeiro". Lançamentos do Financeiro geral passam a ter cor por situação (recebido, pendente, vence hoje, vencido, cancelado). O cache do PWA foi atualizado (meuterreiro-v04104).

## Agenda V0.4.11.0

Convidados e participantes em cada compromisso, com busca por nome ou telefone e atalhos para consulentes e filhos da casa. Botão **Avisar** em cada compromisso e **Avisar sobre este dia** no calendário: convite, lembrete ou aviso livre por WhatsApp, em fila "enviar e ir para o próximo", com barra de busca para incluir qualquer contato. Imagem do evento (PNG/JPG) ajustada para story 1080×1920, postagem 1080×1350 ou proporção original, guardada no compromisso e enviada pelo menu de compartilhar do celular (o link do WhatsApp não anexa imagem; sem suporte, a imagem é baixada). Lembretes aos convidados no dia, 1 ou 2 dias antes, com aviso na Agenda e no sino; o envio continua manual. O cache do PWA foi atualizado (meuterreiro-v04110).

## Tour, contatos e modelos V0.4.12.0

**Tour guiado:** convite ao abrir o app (Começar Tour, Vejo depois, Não aparecer novamente), janela para escolher o tour completo ou módulos específicos e destaque passo a passo dos botões de cada tela. Sempre disponível em Configurações → Tour guiado.

**Importar contatos:** em Pessoas, por agenda do celular (navegadores Android compatíveis), arquivo .vcf/.csv ou lista colada, com conferência prévia e detecção de duplicados por telefone e nome.

**Modelos por tipo de evento:** festa, gira e reunião têm convite, lembrete e aviso próprios, editáveis e salvos por tipo.

O cache do PWA foi atualizado (meuterreiro-v04120).

## Enviar para grupo V0.4.12.1

Botão **Enviar para grupo** em Agenda → Avisar e em Comunicação → mensagem: abre o WhatsApp sem destinatário para escolher grupo, lista de transmissão ou vários contatos (nome sai como "pessoal"), com a imagem do evento pelo menu de compartilhar quando disponível. Botão **Copiar** para colar a mensagem onde quiser. Cache do PWA: meuterreiro-v04121.

## Tour Oscar V0.4.13.0

Tour guiado ampliado: explicações completas em todos os módulos (listas do que cada opção faz, como o Financeiro contabiliza, etapas dos trabalhos, situação do estoque, frequência e backup) e **aulas práticas** que abrem o formulário real e explicam campo por campo (pessoa, atendimento, compromisso, lançamento, trabalho espiritual, mensagem e estoque), com "Preencher exemplo". Aula "Como o dinheiro é contabilizado" com os números reais da casa. Durante o tour, o app oferece praticar na hora e retoma de onde parou. Cache do PWA: meuterreiro-v04130.

## Excluir registros V0.4.14.0

Botão **🗑 Excluir** individual nas listas e nos formulários (trabalhos, catálogo, pessoas, lançamentos, eventos, mensagens, estoque, fornecedores, patrimônio, documentos) e **exclusão em lote** (☑ Excluir vários + Selecionar todos). Cada exclusão mostra o impacto antes de confirmar; trabalhos permitem manter ou excluir os lançamentos do Financeiro e o compromisso da Agenda. Ponto de restauração automático antes de exclusões em lote, de lançamentos e de trabalhos.

## Chamadas separadas V0.4.15.0

Cada compromisso aceita **várias chamadas** (abas), com escolha de **quem participa** (atalhos Filhos da casa / Todos / Convidados e consulentes / Marcados na Agenda, categorias e seleção pessoa a pessoa), opção **Separar por categoria**, **Conta para a frequência** por chamada, **Visão geral** e PDF por chamada ou geral. Chamadas antigas migram como "Chamada principal".


## Atualização V0.4.16.0

Reunião online (Google Meet, Jitsi ou outro link) em cada compromisso, com o link na mensagem de WhatsApp. Botões Google Agenda e arquivo .ics, e calendário .ics do mês. Conexão opcional com a conta Google (Configurações → Google Agenda): envio automático de compromissos criados, alterados e excluídos para a agenda "Meu Terreiro" e criação automática da sala do Meet. Requer ID do cliente OAuth (passo a passo no manual) e a origem do GitHub Pages autorizada. Acesso do Google dura cerca de 1 hora; sincronização só de ida.

Para o usuário só tocar em "Entrar com Google": o desenvolvedor registra o app uma única vez no Google Cloud (API Google Calendar + ID do cliente OAuth Aplicativo da Web, origem = endereço do GitHub Pages) e cola o ID na constante G_DEFAULT_CLIENT_ID do index.html.


## Atualização V0.4.17.0

Trabalhos Espirituais: várias propostas de serviço juntas — botão "+ Escolher vários" no passo 3 (marca vários modelos do catálogo, com quantidade) e "Adicionar modelo" agora soma em vez de substituir. Avisos: as 4 janelas do navegador ("meuterreiroapp.com.br diz") foram trocadas por janelas do app; as confirmações de exclusão/cancelamento/PIN/apagar dados/restaurar ficaram mais claras, com botão vermelho nas ações perigosas; mensagens rápidas coloridas, com tempo proporcional ao texto.
