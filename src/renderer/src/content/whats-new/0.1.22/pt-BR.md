## Cliente API

- **Enviar sem ambiente:** URL absoluta (`https://…`) funciona sem Access API. O seletor inclui **Sem ambiente** e **+ Novo ambiente** para criar um Access do tipo API
- **Ambiente/variável é opt-in:** um Access do tipo API só vira ambiente (e ganha `{{baseUrl}}` automático) quando você marca "Expor esta URL como variável de ambiente" no cadastro — sem marcar, é só uma URL guardada, sem Conectar
- **Ambientes são globais:** o seletor de ambiente lista Accesses API de qualquer cliente, não só do cliente da collection aberta
- **Autocomplete de variáveis:** digite `{{` na URL, params, headers ou Auth para ver as variáveis do ambiente selecionado; `{{variavel}}` reconhecida fica destacada, desconhecida fica sublinhada em vermelho
- **Presets reutilizáveis:** salve um conjunto de headers ou uma configuração de Auth como preset global nas abas Headers/Auth e aplique depois em qualquer request, de qualquer collection
- **Linhas de headers/params mais limpas e lista de Variables redesenhada**, com botão para revelar segredos salvos
- **Respostas grandes:** o limite de corpo de resposta subiu de 1 MB para 10 MB, e a resposta JSON ficou mais legível (mais espaçamento, realce de sintaxe); quando o corpo é truncado, o aviso agora diz isso explicitamente em vez de dizer "não é JSON"

Ver o capítulo [Cliente API](api) no manual.

## Personalização

- **Fonte do app:** escolha a família (IBM Plex Mono, JetBrains Mono, monoespaçada do sistema, Menlo/Consolas, Courier New) e o tamanho em **Configurações → Fonte do app** — vale pra tudo: interface, terminal, editores de código, hosts/portas e atalhos

## Correções

- A busca (🔍) na resposta do Cliente API agora destaca os resultados e navega até eles — antes o campo existia, mas não fazia nada
- Abrir uma pasta dentro de uma Collection não fecha mais todas as outras pastas abertas
