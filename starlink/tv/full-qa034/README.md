# STARLINK Samsung DTV Full QA 0.3.4 — teste isolado

Este pacote experimental parte de **STARLINK Rebuild QA 0.3.0**, e nao de DTV Lite.
Inclui TV ao vivo, Filmes, Series, busca, categorias e favoritos da sessao.

Mudancas:
- Endereco do painel M81 preenchido por padrao
- Teclado alternativo navegavel com setas/OK para usuario e senha
- Login automatico opcional com credenciais salvas localmente; Sair elimina a conta lembrada
- Canais ao vivo retomam apos 15 s sem progresso, com tres tentativas iniciais e depois uma a cada minuto
- Pausa manual e VOD nao ativam recuperacao; fim da transmissao de canal ao vivo nao fecha o player

Validacao: 8 cenarios em Chrome com API Xtream e AVPlay simulados.
**Ainda nao houve teste de reproducao real na TV Samsung.**
Assinatura Samsung de desenvolvimento. Identificador exclusivo: STLRB00034.

Instale pelo seu instalador WGT Samsung sem remover a versao principal.
O login automatico guarda usuario e senha em localStorage na TV; use somente numa TV pessoal.