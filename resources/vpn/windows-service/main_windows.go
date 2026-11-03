//go:build windows

// north-vpn-service: the Windows counterpart of North's root helper. Installed once with a
// UAC prompt into Program Files (admin-only writable), it runs as LocalSystem and starts
// FortiGate SSL-VPN tunnels (openconnect + Wintun) for the one user who installed it:
// the pipe's ACL only lets SYSTEM, Administrators and that user's SID connect.
//
//	north-vpn-service.exe install --user-sid S-1-5-21-…   (elevated; copies itself + engines)
//	north-vpn-service.exe uninstall                       (elevated)
//	north-vpn-service.exe service --user-sid …            (what the SCM runs)
package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"github.com/Microsoft/go-winio"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

const (
	serviceName = "NorthVpn"
	pipeName    = `\\.\pipe\north-vpn`
)

var sidRe = regexp.MustCompile(`^S-1-(5-21|12-1)(-\d{1,10}){3,5}$`)

func main() {
	if len(os.Args) < 2 {
		fail(errors.New("usage: install|uninstall|service"))
	}
	var err error
	switch os.Args[1] {
	case "install":
		err = install(userSid())
	case "uninstall":
		err = uninstall()
	case "service":
		err = svc.Run(serviceName, &handler{sid: userSid()})
	default:
		err = errors.New("unknown command")
	}
	if err != nil {
		fail(err)
	}
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "north-vpn-service:", err)
	os.Exit(1)
}

func userSid() string {
	if len(os.Args) == 4 && os.Args[2] == "--user-sid" && sidRe.MatchString(os.Args[3]) {
		return os.Args[3]
	}
	fail(errors.New("missing or invalid --user-sid"))
	return ""
}

func installDir() string {
	return filepath.Join(os.Getenv("ProgramFiles"), "North VPN Service")
}

type handler struct{ sid string }

func (h *handler) Execute(_ []string, req <-chan svc.ChangeRequest, status chan<- svc.Status) (bool, uint32) {
	status <- svc.Status{State: svc.StartPending}
	sddl := fmt.Sprintf("D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GRGW;;;%s)", h.sid)
	l, err := winio.ListenPipe(pipeName, &winio.PipeConfig{SecurityDescriptor: sddl})
	if err != nil {
		return true, 1
	}
	exe, _ := os.Executable()
	go (&Server{Dir: filepath.Dir(exe)}).Serve(l)
	status <- svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}
	for c := range req {
		switch c.Cmd {
		case svc.Interrogate:
			status <- c.CurrentStatus
		case svc.Stop, svc.Shutdown:
			status <- svc.Status{State: svc.StopPending}
			l.Close() // open tunnels die with their engine processes
			return false, 0
		}
	}
	return false, 0
}

func install(sid string) error {
	src, err := os.Executable()
	if err != nil {
		return err
	}
	dst := installDir()
	if err := uninstallService(); err != nil {
		return err
	}
	// RemoveAll fails with "Access is denied" while the previous service image is still mapped.
	// Renaming that exe frees the path; Windows allows renaming a running image.
	if err := prepareInstallDir(dst); err != nil {
		return err
	}
	// SSL-VPN ships openconnect/ next to the exe. IPsec only needs this service for routes.
	if err := copyBundledEngines(src, dst); err != nil {
		return err
	}
	exe := filepath.Join(dst, "north-vpn-service.exe")
	if err := copyFile(src, exe); err != nil {
		return err
	}
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()
	s, err := m.CreateService(serviceName, exe, mgr.Config{
		DisplayName: "North VPN",
		Description: "Starts and stops the VPNs North connects (FortiGate SSL-VPN).",
		StartType:   mgr.StartAutomatic,
	}, "service", "--user-sid", sid)
	if err != nil {
		return err
	}
	defer s.Close()
	return s.Start()
}

func uninstall() error {
	if err := uninstallService(); err != nil {
		return err
	}
	return os.RemoveAll(installDir())
}

func uninstallService() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()
	s, err := m.OpenService(serviceName)
	if err != nil {
		if errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST) {
			return nil
		}
		return err
	}
	defer s.Close()
	s.Control(svc.Stop)
	for i := 0; i < 50; i++ {
		st, err := s.Query()
		if err != nil || st.State == svc.Stopped {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	return s.Delete()
}
