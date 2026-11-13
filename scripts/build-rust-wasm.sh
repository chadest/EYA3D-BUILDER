#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRATE_DIR="${ROOT_DIR}/rust-renderer"
OUT_DIR="${ROOT_DIR}/public/wasm"

echo "[Eya3D] Vérification de la chaîne Rust/WASM..."

if ! command -v rustc >/dev/null 2>&1 || ! command -v cargo >/dev/null 2>&1; then
  echo "Erreur: rustc/cargo introuvable. Installez Rust via https://rustup.rs" >&2
  exit 1
fi

if command -v rustup >/dev/null 2>&1; then
  if ! rustup target list --installed | grep -q "wasm32-unknown-unknown"; then
    echo "[Eya3D] Ajout de la cible wasm32-unknown-unknown..."
    rustup target add wasm32-unknown-unknown
  fi
fi

if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "[Eya3D] Installation de wasm-pack..."
  cargo install wasm-pack --locked
fi

mkdir -p "${OUT_DIR}"

echo "[Eya3D] Compilation du cœur de rendu 3D Rust vers WebAssembly..."
wasm-pack build "${CRATE_DIR}" \
  --target web \
  --release \
  --out-dir "${OUT_DIR}" \
  --out-name eya3d_rust_renderer

# Nettoyage des métadonnées générées par wasm-pack pour éviter qu'elles polluent public/wasm/
rm -f "${OUT_DIR}/.gitignore" "${OUT_DIR}/package.json" "${OUT_DIR}/README.md"

echo "[Eya3D] Compilation Rust/WASM terminée avec succès dans public/wasm/ :"
ls -lh "${OUT_DIR}"
