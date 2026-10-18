#!/usr/bin/env python3
"""Build with an old pinned native sysroot and the CI Rust toolchain.

No package installation or Nix store paths are embedded in distributable binaries.
"""
import os
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
NIXPKGS='github:NixOS/nixpkgs/50ab793786d9de88ee30ec4e4c24fb4236fc2674'
def run(*args,env=None):subprocess.run(args,cwd=ROOT,env=env,check=True)
def out(attribute):return subprocess.check_output(['nix','eval','--raw',NIXPKGS+'#legacyPackages.x86_64-linux.'+attribute],text=True).strip()
run(sys.executable,'scripts/build.py','--target','i686-unknown-linux-gnu')
run(sys.executable,'scripts/build.py','--target','i686-unknown-linux-gnu','--test-driver')
for build in ['build-linux','build-test']:
    run('patchelf','--remove-rpath',str(ROOT/build/'open-mp-ui-editor.so'))
env=os.environ.copy()
libc=out('pkgsi686Linux.glibc.outPath')
gcc=out('pkgsi686Linux.gcc.cc.lib.outPath')
env['OMP_LOADER']=env['PAWN_LOADER']=libc+'/lib/ld-linux.so.2'
env['LD_LIBRARY_PATH']=libc+'/lib:'+gcc+'/lib'
run(sys.executable,'scripts/integration.py',env=env)
run(sys.executable,'scripts/package.py','linux-x86','build-linux/open-mp-ui-editor.so')
