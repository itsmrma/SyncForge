# GLib 0.18.5 security backport

This directory contains the complete crates.io `glib` 0.18.5 source, licensed
under the included MIT license. Upstream source commit:
`42b9caf98e03ded086362d9653ca58fe94dc8658` in `gtk-rs/gtk-rs-core`.
Only Cargo's local `.cargo-ok` cache marker is omitted.

The only Rust source change is the backport of
https://github.com/gtk-rs/gtk-rs-core/pull/1343 in `src/variant_iter.rs`:
`VariantStrIter::impl_get` initializes a mutable pointer and passes `&mut p`
to the variadic GLib out-parameter. This fixes the undefined behavior described
by RUSTSEC-2024-0429 / GHSA-wrw7-89jp-8q8g.

Tauri v2's GTK3 dependency requires GLib 0.18, so adding GLib >=0.20 would leave
the vulnerable 0.18 dependency in the graph. The workspace `[patch.crates-io]`
redirects all 0.18 consumers to this source without changing its API or version.
Version-based scanners may still flag 0.18.5; no advisory is suppressed.

On Linux with GLib development libraries installed, run the upstream iterator
regressions with optimizations (the original bug can disappear in debug builds):

```sh
cargo test --manifest-path vendor/glib/Cargo.toml --release --lib variant_iter::tests::test_variant_str_iter
```

Remove this override when Tauri supports a patched registry version throughout
its GTK dependency graph.
