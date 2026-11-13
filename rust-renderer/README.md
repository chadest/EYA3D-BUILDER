# Eya3D Rust/WASM 3D Rendering Core (`wgpu` + `wasm-bindgen`)

Ce crate implémente le cœur du moteur de rendu 3D PBR d'Eya3D en **Rust** avec **wgpu** (ciblant WebGPU et WebGL2 en repli) et **WGSL** (BRDF Cook-Torrance + tone mapping ACES Filmic).

## Compilation locale vers WebAssembly

```bash
# 1. Installer la cible wasm32 et wasm-pack
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

# 2. Compiler le paquet WASM dans public/wasm/
cd rust-renderer
wasm-pack build --target web --release --out-dir ../public/wasm
```

Une fois généré dans `public/wasm/eya3d_rust_renderer.js`, le pont TypeScript `src/core/rendering/rustWasmBridge.ts` détecte et charge automatiquement le binaire WASM.
