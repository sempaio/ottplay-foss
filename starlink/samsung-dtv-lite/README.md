# STARLINK DTV Samsung — QA 0.2.8 (M81 / Tizen)

**Status:** protótipo funcional de reprodução, ainda em homologação. Não é a versão final para loja Samsung.

Este aplicativo Tizen foi criado como alternativa enxuta ao OTT-play para isolar o login Xtream, o catálogo do M81 e a reprodução com o AVPlay nativo da Samsung.

## Validação realizada em 09/11/2026

- Emulador Samsung Tizen 10: instância `t-0917-1`, dispositivo `emulator-26101`.
- Aplicativo `STLTVL0010.StarlinkDTV` instalado e iniciado.
- Login somente com usuário e senha; endereço do M81 pré-configurado.
- Catálogo real M81 autenticado: 68 categorias e 1.685 canais no momento do teste.
- **TV Brasil (720p)**: vídeo real exibido no emulador; AVPlay registrou 90,7 segundos e 88 eventos; quadros capturados com seis segundos de diferença tiveram mudança média de pixels RGB de aproximadamente 29/30/31. O usuário confirmou reprodução com pequenas travadas.
- Vídeo HLS público de diagnóstico também exibiu movimento no emulador.
- A TV Cultura chegou a exibir imagem, mas houve `PLAYER_ERROR_CONNECTION_FAILED`; uma fonte TV Globo Rio respondeu HTTP 403. Esses canais **não** foram aprovados.

## Arquivos

- `app/`: código-fonte HTML/CSS/JavaScript Tizen, ícone e manifesto `config.xml`.
- `releases/STARLINKDTV-QA-0.2.8.wgt`: o pacote WGT assinado efetivamente instalado no emulador.
- `tests/test-core.cjs`: verificações isoladas de autenticação, URL de transmissão e seleção do canal.

## Testes e compilação

Para verificar a lógica com Node.js:

```sh
node tests/test-core.cjs
node --check app/main.js
```

Para gerar um novo WGT, copie **somente** os seis arquivos de `app/` para uma pasta de staging limpa. No Tizen Studio, utilize um perfil de assinatura autorizado para o dispositivo; não inclua WGTs antigos dentro da pasta de staging.

A assinatura da QA pode ser válida apenas para o emulador. **Não considere o WGT homologado para instalação em televisores reais ou para a loja Samsung.**

## Limitações e próximos passos

- A interface atual cobre login e **canais ao vivo**. Filmes, séries, capas e personalização ainda não foram implementados nesse aplicativo enxuto.
- Ainda há travamentos perceptíveis no canal validado. Melhorar buffering, recuperação de falha, foco/navegação por controle remoto e tratamento de links de origem.
- A revisão de QA inicia automaticamente o canal preferencial após o login para facilitar testes; isto deve ser revisto antes de publicar.
- O aplicativo não incorpora credenciais no código ou no WGT. A senha é mantida em memória de sessão e enviada à API Xtream via HTTPS; não registrar URLs autenticadas em logs.
- Nenhum serviço do painel M81 ou aplicativo Android foi alterado por este checkpoint.

**Checkpoint:** preservar esta versão como referência de reprodução comprovada no emulador. Não substituir outros aplicativos ou branches sem comparação e testes.
