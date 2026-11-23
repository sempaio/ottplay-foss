# STARLINK Samsung QA 0.3.5 — Xtream Codes + AVPlay (candidato isolado)

**Origem preservada:** QA 0.3.4 original com busca global de canais, PR #11 `sempaio/ottplay-foss`, commit `8b5be509796340a75ad2fe7862ba48ce2d15c12e`. A variante visual rejeitada (PR #10) nao participa desta entrega.

**Escopo M81:** `M81-APP-01`, sem mexer no painel principal, publicacao IPTV Brasil 2026, Android, LG, EPG ou listas de clientes. **O app ja utiliza Xtream Codes** (login via `player_api.php`, categorias, TV ao vivo, filmes e series). Nenhuma fonte M3U foi adicionada.

## Mudancas isoladas

- Mantem `app.css` e `index.html` sem alteracoes: visual e botao Buscar canais da QA 0.3.4 preservados.
- Mantem acesso ao Xtream do painel com URL, usuario e senha configurados na tela do aparelho.
- Abre e controla `webapis.avplay` com transicoes seguras entre `NONE`, `IDLE`, `READY`, `PLAYING` e `PAUSED`.
- Em live Xtream que anuncia `.ts` e emite erro de formato na Samsung, tenta **uma unica vez** o mesmo stream ID usando `.m3u8`. Enderecos diretos e VOD/series nao sao reescritos.
- Exibe codigo oficial de erro AVPlay, sem mostrar URLs de streams, usuario ou senha, e nao faz reconexao infinita para formato nao suportado.
- O suporte efetivo a codecs/DRM/HTTPS/redirect continua dependendo da TV, servidor Xtream e fonte.
- Identidade de instalacao para QA: `STLRB035AV.StarlinkTV`, versao `0.3.5`, separada da `STLRB00034.StarlinkTV` de QA 0.3.4.

## Validacao e distribuicao

Testes automatizados: `node starlink/tv/full-qa034/tests/qa034-tests.cjs`, executados em CI com Chrome/Playwright e AVPlay **simulado**. Incluem os nove cenarios da QA 0.3.4 e verificacoes de URL Xtream, fallback e erros. A execucao mais recente e o resultado devem ser consultados no GitHub Actions; codigo escrito nao e homologacao.

O workflow `.github/workflows/samsung-qa035-xtream-avplay.yml` gera um ZIP para o 2APP com `PROJETO_TIZEN` e um `.wgt` **NAO ASSINADO**. Nao instalar o WGT bruto: a versao para TV precisa ser assinada pelo certificado adequado e testada em Samsung Tizen real, sem sobrescrever a QA 0.3.4 funcional.

### Aceite na Samsung fisica

1. Fazer login com uma conta Xtream valida do M81 e verificar TV ao vivo, filmes e series.
2. Comparar um canal HLS autorizado e um canal TS autorizado, observar erros sem credenciais.
3. Verificar troca de canal, play/pause, retorno, busca global, foco e controle remoto.
4. Testar congelamento/reconexao de live, erro de codec e encerramento de filme sem loop.
5. Registrar modelo/versao Tizen, hash SHA-256 do WGT assinado, resultado e rollback.

**Estado:** candidata no GitHub, nao integrada a main, nao implantada, nao assinada e nao homologada em TV fisica. O computador operacional `DESKTOP-098NEC7` estava offline para esta investigacao.
