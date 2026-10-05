# AQC — MEU TERREIRO V0.4.1

## Verificações realizadas
- manifest.json aponta para os novos ícones.
- icon-192.png e icon-512.png usam a nova arte oficial.
- icon-maskable-512.png possui zona segura para launchers Android.
- apple-touch-icon usa icon-180.png.
- favicon atualizado.
- Service Worker usa cache `meuterreiro-v041`.
- ZIP testado sem corrupção.

## Observação de teste
Após publicar no GitHub, um celular que já tenha a versão antiga instalada pode manter o ícone anterior em cache.
Para validar o novo ícone com certeza:
1. atualizar o site no GitHub;
2. abrir o site no Chrome;
3. aguardar a atualização do PWA;
4. se o launcher não trocar o ícone, desinstalar apenas o atalho/PWA antigo e instalar novamente.
Os dados do app ficam no armazenamento do navegador/site; evite limpar os dados do site se quiser preservar a base local.
