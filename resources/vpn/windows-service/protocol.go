package main

// Requests the service accepts. It runs as SYSTEM and anyone allowed on the pipe may talk
// to it, so it never trusts the caller: no paths, no free-form options — only the fixed
// engines next to it, with every value checked here.

import (
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

// Version is compared by North to decide whether to reinstall after an update.
const Version = "1"

type Request struct {
	Cmd      string `json:"cmd"`
	Host     string `json:"host,omitempty"`
	Port     int    `json:"port,omitempty"`
	User     string `json:"user,omitempty"`
	Password string `json:"password,omitempty"`
	Realm    string `json:"realm,omitempty"`
	Cert     string `json:"cert,omitempty"`
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
		"--script=" + filepath.Join(dir, "openconnect", "vpnc-script-win.js"),
		"--interface=North",
	}
	if r.Realm != "" {
		args = append(args, "--usergroup="+r.Realm)
	}
	return append(args, fmt.Sprintf("https://%s:%d/", r.Host, r.Port))
}
