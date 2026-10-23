// openconnect --script for North on Windows (run by cscript, JScript).
// openconnect gives the script 10 s and drops the tunnel when it runs longer, but
// vpnc-script-win.js adds one route at a time (~0.5 s each) after a ~5 s DNS step, so a
// FortiGate pushing a dozen split routes never fits. On "connect" it runs detached and
// openconnect carries on; every other reason (disconnect, reconnect) still waits for it.
var shell = WScript.CreateObject('WScript.Shell')
var reason = shell.Environment('Process')('reason')
var dir = WScript.ScriptFullName.replace(/[^\\]+$/, '')
var command = 'cscript //nologo "' + dir + 'vpnc-script-win.js"'
WScript.Quit(shell.Run(command, 0, reason !== 'connect'))
