#!/usr/bin/env python3
"""Reproducible binary/include/example release archive and SHA-256 manifest."""
import argparse
import hashlib
from pathlib import Path
import zipfile
import tomllib
ROOT = Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('platform',choices=['linux-x86','windows-x86'])
parser.add_argument('binary',type=Path)
args=parser.parse_args()
binary=args.binary.resolve()
if not binary.is_file():
    raise SystemExit('Native component binary not found')
if b'UITest_Click\0' in binary.read_bytes():
    raise SystemExit('Refusing to package a test-driver binary')
output=ROOT/'artifacts';output.mkdir(exist_ok=True)
version=tomllib.loads((ROOT/'Cargo.toml').read_text())['package']['version']
name='open-mp-ui-editor-'+version+'-'+args.platform+'.zip'
files=[(binary,'components/'+binary.name)]
for directory in ['pawn/include','pawn/examples','examples','shared','docs','LICENSES']:
    files += [(p,str(p.relative_to(ROOT))) for p in (ROOT/directory).rglob('*') if p.is_file()]
files += [(ROOT/n,n) for n in ['README.md','LICENSE','THIRD_PARTY_NOTICES.md','CHANGELOG.md']]
with zipfile.ZipFile(output/name,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for path,relative in sorted(files,key=lambda item:item[1]):
        entry=zipfile.ZipInfo(relative,date_time=(2026,1,1,0,0,0))
        entry.compress_type=zipfile.ZIP_DEFLATED
        entry.external_attr=0o100644<<16
        archive.writestr(entry,path.read_bytes())
digest=hashlib.sha256((output/name).read_bytes()).hexdigest()
(output/(name+'.sha256')).write_text(digest+'  '+name+'\n')
print(output/name)
