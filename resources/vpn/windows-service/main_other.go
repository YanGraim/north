//go:build !windows

package main

import (
	"fmt"
	"os"
)

// Only the Windows build is shipped; elsewhere this exists for the tests.
func main() {
	fmt.Fprintln(os.Stderr, "north-vpn-service runs on Windows only")
	os.Exit(1)
}
