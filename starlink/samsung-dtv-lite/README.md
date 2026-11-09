# STARLINK DTV Samsung — QA 0.3.0 (M81 / Tizen)

**Status:** versão de testes funcional no emulador; não homologada para loja Samsung ou TV física.

O app Tizen enxuto usa login Xtream por usuário e senha, catálogo M81 e AVPlay nativo. Esta branch preserva as QA 0.2.8 e 0.2.9.

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
