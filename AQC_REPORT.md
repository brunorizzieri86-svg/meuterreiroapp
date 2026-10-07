# AQC — MEU TERREIRO V0.4.9.3

## Score automatizado: 100%
## JavaScript: ✅ sintaxe validada
## Teste funcional (DOM simulado): ✅ sem erros
## Teste visual em navegador real (Chromium): ✅ tela de primeiro acesso

## Verificações
- ✅ version
- ✅ imagens_preservadas
- ✅ pro_preservado
- ✅ demo_safe_preservado
- ✅ termos_preservados
- ✅ pdf_footer_preservado
- ✅ primeiro_acesso_rola_desktop
- ✅ mascara_telefone
- ✅ mascara_cpf_cnpj
- ✅ mascara_cep
- ✅ mascara_dinheiro
- ✅ mascara_automatica_novos_campos
- ✅ consulentes_atendimento
- ✅ convite_gira
- ✅ mensalista
- ✅ pdfs_modulos

## Testes executados
- Primeiro acesso em 3 tamanhos (janela 1116x640, tela 1920x960, celular 390x780): botão "Criar acesso" alcançável em todos. Na versão anterior, na janela 1116x640, o botão ficava fora da tela e sem rolagem.
- Telefone: digitação progressiva, colagem com +55, excesso de dígitos cortado.
- Dinheiro: 8 → 0,08; 8500 → 85,00; 123456 → 1.234,56; negativo na conciliação (-1.234,56); valor salvo volta ao formato ao editar (240000 → 2.400,00); conversão de volta para centavos confere (1.234,56 → 123456).
- CPF/CNPJ: formatação progressiva e troca automática para CNPJ.
- Campos de texto livre (Pix, frete, pagamento, nomes, buscas, login, senha) sem máscara.

## Observações
- Não existe campo de CEP no app hoje (o endereço da Casa é um campo único); a máscara de CEP já está pronta caso o campo seja criado.
- Cadastros antigos com telefone sem formatação aparecem formatados ao editar, sem perda de dados.
- Faça backup antes de instalar por cima da versão anterior.

## Integridade
- Nenhuma imagem interna removida. Plano PRO e gerador preservados.
- Item 6 ainda não iniciado.
