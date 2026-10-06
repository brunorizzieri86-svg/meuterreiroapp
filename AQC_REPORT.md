# AQC — MEU TERREIRO V0.4.3

**Pontuação automatizada: 100.0% (29/29 verificações aprovadas)**

## Escopo auditado
- ✅ Pacote base completo
- ✅ Manifest PWA
- ✅ Service worker versão nova
- ✅ Plano no menu desktop
- ✅ Rota Plano registrada
- ✅ Render da tela Plano
- ✅ Roteador abre Plano
- ✅ Plano também no Mais
- ✅ Plano também em Configurações
- ✅ Teste grátis 30 dias
- ✅ Início do trial no cadastro
- ✅ Avisos pré-vencimento
- ✅ Modo Restrito
- ✅ Guarda de render para rota bloqueada
- ✅ Guarda de clique expiração
- ✅ Backup permitido no restrito
- ✅ Configuração/assinatura acessíveis
- ✅ Licença preservada na restauração
- ✅ WhatsApp correto
- ✅ Preço 30 dias
- ✅ Preço 6 meses
- ✅ Preço 12 meses
- ✅ WhatsApp envia ID do aparelho
- ✅ Ativação instantânea página
- ✅ Gerador separado
- ✅ Mesmo segredo app/gerador
- ✅ Mesmo prefixo/formato
- ✅ Planos gerador alinhados
- ✅ 27 validações gerador ↔ app — 27/27

## Testes adicionais
- ✅ JavaScript do aplicativo validado com `node --check`.
- ✅ JavaScript do gerador PRO validado com `node --check`.
- ✅ 27 combinações de códigos (3 aparelhos × 3 planos × 3 sequências) validadas contra o mesmo algoritmo usado no app.
- ✅ Código de outro aparelho foi rejeitado nas 27 combinações.

## Comportamento validado por inspeção de fluxo
- O teste grátis é de 30 dias por navegador/aparelho.
- Após o vencimento, o app entra em Modo Restrito sem apagar a base local.
- Home, Mais, Backup & Proteção, Plano & Assinatura e Configurações permanecem acessíveis.
- Os demais módulos e ações operacionais são interceptados pela licença até ativação PRO.
- A ativação PRO persiste a validade e redesenha a interface imediatamente.
- Desktop e celular seguem o mesmo fluxo, porém continuam independentes enquanto não houver nuvem/sincronização.

## Limitação desta auditoria
- A automação visual via Chromium foi bloqueada pela política do ambiente de execução. Por isso, a validação desta entrega combina sintaxe, integridade estrutural, inspeção de rotas/ações e testes do algoritmo de licença. O teste final no domínio GitHub Pages continua recomendado após o upload.

## Critério de entrega
- Meta mínima solicitada: **85%**.
- Resultado: **100.0% — APROVADO para geração do ZIP.**