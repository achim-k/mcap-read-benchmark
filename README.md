# MCAP read benchmark

Simple benchmark of JavaScript and WASM (Rust) MCAP reader implementations.

https://achim-k.github.io/mcap-read-benchmark/

## Building

Requires [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/) and the [Rust toolchain](https://www.rust-lang.org/tools/install).

```sh
wasm-pack build --release read_mcap_wasm
npm install
npm -w web run build
```