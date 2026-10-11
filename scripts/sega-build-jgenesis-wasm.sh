#!/usr/bin/env bash
# Operator-run only; no cloning, downloading, deployment or ROM ingestion.
# Produce an UNAPPROVED browser WASM artifact for license/security review.
set -euo pipefail
set +x

PINNED_JGENESIS_COMMIT="220421984e710758cb691dcd1dd6a757ae9aca72"
if [[ "$#" -ne 2 ]]; then
  echo "Usage: bash scripts/sega-build-jgenesis-wasm.sh /path/to/pinned/jgenesis /path/to/private/output" >&2
  exit 2
fi
source_root="$(cd "$1" && pwd -P)"
mkdir -p "$2"
output_root="$(cd "$2" && pwd -P)"
if [[ "$output_root" == "$source_root" || "$output_root" == "$source_root/"* ]]; then
  echo "Build artifacts must be outside the upstream source checkout" >&2
  exit 2
fi
jhadina_root="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -n "$jhadina_root" && ( "$output_root" == "$jhadina_root" || "$output_root" == "$jhadina_root/"* ) ]]; then
  echo "STOP: output must remain outside the Jhadina source tree" >&2
  exit 2
fi
if [[ -n "$(ls -A "$output_root")" ]]; then
  echo "STOP: select an empty destination to prevent mixed-build evidence" >&2
  exit 2
fi
actual="$(git -C "$source_root" rev-parse HEAD)"
if [[ "$actual" != "$PINNED_JGENESIS_COMMIT" ]]; then
  echo "STOP: reviewed jgenesis commit mismatch. Expected $PINNED_JGENESIS_COMMIT, got $actual" >&2
  exit 3
fi
if [[ -n "$(git -C "$source_root" status --porcelain --untracked-files=no)" ]]; then
  echo "STOP: source checkout contains modified tracked files" >&2
  exit 3
fi
test -f "$source_root/LICENSE" || { echo "Missing upstream LICENSE" >&2; exit 3; }
for dep in git rustup wasm-pack node; do
  command -v "$dep" >/dev/null || { echo "Missing build dependency: $dep" >&2; exit 4; }
done
web="$source_root/frontend/jgenesis-web"
test -f "$web/build.sh" || { echo "Missing reviewed jgenesis web build script" >&2; exit 3; }
echo "Building source-pinned jgenesis-web; no private cartridges or credentials are needed."
(
  cd "$web"
  bash ./build.sh
)
pkg="$web/pkg"
test -d "$pkg" || { echo "No wasm-pack output produced" >&2; exit 5; }
while IFS= read -r -d '' item; do
  cp "$item" "$output_root/"
done < <(find "$pkg" -maxdepth 1 -type f \( -name '*.js' -o -name '*.wasm' -o -name '*.d.ts' -o -name 'package.json' \) -print0)
cp "$source_root/LICENSE" "$output_root/LICENSE.jgenesis"
JHADINA_SEGA_COMMIT="$actual" JHADINA_SEGA_OUTPUT="$output_root" node <<'NODE'
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const base=process.env.JHADINA_SEGA_OUTPUT;
const artifactFiles=fs.readdirSync(base)
 .filter(name=>/\.(?:js|wasm|d\.ts)$/.test(name)||name==='package.json')
 .sort();
if(!artifactFiles.some(name=>name.endsWith('.wasm'))||
   !artifactFiles.some(name=>name.endsWith('.js')))
 throw Error('Expected wasm-pack JS and WASM outputs');
const artifacts=artifactFiles.map(name=>{
 const bytes=fs.readFileSync(path.join(base,name));
 return {name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
});
const manifest={
 schema:'jhadina.sega.jgenesis.unapproved-build.v1',
 upstream:'jsgroth/jgenesis',
 sourceCommit:process.env.JHADINA_SEGA_COMMIT,
 license:'GPL-3.0',
 approvedForDeployment:false,
 privatelyStaged:true,
 artifacts
};
fs.writeFileSync(path.join(base,'manifest.unapproved.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('UNAPPROVED browser artifacts hashed and staged in',base);
NODE
echo "STOP: independent source/binary/license review and real iPhone testing are required before installation."
