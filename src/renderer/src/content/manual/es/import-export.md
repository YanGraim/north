# Importar / exportar y actualizaciones

## Inventario en JSON

En **Ajustes → Inventario**:

- **Exportar JSON** — copia del inventario: clientes → entornos → grupos → conexiones y accesses, con los **workflows** y las **variables** de cada grupo, las tags y las **VPNs FortiGate** (SSL-VPN e IPsec), incluida qué VPN usa cada cliente, entorno y conexión
- **Importar JSON** — trae un JSON exportado (de cualquier versión de North) a este North. Lo que ya existe con el mismo nombre queda como está; solo entra lo que falta

El JSON **no incluye credenciales/secretos**. Tras importar, vuelve a configurar contraseñas y claves en el vault. En las VPNs, ni el **usuario** va en el archivo (es personal): al conectar una VPN importada, North te pide completar tu usuario en **Editar**, y la contraseña/PSK en la primera conexión. Las VPNs **OpenVPN** no entran en el archivo, porque cada persona tiene su propio `.ovpn`: importa el tuyo en la pantalla de VPNs.

## Hoja CSV

- **Descargar modelo CSV** — guarda `north-acessos-modelo.csv` para Excel/Sheets
- **Importar hoja (CSV)** — filas con `tipo` = `servidor` | `banco` | `login`

Columnas principales: `cliente`, `ambiente`, `grupo`, `nome`, `protocolo`/`engine`, `host`, `porta`, `database`, `url`, `usuario`, `senha`, `notas`, `tags`.

Si el CSV tiene contraseñas, la UI pide confirmación explícita antes de guardarlas en el vault. Sin confirmación, se ignoran.

## Actualizaciones

En **Ajustes → Actualizaciones**, verifica nuevas versiones vía GitHub Releases. En builds de desarrollo el updater suele estar apagado.

**macOS — primera instalación:** el `.dmg` no está firmado por Apple; Gatekeeper puede pedir clic derecho → Abrir. Copia North a **Aplicaciones** antes de usar actualizaciones in-app.

**Si vienes de la 0.1.16 o anterior:** instala este `.dmg` **una vez**. Las builds ad-hoc rechazan el zip nuevo. Después, **Verificar ahora** → **Instalar y reiniciar**.

**Actualizaciones siguientes:** el release en GitHub debe estar **publicado** (un borrador/draft no lo ve el updater).
