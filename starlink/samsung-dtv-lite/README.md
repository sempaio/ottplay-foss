# STARLINK DTV Samsung — QA 0.3.5 (M81 / Tizen)

**Checkpoint de 11/11/2026:** vídeo real de TV Brasil (720p), originado do M81, reproduzido em movimento no emulador Samsung. Aplicativo de teste; ainda não homologado em TV física ou loja.

## Evidências da QA 0.3.5

- Emulador Tizen `emulator-26101`, aplicativo `STLTVR0011.StarlinkDTV`, pacote assinado por `M81_SAMSUNG_VALIDATION`.
- Primeira medição: reprodução com 129,7 segundos e 54 eventos de tempo; diferenças RGB médias de [84,31; 62,95; 77,69] e [84,35; 78,95; 58,78] entre capturas separadas por 18 s, confirmando quadros diferentes.
- Após recompilação preservando UTF-8: reprodução real do canal M81 com 105,2 s e 124 eventos; mudança RGB média de [35,94; 36,43; 32,30] em imagens separadas por 25 s.
- Login automático revalidado na inicialização após nova instalação, com tratamento limitado a três tentativas para falhas transitórias.
- Unit tests: `node tests/test-core.cjs`, `node tests/qa034-stall-guard.cjs` e `node --check app/main.js` passaram.
- Artefato: `releases/STARLINKDTV-QA-0.3.5-VIDEO-M81-VALIDADO.wgt`, SHA-256 `F70959B970588768C387C9CACA1FC4DB0B46B0D620F7F05CECE3F8DA1EA59BAE` (1.933.586 bytes).
- O botão de diagnóstico público usa um MP4 de teste, **mas o vídeo validado é a transmissão HLS do M81**, não o MP4.
- A QA 0.3.4 anterior foi preservada em branch distinta. Não alterar produção, backend nem publicações usando este checkpoint.

**Pendências:** teste prolongado de vários canais/filmes/séries, navegação em controle real, verificação em TV física, reprodução sem rebuffer em período maior e interface estilo Netflix. Não distribuir esta QA como versão final de loja.

## Histórico e diagnóstico anterior

# STARLINK DTV Samsung — QA 0.3.4 (M81 / Tizen)

**Status:** QA 0.3.4 instalada e inicializada no emulador; reprodução contínua de vídeo NÃO aprovada. Não homologada para loja Samsung nem TV física.

O app Tizen enxuto usa login Xtream por usuário e senha, catálogo M81 e AVPlay nativo. Esta branch preserva as QA 0.2.8 e 0.2.9.

## Auditoria de 11/11/2026 — QA 0.3.4

- Instalação e abertura no emulador confirmadas com perfil de assinatura Samsung `M81_SAMSUNG_VALIDATION`.
- Login M81 e catálogo funcionaram após corrigir a digitação com teclado remoto.
- TV Brasil (720p) chegou ao AVPlay mas mostrou tela preta, sem eventos de progresso temporal; em tentativa subsequente foi registrado `InvalidAccessError: PLAYER_ERROR_CONNECTION_FAILED`.
- Vídeo público de diagnóstico também ficou sem progresso, parado em preparação. Isso não demonstra defeito exclusivo do M81.
- Teste HTTP isolado no computador recebeu o manifesto HLS, os quatro rendimentos e um segmento MPEG-TS válido para cada qualidade. Houve também uma tentativa de segmento com timeout; a saúde da fonte varia.
- Um manifesto de variante contém `#EXT-X-INDEPENDENT-SEGMENTS`, tag indicada pela documentação Samsung como não suportada. A relação causal com o erro AVPlay ainda não está comprovada.
- A lógica QA 0.3.4 aguarda 30 segundos de preparação antes de reiniciar, tolera buffering curto, limita reconexões automáticas a três e permite tentativa manual depois de falha persistente.
- Regressão local mínima: `node tests/test-core.cjs`, `node tests/qa034-stall-guard.cjs`, `node --check app/main.js`. Os demais testes da UI exigem Playwright instalado localmente.
- **Critério de aceite pendente:** vídeo M81 com quadros distintos medidos por pelo menos 60 segundos, sem travamento recorrente, e teste na TV Samsung real.
- Não modificar painel/playlist em produção para experimentar normalização HLS. Testar em ambiente isolado.

## Histórico anterior

## Evidências em 09/11/2026

- Samsung Tizen 10, emulador `t-0917-1`, dispositivo `emulator-26101`.
- O WGT QA 0.3.0 instalou e abriu no emulador, mantendo o login com apenas usuário e senha.
- Login M81 e catálogo carregados; TV Brasil (720p) reproduziu vídeo real e exibiu cerca de 60 segundos no registro de teste.
- Dois quadros da TV Brasil, com sete segundos de intervalo, apresentaram diferença média RGB de **18,84 / 17,54 / 18,47**, confirmando imagem em movimento.
- Botão na tela para voltar ao catálogo continuou funcionando. O Enter do teclado no emulador ativou o botão focado.
- Esc do teclado e as setas enviadas a partir do Windows **não demonstraram resposta confiável**. A navegação lógica passou no navegador simulado, mas **não foi aprovada em controle remoto físico**.

## Alterações frente à QA 0.2.9

- Ajuste experimental de buffering AVPlay logo após `open()` e antes de `prepareAsync()`: buffer inicial de **5 segundos**, retomada de **12 segundos**, timeout de buffering de **10 segundos**.
- Fallback sem falha caso `setBufferingParam` ou `setTimeoutForBuffering` não estejam disponíveis.
- Contadores internos de inícios de buffering e tempo acumulado; callbacks de transmissões antigas continuam ignorados.
- Navegação D-pad por `keydown` (37/38/39/40) entre categorias e canais, com Enter para seleção e Back por código 10009.
- Remoção da dependência do evento `tizenhwkey`, que a Samsung documenta como não suportado em TV Web Apps.
- Foco inicial do catálogo, foco do botão Voltar no player e retorno à categoria selecionada ao sair.

## Testes automatizados (Windows + Playwright mockado)

- `node tests/test-core.cjs` — passou.
- `node tests/qa029-recovery.cjs` — 5/5 passaram. O caso Back foi atualizado para keydown 10009.
- `node tests/qa030-buffer-navigation.cjs` — **6/6 passaram**: parâmetros de buffer, fallback, D-pad, Back 10009, eventos de buffer e Esc simulado.
- `node --check app/main.js` — passou.
- Os testes simulados não substituem a validação na TV e no AVPlay real.

## Artefatos

- `app/`: fontes e manifesto Tizen da QA 0.3.0.
- `releases/STARLINKDTV-QA-0.3.0.wgt`: WGT assinado, instalado no emulador.
- `releases/STARLINKDTV-QA-0.2.9.wgt`: versão anterior preservada.
- `tests/`: testes de regressão. Não guardar credenciais reais ou capturas com dados privados no repositório.

## Pontos pendentes

1. **Não está comprovado** que o novo buffer reduziu travamentos: é configuração experimental, que precisa de comparação A/B sob condições equivalentes e observação dos eventos de rebuffer.
2. Confirmar D-pad, Enter e Back com controle remoto real da Samsung; o Esc do teclado no emulador pode não equivaler ao código Back enviado pela TV.
3. Troca de canais, retomada após falha e estabilidade de reprodução prolongada com fontes distintas ainda exigem mais homologação.
4. Interface nesta branch é **somente canais ao vivo**. Filmes, séries, capas, busca e personalização não estão incluídos.
5. O app inicia automaticamente um canal após login para facilitar QA. Remover esse comportamento antes de distribuir.
6. O WGT é assinado para o ambiente de teste; a TV real pode exigir outro certificado.

Fontes técnicas:
- https://developer.samsung.com/smarttv/develop/api-references/samsung-product-api-references/avplay-api.html
- https://developer.samsung.com/smarttv/develop/guides/user-interaction/remote-control.html
- https://developer.samsung.com/smarttv/develop/guides/user-interaction/user-interaction.html

**Proteção:** nenhum serviço do painel M81, aplicativo Android, QA 0.2.8 ou QA 0.2.9 foi alterado por esta revisão.
