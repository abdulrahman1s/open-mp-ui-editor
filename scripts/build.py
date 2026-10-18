#!/usr/bin/env python3
"""Build the Rust runtime and matching open.mp component; no runtime staging."""
import argparse
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def run(*command, env=None):
    subprocess.run(command, cwd=ROOT, env=env, check=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', required=True, choices=['i686-unknown-linux-gnu', 'i686-pc-windows-msvc'])
    parser.add_argument('--test-driver', action='store_true')
    parser.add_argument('--deps', type=Path)
    args = parser.parse_args()
    env = os.environ.copy()
    env['CARGO_TARGET_DIR'] = str(ROOT / 'target')
    run('cargo', 'build', '--locked', '--release', '--lib', '--target', args.target, env=env)
    windows = args.target.endswith('msvc')
    library = ROOT / 'target' / args.target / 'release' / ('open_mp_ui_runtime.lib' if windows else 'libopen_mp_ui_runtime.a')
    build = ROOT / ('build-test' if args.test_driver else 'build-' + ('windows' if windows else 'linux'))
    command = ['cmake', '-S', str(ROOT/'plugin'), '-B', str(build), '-DCMAKE_BUILD_TYPE=Release', '-DUI_RUST_LIBRARY='+str(library), '-DUI_TEST_DRIVER='+('ON' if args.test_driver else 'OFF')]
    if windows:
        command += ['-A', 'Win32']
    else:
        command += ['-G', 'Ninja', '-DCMAKE_C_COMPILER=gcc', '-DCMAKE_CXX_COMPILER=g++', '-DCMAKE_C_FLAGS=-m32', '-DCMAKE_CXX_FLAGS=-m32']
    if args.deps:
        command += ['-DFETCHCONTENT_SOURCE_DIR_OMP_DEPS='+str(args.deps.resolve())]
    run(*command)
    run('cmake', '--build', str(build), '--config', 'Release', '--parallel', '2')

if __name__ == '__main__':
    main()
