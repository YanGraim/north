package main

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

// Engine starts the tunnel program; tests swap it for a fake.
type Engine func(dir string, args []string) *exec.Cmd

func defaultEngine(dir string, args []string) *exec.Cmd {
	return exec.Command(filepath.Join(dir, "openconnect", "openconnect.exe"), args...)
}

// Route runs route.exe; tests swap it for a recorder.
type Route func(args []string) error

func defaultRoute(args []string) error {
	return exec.Command(`C:\Windows\System32\route.exe`, args...).Run()
}

type Server struct {
	Dir    string
	Engine Engine
	Route  Route
}

// Serve handles one client per connection until the listener closes.
func (s *Server) Serve(l net.Listener) error {
	for {
		conn, err := l.Accept()
		if err != nil {
			return err
		}
		go s.handle(conn)
	}
}

// One request per connection. For a tunnel the connection stays open while it runs:
// its log streams back, and closing the connection (North quit, disconnect, crash) stops it.
func (s *Server) handle(conn net.Conn) {
	defer conn.Close()
	line, err := bufio.NewReaderSize(conn, 9000).ReadSlice('\n')
	if err != nil {
		fmt.Fprintf(conn, "ERROR: %v\n", err)
		return
	}
	req, err := ParseRequest(line)
	if err != nil {
		fmt.Fprintf(conn, "ERROR: north-vpn-service: %v\nNORTH-EXIT 64\n", err)
		return
	}
	if req.Cmd == "version" {
		fmt.Fprintf(conn, "%s\n", Version)
		return
	}
	if req.Cmd == "routes" {
		s.routes(conn, req)
		return
	}

	engine := s.Engine
	if engine == nil {
		engine = defaultEngine
	}
	cmd := engine(s.Dir, FortiArgs(req, s.Dir))
	// a killed engine may leave a child holding the log pipe; don't wait on it forever
	cmd.WaitDelay = 3 * time.Second
	var mu sync.Mutex
	out := &lockedWriter{w: conn, mu: &mu}
	cmd.Stdout = out
	cmd.Stderr = out
	stdin, err := cmd.StdinPipe()
	if err == nil {
		err = cmd.Start()
	}
	if err != nil {
		fmt.Fprintf(conn, "ERROR: north-vpn-service: %v\nNORTH-EXIT 69\n", err)
		return
	}
	io.WriteString(stdin, req.Password+"\n")
	stdin.Close()

	done := make(chan struct{})
	go func() {
		// any read result (EOF, error) means North went away: stop the tunnel
		buf := make([]byte, 64)
		for {
			if _, err := conn.Read(buf); err != nil {
				break
			}
		}
		select {
		case <-done:
		default:
			cmd.Process.Kill()
		}
	}()
	err = cmd.Wait()
	close(done)
	code := 0
	if err != nil {
		code = 1
		if exit, ok := err.(*exec.ExitError); ok {
			code = exit.ExitCode()
		}
	}
	mu.Lock()
	fmt.Fprintf(conn, "NORTH-EXIT %d\n", code)
	mu.Unlock()
}

type lockedWriter struct {
	w  io.Writer
	mu *sync.Mutex
}

func (l *lockedWriter) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.w.Write(p)
}

// Adds the routes, then holds them while North keeps the connection open; any end of the
// connection (disconnect, North quit or crashed) removes them.
func (s *Server) routes(conn net.Conn, req *Request) {
	route := s.Route
	if route == nil {
		route = defaultRoute
	}
	added := []string{}
	defer func() {
		for _, cidr := range added {
			route(RouteArgs(false, cidr, req.Gateway))
		}
	}()
	for _, cidr := range req.Routes {
		if err := route(RouteArgs(true, cidr, req.Gateway)); err != nil {
			fmt.Fprintf(conn, "ERROR: route %s: %v\nNORTH-EXIT 1\n", cidr, err)
			return
		}
		added = append(added, cidr)
	}
	fmt.Fprintf(conn, "ROUTES-UP %d\n", len(added))
	buf := make([]byte, 64)
	for {
		if _, err := conn.Read(buf); err != nil {
			return
		}
	}
}
