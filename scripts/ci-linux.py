#!/usr/bin/env python3
"""Build with an old pinned native sysroot and the CI Rust toolchain.

No package installation or Nix store paths are embedded in distributable binaries.
"""
import os
from pathlib import Path
import subprocess
import sys
import shutil
ROOT=Path(__file__).resolve().parents[1]
NIXPKGS='github:NixOS/nixpkgs/50ab793786d9de88ee30ec4e4c24fb4236fc2674'
def run(*args,env=None):subprocess.run(args,cwd=ROOT,env=env,check=True)
def out(attribute):return subprocess.check_output(['nix','eval','--raw',NIXPKGS+'#legacyPackages.x86_64-linux.'+attribute],text=True).strip()
os.environ['CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER']=str(ROOT/'scripts/host-linker.py')
os.environ['CARGO_TARGET_I686_UNKNOWN_LINUX_GNU_LINKER']=shutil.which('gcc')
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
shutil.copy2(ROOT/'artifacts/integration.log',ROOT/'artifacts/integration-1.5.log')
run(sys.executable,'scripts/integration.py','--version','v1.6.7.3218',env=env)
shutil.copy2(ROOT/'artifacts/integration.log',ROOT/'artifacts/integration-1.6.log')
run(sys.executable,'scripts/package.py','linux-x86','build-linux/open-mp-ui-editor.so')
