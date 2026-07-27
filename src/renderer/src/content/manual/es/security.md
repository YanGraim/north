# Consejos de seguridad

- Las credenciales viven en el **vault local** (Electron `safeStorage` / keychain del SO).
- El proceso **renderer nunca** recibe secretos en claro en el flujo normal — solo en el reveal consciente (copiar/mostrar contraseña).
- La exportación del inventario **no** lleva contraseñas.
- Confirma fingerprints de host key SSH antes de aceptar.
- Prefiere contraseñas fuertes y, cuando sea posible, claves SSH en lugar de contraseña.

North es **local-first**: tus datos quedan en el dispositivo, sin nube por defecto.
