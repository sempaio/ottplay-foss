# STARLINK DTV Samsung 1.0.0 — artefato preservado (não é a principal validada na TV)

**Data:** 12/11/2026
**Estado:** artefato assinado preservado. **Correção de referência em 13/11/2026:** o usuário informou que a versão comprovadamente funcional na TV é a **QA 3.1**, não esta 1.0.0. Não promover 1.0.0 como principal de TV sem comprovação física.

## Pacote oficial preservado

- **Versão:** 1.0.0
- **Aplicativo Tizen:** `STLTVR0011.StarlinkDTV`, pacote `STLTVR0011`
- **WGT assinado:** `starlink/samsung-dtv-lite/releases/STARLINK-DTV-SAMSUNG-1.0.0.wgt`
- **Tamanho:** 1.958.474 bytes
- **SHA-256:** `2134AF1A4522E14CDA1C3EB2AE99025E888FBD3DA39C5C53A0301BC35E3986E5`
- **Commit original exato do artefato e código:** `1b24e0e2a47482b7eb93da68feda1457ec8abcba`
- **Emulador:** `STARLINK-DIRECT-QA`
- **Instalação:** pacote 1.0.0 instalado e inicializado pelo CLI do Tizen Studio com sucesso.
- **Origem:** release criada sobre QA 0.3.8, com catálogo de filmes carregado por categoria para não baixar os ~56.709 itens (17 MB) de uma só vez.

## Evidências de validação

- Na versão anterior QA 0.3.8, TV Brasil (720p) mostrou vídeo do M81 em movimento por mais de dois minutos.
- Na 1.0.0, as abas e catálogos foram vistos no emulador, incluindo ~1.058 filmes em Lançamentos e 5.152 títulos de séries.
- O Guia de Programação exibiu horários e descrições recebidos do painel M81 em canal com EPG válido.
- O usuário confirmou explicitamente que **um filme reproduziu no emulador**, mesmo que capturas isoladas do teste não fossem suficientes para inferir movimento contínuo.
- Testes locais de JS e empacotamento Tizen passaram antes da assinatura.

## Observação funcional confirmada pelo usuário — 12/11/2026

- **Filmes e séries abrem rapidamente; as capas aparecem.** Não alterar o carregamento de capas nem a estratégia de catálogo por essa queixa.
- **Problema remanescente é sinopse ausente**, e não lentidão da capa. A versão estável pede os detalhes Xtream `get_vod_info` e `get_series_info`; quando a origem não informa descrição, a tela não pode inventá-la.
- Enriquecimento opcional TMDB deve ocorrer no backend M81, com credencial válida e cache somente sob demanda. A PR backend #46 está separada, ainda não implantada. Não adicionar requisições TMDB diretas ao WGT.
- O pacote WGT assinado e seu SHA-256 permanecem inalterados.

## Compatibilidade e pendências do painel M81

O cliente 1.0.0 utiliza Xtream do M81: `/player_api.php`,
`get_live_categories`, `get_live_streams`, `get_vod_categories`,
`get_vod_streams&category_id=...`, `get_vod_info`,
`get_series`, `get_series_info`, `get_short_epg`;
o player usa `/live/`, `/movie/` e `/series/` como fontes.
A resposta por categoria dos filmes foi verificada em produção.

**Ainda deve ser auditado**, sem alterar produção, a diferença entre as
contagens 616 e 1.644 de canais, distinguindo fluxo do painel,
visibilidade e agrupamento de qualidades. O EPG publicado tinha cobertura
parcial (9 canais / 172 programas na verificação de 12/11).
Nem todos os episódios nem todos os filmes receberam validação de reprodução.

## Regra operacional

Esta versão 1.0.0 é **um artefato alternativo preservado, não o padrão validado na TV**, não deve ser
substituída por branches experimentais de buffer, TMDB ou catálogo sem
uma nova validação funcional e aprovação explícita do usuário.
Os ajustes de buffer devem seguir em branch separada.
Os ajustes de TMDB pertencem ao backend do M81 e não mudam o WGT existente.
**Não apagar histórico, APK Android, publicação do painel ou WGT assinado.**
