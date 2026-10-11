#!/usr/bin/env bash
# PRIVATE operator build; no ROMs, automatic clone, deployment or approval.
set -euo pipefail
set +x
PIN="220421984e710758cb691dcd1dd6a757ae9aca72"
if [[ "$#" -ne 2 ]]; then
  echo "Usage: bash scripts/sega-build-jgenesis-wasm.sh /private/pinned-patched/jgenesis /private/output" >&2
  exit 2
fi
root="$(cd "$1" && pwd -P)"
mkdir -p "$2"
out="$(cd "$2" && pwd -P)"
jhadina_root="$(cd "$(dirname "$0")/.." && pwd -P)"
for forbidden in "$root" "$jhadina_root"; do
  if [[ "$out" == "$forbidden" || "$out" == "$forbidden/"* ]]; then
    echo "STOP: output cannot enter a source tree" >&2; exit 2
  fi
done
if [[ -n "$(ls -A "$out")" ]]; then
  echo "STOP: output must be empty" >&2; exit 2
fi
actual="$(git -C "$root" rev-parse HEAD)"
if [[ "$actual" != "$PIN" ]]; then
  echo "STOP: wrong Jgenesis source revision" >&2; exit 3
fi
expected="$(printf '%s\n' frontend/jgenesis-web/js/idb.js frontend/jgenesis-web/js/ui.js frontend/jgenesis-web/src/audio.rs frontend/jgenesis-web/src/config.rs frontend/jgenesis-web/src/lib.rs)"
modified="$(git -C "$root" diff --name-only | LC_ALL=C sort)"
if [[ "$modified" != "$expected" ]]; then
  echo "STOP: source must contain exactly four reviewed bridge edits" >&2; exit 3
fi
git -C "$root" diff --check
for marker in request_open_verified_rom request_genesis_input; do
  grep -Fq "$marker" "$root/frontend/jgenesis-web/src/config.rs" ||
    { echo "STOP: Jgenesis bridge not prepared" >&2; exit 3; }
done
test -f "$root/LICENSE" || { echo "STOP: missing GPL notice" >&2; exit 3; }
for dep in git rustup wasm-pack node; do
  command -v "$dep" >/dev/null || { echo "Missing build dependency: $dep" >&2; exit 4; }
done
web="$root/frontend/jgenesis-web"
(
  cd "$web"
  bash ./build.sh
)
test -f "$web/pkg/jgenesis_web.js"
test -f "$web/pkg/jgenesis_web_bg.wasm"
mkdir -p "$out/pkg" "$out/js"
cp "$web/pkg/jgenesis_web.js" "$out/pkg/jgenesis_web.js"
cp "$web/pkg/jgenesis_web_bg.wasm" "$out/pkg/jgenesis_web_bg.wasm"
# wasm-bindgen imports source JS modules into generated pkg/snippets/.
# These modules MUST accompany the compiled wrapper, not be loaded via raw web URLs.
test -d "$web/pkg/snippets" || { echo "Missing generated wasm-bindgen snippets" >&2; exit 5; }
while IFS= read -r -d '' snippet; do
  relative="${snippet#"$web/pkg/"}"
  mkdir -p "$out/pkg/$(dirname "$relative")"
  cp "$snippet" "$out/pkg/$relative"
done < <(find "$web/pkg/snippets" -type f -name '*.js' -print0)
test "$(find "$out/pkg/snippets" -type f -name '*.js' | wc -l)" -ge 3
cp "$web/js/audio-processor.js" "$out/js/audio-processor.js"
cp "$web/js/polyfill.js" "$out/js/polyfill.js"
cp "$jhadina_root/apps/jhadina-web/public/gaming/sega/vendor/js/ui.js" "$out/js/ui.js"
cp "$jhadina_root/apps/jhadina-web/public/gaming/sega/vendor/js/idb.js" "$out/js/idb.js"
cp "$root/LICENSE" "$out/LICENSE.jgenesis"
JHADINA_SEGA_OUTPUT="$out" JHADINA_SEGA_COMMIT="$actual" node <<'NODE'
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.env.JHADINA_SEGA_OUTPUT;
const filenames=[
 'pkg/jgenesis_web.js','pkg/jgenesis_web_bg.wasm',
 'js/ui.js','js/idb.js','js/audio-processor.js','js/polyfill.js'
];
const snippetDir=path.join(root,'pkg/snippets');
function recursiveJs(directory){
 return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const full=path.join(directory,entry.name);
  if(entry.isDirectory())return recursiveJs(full);
  if(!entry.isFile()||!entry.name.endsWith('.js'))throw Error('Unexpected wasm-bindgen snippet');
  return [path.relative(root,full).replaceAll(path.sep,'/')];
 });
}
filenames.push(...recursiveJs(snippetDir));

const files=Object.fromEntries(filenames.map(name=>[
 name,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')
]));
const manifest={
 schema:'jhadina.sega.jgenesis.unapproved-build.v1',
 sourceCommit:process.env.JHADINA_SEGA_COMMIT,
 bridgeApi:'jhadina.sega.jgenesis.bridge.v1',
 operatorApproved:false,
 licenseReviewed:false,
 license:'GPL-3.0',
 files
};
fs.writeFileSync(path.join(root,'manifest.unapproved.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('SHA-256 manifest emitted. NOT APPROVED OR DEPLOYED:',root);
NODE
echo "Build artifacts require independent review and deployment into /gaming/sega/vendor/ with manifest.approved.json."
