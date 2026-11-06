## La VPN de cada uno en la organización

- **Cada uno con su VPN, en el mismo workspace:** en la organización, la pantalla VPNs muestra solo las VPN que usas allí, y la VPN de cada cliente es elección tuya: otra persona puede usar otro gateway u otro login sin cambiar la tuya, y apagar tu VPN nunca desconecta la de nadie. La primera elección se vuelve sugerencia para quien llega después
- **OpenVPN en el cliente y el entorno:** ahora puedes elegir una VPN OpenVPN para un cliente o entorno de la organización. El servidor guarda solo la dirección de la VPN; el certificado y la clave de tu `.ovpn` no salen de tu equipo
- **Cada uno con su .ovpn:** quien importó su propio `.ovpn` en North se conecta solo; quien aún no lo tiene recibe el aviso para importarlo
- **Error al guardar la VPN:** si no se puede guardar la VPN de un cliente o entorno, North ahora muestra el motivo en lugar de no hacer nada

Ve el capítulo [VPNs](vpns) en el manual.
