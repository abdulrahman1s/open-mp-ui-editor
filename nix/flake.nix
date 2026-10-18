{
  description = "open.mp UI editor: browser, Rust and native i686 development shells";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  outputs = { nixpkgs, ... }:
    let
      systems = nixpkgs.lib.genAttrs [ "x86_64-linux" "aarch64-linux" ];
    in {
      devShells = systems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          web = with pkgs; [ nodejs_24 python3 cmake ninja git pkg-config ];
          rust = with pkgs; [ cargo rustc clippy rustfmt ];
          x86 = pkgs.pkgsi686Linux;
        in {
          default = pkgs.mkShell {
            packages = web ++ rust ++ [ pkgs.gcc ];
            # Scope every Cargo command to this standalone project, regardless
            # of an enclosing workspace's inherited CARGO_TARGET_DIR.
            shellHook = ''
              export CARGO_TARGET_DIR="$PWD/target"
              echo "Editor/host shell. For native open.mp: nix develop ./nix#i686"
            '';
          };
        } // pkgs.lib.optionalAttrs (system == "x86_64-linux") {
          i686 = pkgs.mkShell {
            packages = web ++ [ x86.cargo x86.rustc x86.gcc pkgs.patchelf ];
            OMP_LOADER = "${x86.glibc}/lib/ld-linux.so.2";
            PAWN_LOADER = "${x86.glibc}/lib/ld-linux.so.2";
            LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [ x86.glibc x86.stdenv.cc.cc.lib x86.zlib ];
            shellHook = ''
              export CARGO_TARGET_DIR="$PWD/target"
              echo "i686 shell. Run python3 scripts/build.py --target i686-unknown-linux-gnu"
            '';
          };
        });
    };
}
