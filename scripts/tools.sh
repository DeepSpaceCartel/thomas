#!/usr/bin/env bash
# Installs the real, current latest kubectl/helm into ~/.local/bin.
#
# This is the single source of truth both local dev (`npm run
# install:tools`) and CI (real-tests.yml, cleanup-stale-releases.yml)
# use to get their tools — running the exact same install logic in
# both places, rather than dev pinning to whatever a contributor
# happened to install once and CI separately resolving "latest"
# through a different mechanism (azure/setup-helm/azure/setup-kubectl),
# which is exactly what silently drifted CI onto Helm v4 while every
# real scenario in this suite was written/verified against Helm v3 (see
# docs/project/ci.md). No sudo needed - everything installs into a
# user-writable directory.
set -euo pipefail

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$ARCH" in
  x86_64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

BIN_DIR="${TOOLS_BIN_DIR:-$HOME/.local/bin}"
mkdir -p "$BIN_DIR"

echo "==> Installing latest kubectl ($OS/$ARCH)"
KUBECTL_VERSION=$(curl -fsSL https://dl.k8s.io/release/stable.txt)
curl -fsSL "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/${OS}/${ARCH}/kubectl" -o "$BIN_DIR/kubectl"
chmod +x "$BIN_DIR/kubectl"
echo "    kubectl ${KUBECTL_VERSION} -> $BIN_DIR/kubectl"

echo "==> Installing latest helm ($OS/$ARCH)"
HELM_VERSION=$(curl -fsSL https://api.github.com/repos/helm/helm/releases/latest | grep -m1 '"tag_name"' | sed -E 's/.*"(v[^"]+)".*/\1/')
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT
curl -fsSL "https://get.helm.sh/helm-${HELM_VERSION}-${OS}-${ARCH}.tar.gz" -o "$WORKDIR/helm.tar.gz"
tar -xzf "$WORKDIR/helm.tar.gz" -C "$WORKDIR" "${OS}-${ARCH}/helm"
mv "$WORKDIR/${OS}-${ARCH}/helm" "$BIN_DIR/helm"
chmod +x "$BIN_DIR/helm"
echo "    helm ${HELM_VERSION} -> $BIN_DIR/helm"

echo
echo "==> Installed. Make sure $BIN_DIR is on PATH:"
echo "    export PATH=\"$BIN_DIR:\$PATH\""
echo
"$BIN_DIR/kubectl" version --client
"$BIN_DIR/helm" version
