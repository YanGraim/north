package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// prepareInstallDir makes room for a new north-vpn-service.exe. A running image cannot be
// deleted; renaming it aside is enough for the copy that follows.
func prepareInstallDir(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	exe := filepath.Join(dir, "north-vpn-service.exe")
	if _, err := os.Stat(exe); os.IsNotExist(err) {
		return nil
	}
	if err := os.Remove(exe); err == nil {
		return nil
	}
	old := exe + ".old"
	_ = os.Remove(old)
	if err := os.Rename(exe, old); err != nil {
		return fmt.Errorf("remove %s: %w", exe, err)
	}
	return nil
}

// copyBundledEngines copies openconnect/ from beside the service exe into the install dir.
// A dev build that only has IPsec (WSL) does not ship that folder; routes still work.
func copyBundledEngines(srcExe, dstDir string) error {
	engines := filepath.Join(filepath.Dir(srcExe), "openconnect")
	info, err := os.Stat(engines)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("copy engines: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("copy engines: openconnect is not a directory")
	}
	if err := copyTree(engines, filepath.Join(dstDir, "openconnect")); err != nil {
		return fmt.Errorf("copy engines: %w", err)
	}
	return nil
}

func copyTree(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, path)
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		return copyFile(path, target)
	})
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}
