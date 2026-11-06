## Workflows en la organización

- **Workflows para el equipo:** los workflows y las variables del grupo ahora quedan en la organización. Quien ve el grupo los ejecuta; Editor y Admin los cambian
- **La VPN se conecta en el workflow:** si el cliente usa VPN, se conecta antes del primer paso y se desconecta al final, en Mi workspace y en la organización
- **Quién actualizó:** Últimas actualizaciones muestra quién ejecutó cada workflow con rastreo Git
- **Copia completa:** Copiar a workspace y Copiar de Mi workspace ahora llevan también los workflows y las variables
- **Tus equipos:** en Configuración, ve tu rol y de qué equipos formas parte
- **Panel admin:** marca varios elementos (o todos los clientes) y compártelos de una vez
- **Corrección:** un workflow que no podía conectar se quedaba "ejecutando" para siempre; ahora termina como fallo y muestra el error
- **Agente SSH en workflows:** las conexiones con "Reenviar agente SSH" ahora llevan el agente a los pasos del workflow, como en la terminal (ej.: `git pull` con tu clave)
- **OpenVPN en Windows:** corrige la conexión en notebooks de empresa (cuenta de dominio o Entra ID) y cuando OpenVPN ya estaba instalado; si OpenVPN termina antes de conectar, el log de la VPN ahora muestra el motivo

Ve el capítulo [Workflows](workflows) en el manual.
