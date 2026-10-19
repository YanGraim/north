package main

import (
	"bufio"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const pin = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

func forti(extra string) string {
	return `{"cmd":"forti","host":"vpn.example.com","port":4433,"user":"ana","password":"s3cr3t","cert":"` + pin + `"` + extra + "}\n"
}

func TestParseRequestAcceptsForti(t *testing.T) {
	r, err := ParseRequest([]byte(forti(`,"realm":"staff"`)))
	if err != nil {
		t.Fatal(err)
	}
	args := strings.Join(FortiArgs(r, `C:\svc`), " ")
	for _, want := range []string{"--protocol=fortinet", "--servercert=sha256:" + pin, "--user=ana", "--usergroup=staff", "https://vpn.example.com:4433/"} {
		if !strings.Contains(args, want) {
			t.Errorf("missing %q in %s", want, args)
		}
	}
	if strings.Contains(args, "s3cr3t") {
		t.Error("password must never reach the command line")
	}
}

func TestParseRequestRejectsSmuggling(t *testing.T) {
	bad := []string{
		strings.Replace(forti(""), "vpn.example.com", "vpn.example.com --script=calc", 1),
		strings.Replace(forti(""), "vpn.example.com", "-x", 1),
		strings.Replace(forti(""), `"port":4433`, `"port":0`, 1),
		strings.Replace(forti(""), pin, "", 1),
		forti(`,"realm":"a b"`),
		forti(`,"script":"x"`),
		`{"cmd":"shell"}` + "\n",
		strings.Replace(forti(""), `"ana"`, `"ana\nx"`, 1),
	}
	for _, line := range bad {
		if _, err := ParseRequest([]byte(line)); err == nil {
			t.Errorf("accepted %s", line)
		}
	}
}

// The full service over a socket, with a fake engine: password on stdin, log streamed,
// tunnel killed when North closes the connection.
func TestServerStreamsAndStopsOnDisconnect(t *testing.T) {
	dir := t.TempDir()
	sock := filepath.Join(dir, "s")
	l, err := net.Listen("unix", sock)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	stdinFile := filepath.Join(dir, "stdin")
	srv := &Server{Dir: dir, Engine: func(_ string, args []string) *exec.Cmd {
		return exec.Command("/bin/sh", "-c", `cat > "$0"; echo "Connected as 10.0.0.5, using SSL"; sleep 30`, stdinFile)
	}}
	go srv.Serve(l)

	conn, err := net.Dial("unix", sock)
	if err != nil {
		t.Fatal(err)
	}
	conn.Write([]byte(forti("")))
	rd := bufio.NewReader(conn)
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	line, err := rd.ReadString('\n')
	if err != nil || !strings.Contains(line, "Connected as 10.0.0.5") {
		t.Fatalf("got %q %v", line, err)
	}
	got, _ := os.ReadFile(stdinFile)
	if string(got) != "s3cr3t\n" {
		t.Fatalf("stdin %q", got)
	}
	// half-close: North is gone, the service must kill the engine and report its exit
	conn.(*net.UnixConn).CloseWrite()
	line, err = rd.ReadString('\n')
	if err != nil || !strings.HasPrefix(line, "NORTH-EXIT") {
		t.Fatalf("got %q %v", line, err)
	}
}

func TestServerRefusesBadRequest(t *testing.T) {
	dir := t.TempDir()
	l, _ := net.Listen("unix", filepath.Join(dir, "s"))
	defer l.Close()
	go (&Server{Dir: dir}).Serve(l)
	conn, _ := net.Dial("unix", filepath.Join(dir, "s"))
	conn.Write([]byte(`{"cmd":"forti","host":"-oProxyCommand"}` + "\n"))
	out, _ := bufio.NewReader(conn).ReadString('\n')
	if !strings.HasPrefix(out, "ERROR: north-vpn-service: invalid host") {
		t.Fatalf("got %q", out)
	}
}

func TestRoutesValidation(t *testing.T) {
	ok := `{"cmd":"routes","gateway":"172.28.80.5","routes":["172.16.0.0/20","10.10.100.0/24"]}`
	if _, err := ParseRequest([]byte(ok)); err != nil {
		t.Fatal(err)
	}
	bad := []string{
		`{"cmd":"routes","gateway":"8.8.8.8","routes":["10.0.0.0/8"]}`,
		`{"cmd":"routes","gateway":"172.28.80.5","routes":["0.0.0.0/0"]}`,
		`{"cmd":"routes","gateway":"172.28.80.5","routes":["10.0.0.1/8"]}`,
		`{"cmd":"routes","gateway":"172.28.80.5","routes":["10.0.0.0/8 x"]}`,
		`{"cmd":"routes","gateway":"172.28.80.5","routes":[]}`,
	}
	for _, line := range bad {
		if _, err := ParseRequest([]byte(line)); err == nil {
			t.Errorf("accepted %s", line)
		}
	}
	got := strings.Join(RouteArgs(true, "172.16.0.0/20", "172.28.80.5"), " ")
	if got != "ADD 172.16.0.0 MASK 255.255.240.0 172.28.80.5 METRIC 5" {
		t.Fatal(got)
	}
}

func TestRoutesRemovedWhenNorthGoesAway(t *testing.T) {
	dir := t.TempDir()
	l, _ := net.Listen("unix", filepath.Join(dir, "s"))
	defer l.Close()
	var calls []string
	done := make(chan struct{})
	srv := &Server{Dir: dir, Route: func(args []string) error {
		calls = append(calls, args[0]+" "+args[1])
		if args[0] == "DELETE" && args[1] == "10.10.100.0" {
			close(done)
		}
		return nil
	}}
	go srv.Serve(l)
	conn, _ := net.Dial("unix", filepath.Join(dir, "s"))
	conn.Write([]byte(`{"cmd":"routes","gateway":"172.28.80.5","routes":["172.16.0.0/20","10.10.100.0/24"]}` + "\n"))
	line, _ := bufio.NewReader(conn).ReadString('\n')
	if line != "ROUTES-UP 2\n" {
		t.Fatalf("got %q", line)
	}
	conn.Close()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("routes not removed")
	}
	if strings.Join(calls, ",") != "ADD 172.16.0.0,ADD 10.10.100.0,DELETE 172.16.0.0,DELETE 10.10.100.0" {
		t.Fatal(calls)
	}
}
