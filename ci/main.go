package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"dagger.io/dagger"
	"golang.org/x/sync/errgroup"
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()
	dc, err := dagger.Connect(ctx, dagger.WithLogOutput(os.Stderr))
	if err != nil {
		log.Fatalf("Failed to connect to Dagger Engine: %s", err.Error())
	}
	defer dc.Close()

	srcDir := dc.Host().Directory(".", dagger.HostDirectoryOpts{
		Exclude: []string{
			"node_modules",
			".git",
		},
	})

	nodeCache := dc.CacheVolume("node-cache")

	nodeContainer := dc.Container().From("node:18-alpine").
		WithMountedDirectory("/src", srcDir).
		WithWorkdir("/src").
		WithMountedCache("/src/node_modules", nodeCache).
		WithExec([]string{"npm", "install"})

	grp, gctx := errgroup.WithContext(ctx)

	// Do linting
	grp.Go(func() error {
		_, err := nodeContainer.Pipeline("lint").WithExec([]string{"npm", "run", "lint"}).Sync(gctx)
		return err
	})

	// Try building the plugin
	grp.Go(func() error {
		_, err := nodeContainer.Pipeline("build").WithExec([]string{"npm", "run", "build"}).Sync(ctx)
		return err
	})

	if err := grp.Wait(); err != nil {
		log.Fatalf("Pipeline failed: %s", err.Error())
	}
}
