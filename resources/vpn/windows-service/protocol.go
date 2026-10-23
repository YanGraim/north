package main

// Requests the service accepts. It runs as SYSTEM and anyone allowed on the pipe may talk
// to it, so it never trusts the caller: no paths, no free-form options — only the fixed
// engines next to it, with every value checked here.

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"path/filepath"
	"regexp"
	"strings"
)

// Version is compared by North to decide whether to reinstall after an update.
const Version = "2"

type Request struct {
	Cmd      string `json:"cmd"`
	Host     string `json:"host,omitempty"`
	Port     int    `json:"port,omitempty"`
	User     string `json:"user,omitempty"`
	Password string `json:"password,omitempty"`
	Realm    string `json:"realm,omitempty"`
	Cert     string `json:"cert,omitempty"`
	// "routes": Windows routes for the VPN's networks through North's WSL distro (IPsec)
	Gateway string   `json:"gateway,omitempty"`
	Routes  []string `json:"routes,omitempty"`
}

var (
	hostRe  = regexp.MustCompile(`^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$`)
	realmRe = regexp.MustCompile(`^[A-Za-z0-9._-]{0,64}$`)
	certRe  = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

// ParseRequest reads one JSON request (a single line) and validates it.
func ParseRequest(line []byte) (*Request, error) {
	if len(line) > 8192 {
		return nil, errors.New("request too large")
	}
	var r Request
	dec := json.NewDecoder(strings.NewReader(string(line)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&r); err != nil {
		return nil, fmt.Errorf("invalid request: %w", err)
	}
	switch r.Cmd {
	case "version":
		return &r, nil
	case "forti":
		if !hostRe.MatchString(r.Host) {
			return nil, errors.New("invalid host")
		}
		if r.Port < 1 || r.Port > 65535 {
			return nil, errors.New("invalid port")
		}
		if r.User == "" || len(r.User) > 128 || strings.ContainsAny(r.User, "\x00\r\n") {
			return nil, errors.New("invalid user")
		}
		if r.Password == "" || len(r.Password) > 1024 || strings.ContainsAny(r.Password, "\x00\r\n") {
			return nil, errors.New("invalid password")
		}
		if !realmRe.MatchString(r.Realm) {
			return nil, errors.New("invalid realm")
		}
		// the gateway certificate is always pinned: North checked it with the user first
		if !certRe.MatchString(r.Cert) {
			return nil, errors.New("invalid certificate pin")
		}
		return &r, nil
	case "routes":
		gw := net.ParseIP(r.Gateway).To4()
		// only a private next hop (the WSL VM): never redirect traffic to an arbitrary host
		if gw == nil || !gw.IsPrivate() {
			return nil, errors.New("invalid gateway")
		}
		if len(r.Routes) == 0 || len(r.Routes) > 64 {
			return nil, errors.New("invalid routes")
		}
		for _, cidr := range r.Routes {
			ip, n, err := net.ParseCIDR(cidr)
			if err != nil || ip.To4() == nil || !ip.Equal(n.IP) {
				return nil, errors.New("invalid route " + cidr)
			}
			// a default route through WSL would capture all traffic: not this command's job
			if ones, _ := n.Mask.Size(); ones == 0 {
				return nil, errors.New("invalid route " + cidr)
			}
		}
		return &r, nil
	}
	return nil, errors.New("unknown command")
}

// FortiArgs is the openconnect command line for a FortiGate SSL-VPN; the password goes
// on stdin. dir is the service's own (admin-only) directory.
func FortiArgs(r *Request, dir string) []string {
	args := []string{
		"--protocol=fortinet",
		"--non-inter",
		"--passwd-on-stdin",
		"--user=" + r.User,
		"--servercert=sha256:" + r.Cert,
		"--script=" + filepath.Join(dir, "openconnect", "north-vpnc-script.js"),
		"--interface=North",
		// FortiOS DTLS heartbeats look like a dead peer to openconnect, and most FortiGates
		// refuse the reconnect that follows; TLS only, like openfortivpn on macOS/Linux
		"--no-dtls",
	}
	if r.Realm != "" {
		args = append(args, "--usergroup="+r.Realm)
	}
	return append(args, fmt.Sprintf("https://%s:%d/", r.Host, r.Port))
}

// RouteArgs is the route.exe command line to add (or delete) one VPN network via WSL.
func RouteArgs(add bool, cidr, gateway string) []string {
	_, n, _ := net.ParseCIDR(cidr)
	op := "DELETE"
	if add {
		op = "ADD"
	}
	args := []string{op, n.IP.String(), "MASK", net.IP(n.Mask).String(), gateway}
	if add {
		args = append(args, "METRIC", "5")
	}
	return args
}
