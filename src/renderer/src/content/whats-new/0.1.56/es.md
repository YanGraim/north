## Workflows más fiables en la organización

- **Tags de deploy en la organización:** el campo **Tag de deploy** de los workflows de la organización vuelve a listar las tags del repositorio. Si no se pueden listar, North muestra el error en lugar de "ninguna tag"
- **Sudo sin contraseña:** en servidores con sudo sin contraseña, los pasos con sudo ya no piden la contraseña
- **Los fallos ya no pasan en silencio:** los pasos con contraseña de Git o sudo que fallaban sin aviso ahora muestran el error del comando y el workflow falla. Si algún workflow empieza a fallar, es un fallo real del servidor que antes quedaba oculto

Consulta el capítulo [Workflows](workflows) en el manual.
