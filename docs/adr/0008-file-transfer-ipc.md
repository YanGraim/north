# ADR 0008 — File-transfer por comandos IPC

- **Status:** Aceito
- **Data:** 2026-07-24

## Contexto

SFTP e FTP precisam de listagem e mutações de arquivos sem misturar bytes de arquivo com o streaming contínuo de terminal. A UI do browser remoto não deve distinguir SFTP de FTP.

## Decisão

1. Sessões `file-transfer` expõem `FileTransferCapability` no `ProtocolSession`.
2. Plano de controle via IPC tipado: `fs:list|mkdir|rename|delete|download|upload`, com `sessionId`.
3. Progresso via evento `fs:progress` (toast persistente no renderer).
4. Download usa `dialog.showSaveDialog` no main; upload usa caminho local via `webUtils.getPathForFile` no preload.
5. Drivers: SFTP (`ssh2` subsystem, auth/host-key compartilhados com SSH) e FTP (`basic-ftp`).

## Consequências

- FileBrowserView só conhece `SessionKind`, não o protocolo.
- Operações FS falham claramente se a sessão não estiver `connected` ou não tiver `fileTransfer`.
