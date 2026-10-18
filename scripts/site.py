#!/usr/bin/env python3
"""Stage an explicit public allowlist for GitHub Pages; no game assets or fixtures."""
from pathlib import Path
import shutil
ROOT = Path(__file__).resolve().parents[1]
site = ROOT/'site'
if site.exists():
    shutil.rmtree(site)
site.mkdir()
for name in ['index.html', 'editor.css', 'history.js', 'guides.js', 'resize.js', 'layers.js',
             'sprites.js', 'defaults.js', 'model.js', 'stylesheet.js', 'actions.js', 'states.js',
             'variables.js', 'text-variables.js', 'canvas-text.js', 'public-preview.js', 'shared-export.js']:
    shutil.copy2(ROOT/'editor'/name, site/name)
shutil.copytree(ROOT/'editor/dist',site/'dist')
shutil.copy2(ROOT/'shared/ui.schema.json', site/'ui.schema.json')
shutil.copytree(ROOT/'examples',site/'examples')
(site/'.nojekyll').touch()
print('Static editor staged in site/ (relative assets support any repository subpath).')
