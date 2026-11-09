# STARLINK DTV Samsung — QA 0.2.9 (M81 / Tizen)

**Status:** aplicativo enxuto em homologação. Login, catálogo e reprodução HLS confirmados no emulador Tizen 10. **Não é versão final da loja Samsung.**

A QA 0.2.9 preserva o checkpoint QA 0.2.8 e corrige problemas de callbacks atrasados do Samsung AVPlay e navegação de retorno.

## Verificações executadas em 09/11/2026

- Emulador Samsung Tizen 10, instância `t-0917-1` (`emulator-26101`); aplicativo `STLTVL0010.StarlinkDTV` instalado e iniciado.
- Login com usuário e senha, sem pedir URL do servidor.
- Catálogo Xtream M81 real carregado: cerca de **1.685 canais** e **67 categorias** no teste QA 0.2.9. Essas contagens são dinâmicas.
- **TV Brasil (720p) reproduziu vídeo real em movimento** no emulador. Em uma captura, o AVPlay indicou cerca de 103,9 segundos e 165 eventos. Duas imagens, separadas por oito segundos, tiveram diferença média RGB de **26,19 / 27,67 / 31,19**, confirmando quadros visivelmente diferentes.
- O checkpoint anterior QA 0.2.8 também foi observado reproduzindo após mais de **2.003 segundos**, com mais de 3.500 eventos, e com movimento confirmado por comparação de imagens.
- O botão **Voltar aos canais** encerrou a tela de vídeo e exibiu o catálogo. O botão **Sair** retornou ao login com campos vazios, sem reiniciar o aplicativo.
- A fonte Rede TV FHD apresentou `PLAYER_ERROR_CONNECTION_FAILED`; o aplicativo permaneceu aberto, e foi possível retornar à lista e iniciar o HLS público de diagnóstico, que demorou a carregar mas voltou a exibir imagem.
- A tecla Esc do teclado no emulador **não foi validada como Back físico**: o controle de evento `tizenhwkey` passou em teste simulado, mas a confirmação por controle remoto de uma TV real continua pendente.

## Correções QA 0.2.9

- Cancela callbacks atrasados de `prepareAsync` após sair do player ou da conta, para impedir reprodução em segundo plano.
- Ignora progresso, erros e eventos de um canal antigo depois que o usuário troca de transmissão.
- Adiciona tratamento do evento nativo `tizenhwkey` com `keyName='back'`.
- Mantém o AVPlay nativo e as transparências do player que permitiram renderização do vídeo.

## Testes automatizados

- `node tests/test-core.cjs` — valida autenticação, URL e seleção de canal.
- `node tests/qa029-recovery.cjs` — cinco cenários de recuperação, com navegador Playwright e AVPlay simulado; **5/5 passaram**. Requer o pacote de desenvolvimento `playwright` disponível no ambiente de teste.
- `node --check app/main.js` — sintaxe JavaScript verificada.

## Arquivos

- `app/` — fonte Tizen (HTML, CSS, JS, manifesto e ícone) da QA 0.2.9.
- `releases/STARLINKDTV-QA-0.2.8.wgt` — checkpoint anterior preservado.
- `releases/STARLINKDTV-QA-0.2.9.wgt` — WGT assinado e instalado no emulador.
- `tests/` — testes sem credenciais reais.

Para reconstruir um WGT, utilize uma pasta de staging limpa contendo apenas os arquivos de `app/`. Assine com um perfil autorizado para o dispositivo de destino; o WGT de QA pode não instalar em outra Samsung sem assinatura compatível.

## Limitações e próximos testes

1. A TV Brasil apresentou reprodução em movimento, mas ainda há relatos de pequenas travadas e demora inicial de buffer. Medir variações de rede/segmentos e estabilidade em sessões longas antes de otimizar.
2. Confirmar navegação por controle remoto físico (setas, OK, Back), especialmente a entrega de evento Back no Tizen; o Esc do teclado do emulador não bastou para homologação.
3. Adicionar navegação e busca de catálogo adequadas à TV, sem perder o fluxo de login e AVPlay que já funciona.
4. Esta versão enxuta oferece **somente canais ao vivo**. Filmes, séries, capas, favoritos e personalização ainda não foram implementados neste aplicativo.
5. A abertura automática da TV Brasil após login existe apenas para facilitar o teste; remover antes de distribuir.
6. Não modificar servidor M81 ou Android para consertar falhas específicas do cliente Samsung.

**Segurança:** nenhuma senha é embutida no código ou no WGT, e ela é descartada no logout. Não registrar nem compartilhar URLs autenticadas das transmissões.

**Preservação:** manter a QA 0.2.8 como ponto de retorno. Não mesclar na `main` sem homologação de estabilidade, navegação, fontes e TV física.
