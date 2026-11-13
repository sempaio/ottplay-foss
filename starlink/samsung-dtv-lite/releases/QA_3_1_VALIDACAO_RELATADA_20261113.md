# STARLINK DTV — QA 3.1 (versão aprovada na Samsung pelo usuário)

Data do relato: 13/11/2026.

## Estado confirmado pelo usuário

- **QA 3.1 é a versão da Samsung que funciona na TV.** Este relato prevalece sobre a identificação anterior de 1.0.0 como versão principal.
- Outras versões permitem preencher o **usuário**, mas o foco do controle remoto **não avança ao campo de senha**. Logo, a falha ocorre na navegação da interface **antes da autenticação**, e não comprova erro da senha, Tailscale, banco de dados ou painel M81.
- Não substituir ou desinstalar QA 3.1 da televisão apenas para experimentar navegação de login.

## Estado do pacote

O WGT da QA 3.1 **ainda não foi identificado com hash e caminho verificáveis neste repositório**. NÃO atribuir a ela o WGT `STARLINK-DTV-SAMSUNG-1.0.0.wgt` nem alegar que os dois são idênticos.
A 1.0.0 permanece preservada separadamente; não é a versão fisicamente aprovada.
Antes de criar release/tag definitiva de QA 3.1, localizar o WGT original no backup/computador autorizado e verificar versão no config.xml e SHA-256.

## Diagnóstico a validar em versões novas

- Reproduzir o fluxo com controle remoto Samsung: usuário → senha → conectar
- Com teclas Direcionais, Enter e Return, garantir movimento de foco explícito entre `username`, `password`, teclado remoto e `login-button`
- Testar entrada via teclado Samsung e teclado virtual interno, inclusive quando o usuário conclui a digitação
- Não mudar as credenciais do painel M81 para corrigir um defeito visual da Samsung
- Testar navegação e vídeo antes de atribuir a uma nova versão o estado aprovado
