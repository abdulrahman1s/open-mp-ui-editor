#!/usr/bin/python3
"""Keep CI host build scripts on the host assembler/linker inside a 32-bit Nix shell."""
import os
import sys
os.execv('/usr/bin/gcc', ['/usr/bin/gcc', '-B/usr/bin/', *sys.argv[1:]])
