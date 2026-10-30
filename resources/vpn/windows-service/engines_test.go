package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPrepareInstallDirRenamesWhenRemoveFails(t *testing.T) {
	dir := t.TempDir()
	exe := filepath.Join(dir, "north-vpn-service.exe")
	// A non-empty directory cannot be removed, like a service image Windows refuses to delete.
	if err := os.Mkdir(exe, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(exe, "held"), []byte("old"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := prepareInstallDir(dir); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(exe); !os.IsNotExist(err) {
		t.Fatalf("install path still occupied: %v", err)
	}
	got, err := os.ReadFile(filepath.Join(dir, "north-vpn-service.exe.old", "held"))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "old" {
		t.Fatalf("moved copy = %q", got)
	}
}

func TestCopyBundledEnginesSkipsMissingOpenconnect(t *testing.T) {
	root := t.TempDir()
	exe := filepath.Join(root, "north-vpn-service.exe")
	if err := os.WriteFile(exe, []byte("exe"), 0o644); err != nil {
		t.Fatal(err)
	}
	dst := filepath.Join(root, "install")
	if err := os.MkdirAll(dst, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := copyBundledEngines(exe, dst); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dst, "openconnect")); !os.IsNotExist(err) {
		t.Fatalf("openconnect dir created without a bundle: %v", err)
	}
}

func TestCopyBundledEnginesCopiesOpenconnect(t *testing.T) {
	root := t.TempDir()
	exe := filepath.Join(root, "north-vpn-service.exe")
	if err := os.WriteFile(exe, []byte("exe"), 0o644); err != nil {
		t.Fatal(err)
	}
	bundle := filepath.Join(root, "openconnect", "openconnect.exe")
	if err := os.MkdirAll(filepath.Dir(bundle), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(bundle, []byte("oc"), 0o644); err != nil {
		t.Fatal(err)
	}
	dst := filepath.Join(root, "install")
	if err := os.MkdirAll(dst, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := copyBundledEngines(exe, dst); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(dst, "openconnect", "openconnect.exe"))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "oc" {
		t.Fatalf("copied %q", got)
	}
}
