# Samsung QA 0.3.6 — consulta de mensagens e versoes do M81

**Decisao operacional:** evoluir somente o aplicativo Samsung. O painel principal M81 e a integracao Brasil IPTV 2026 continuam sob outro fluxo de desenvolvimento; **nao alterar o backend ou mergear a PR #58** a partir desta tarefa.

**Base preservada:** PR #11 Samsung QA 0.3.4 (visual original + busca global) -> PR #13 QA 0.3.5 Xtream + AVPlay. Esta QA 0.3.6 e uma candidata adicional isolada com App ID `STLRB036AV.StarlinkTV`; nao sobrescreve a QA 0.3.4 nem a QA 0.3.5.

## Funcionalidades acrescentadas no aplicativo

- Ao validar login Xtream, iniciar consulta automatica read-only ao M81 `https://panel.taila5c5c2.ts.net` a cada 15 minutos, enquanto o aplicativo estiver visivel e autenticado.
- Mensagens: `GET /app/announcements/active`, **contrato da PR #58**, resposta `{"announcement":null}` ou `{"announcement":{"id":7,"title":"Comunicado","message":"Texto"}}`. A UI renderiza somente texto, nao HTML, e evita repetir o mesmo ID durante a sessao. Mensagens nao interrompem a reproducao AVPlay.
- Versoes: `GET /app/samsung/updates/latest?package_id=STLRB036AV` (contrato **proposto**, NAO existente no backend consultado). Exemplo de resposta `{"update":null}` ou `{"update":{"package_id":"STLRB036AV","version":"0.3.7","sha256":"<64 caracteres hexadecimais>","wgt_url":"https://servidor.example/releases/STARLINK-0.3.7.wgt","notes":"Correcoes"}}`. A TV verifica ID, versao maior, extensao WGT, HTTPS e SHA-256 e exibe um aviso sem iniciar download ou instalacao.
- Se as rotas nao existirem, responderem 404, falharem ou nao permitirem CORS, a TV continua logando e reproduzindo Xtream; essas falhas nao impedem uso.
- A consulta de avisos e versoes **nao envia usuario nem senha Xtream**. Nenhum arquivo WGT nem APK e executado por URLs externas. Apenas metadados sao mostrados.
- `tizen:metadata` de autoatualizacao ativa o mecanismo do **Samsung Apps/Smart Hub quando distribuido por esse canal**. Nao confundir com atualizacao do WGT sideload instalado com 2APP/Tizen Studio.

## Restricoes reais da Samsung

A API `tizen.package.install()` exige permissao `http://tizen.org/privilege/packagemanager.install` de nivel **platform**. Aplicativos Samsung TV comuns nao podem instalar WGT silenciosamente. Publicacao na loja e o caminho oficial para autoatualizacoes, mantendo mesmo ID/assinatura de autor. Para QA instalada manualmente, notificacoes sao possiveis, mas a assinatura e a instalacao via processo autorizado continuam manuais.

Documentacao oficial:
- https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references/package-api.html
- https://developer.samsung.com/tv-seller-office/faq/application-update.html
- https://developer.samsung.com/smarttv/develop/guides/fundamentals/configuring-tv-applications.html
- https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html

## Dependencias fora do app (NAO alterar aqui)

1. PR #58 `sempaio/painel-m81-iptv-cloud` ainda aberta/draft: somente quando API estiver aprovada, publicada e acessivel, mensagens reais chegarao a TV.
2. Endpoint de atualizacao Samsung e publicacao/assinatura das releases WGT **ainda precisam ser providenciados pelo fluxo do painel**. Rotas `/app/update/latest` e `/app/update/download` existentes no M81 servem **APKs Android** e nao podem ser reutilizadas como atualizador WGT.
3. Configuracao CORS/HTTPS do painel precisa permitir a origem da TV, sem permissao global irrestrita. Nao editar env/servidor aqui.
4. Teste de conexao real, avisos reais, controle remoto, compatibilidade Tizen e rollout da loja: pendentes de homologacao na Samsung fisica.

## Testes e rollback

Workflow isolado: `.github/workflows/samsung-qa036-panel-messages-updates.yml`. Reexecuta 12 regressoes Xtream/AVPlay da QA 0.3.5 e 5 testes novos de UI/contratos/metadados e erros. Resultado final deve ser consultado no GitHub Actions. Build publica ZIP para empacotar e assinar no 2APP e WGT **nao assinado**. Nao instalar sobre QA034 nem fazer merge/deploy automatico.

**Registro de pendencias:** funcionalidade de mensagens no app implementada em candidata; verificacao de versoes no app implementada em candidata; API de avisos dependente de PR58; API de release Samsung ausente; instalacao silenciosa WGT inviavel por privilegio da plataforma; Samsung fisica nao testada.
