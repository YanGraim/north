## Archivos al estilo WinSCP

- **Dos paneles:** SFTP y FTP ahora muestran tu computadora a la izquierda y el servidor a la derecha. Arrastra archivos y carpetas entre ellos, o usa **F5** para copiar la selección
- **Abrir archivos desde una conexión SSH:** clic derecho en la conexión → **Abrir archivos (SFTP)**, con el mismo usuario y contraseña
- **Carpetas completas:** descargar o subir una carpeta copia todo su contenido, con una cola de transferencias que muestra el progreso y permite cancelar
- **Más detalle:** columnas de permisos y dueño, orden por columna, barra de ruta editable y atajos F2/F7/Supr
- **Sin sorpresas:** pregunta antes de sobrescribir archivos que ya existen en el destino, y cancelar detiene al instante el archivo en curso

## Git en el servidor con tu clave

- **Reenviar agente SSH (ssh -A):** nueva opción en las conexiones SSH. Comandos como `git pull` en el servidor usan la clave de tu `ssh-agent`, sin copiarla allí. Funciona en macOS, Linux y Windows (servicio OpenSSH Authentication Agent)

Consulta el capítulo [Conectar](connect) del manual.
