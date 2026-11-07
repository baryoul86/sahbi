#!/usr/bin/env bash
# Costruisce l'app Android di Sahbi (Trusted Web Activity) su GitHub Actions.
# Chiave di caricamento: protetta dalla password nel segreto SAHBI_KEY_PASSWORD e salvata cifrata nel ramo "android-key".
# Senza segreto si costruisce una versione di PROVA con una chiave usa e getta (da NON caricare su Google Play).
set -euo pipefail
ROOT="$(pwd)"
OUT="$ROOT/out"; mkdir -p "$OUT"
cd android

RUN="${RUN:-1}"
P="${KEY_PASSWORD:-}"
REPO_URL="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"

echo "== Chiave di firma"
if [ -z "$P" ]; then
  echo "ATTENZIONE: segreto SAHBI_KEY_PASSWORD assente → versione di PROVA con chiave usa e getta."
  P="prova-$(date +%s)-$RANDOM"
  keytool -genkeypair -keystore upload.jks -alias sahbi -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$P" -keypass "$P" -dname "CN=Sahbi PROVA, O=Sahbi, C=FR" >/dev/null
  echo "PROVA" > "$OUT/LEGGIMI-VERSIONE-DI-PROVA.txt"
elif git ls-remote --exit-code --heads "$REPO_URL" android-key >/dev/null 2>&1; then
  echo "Chiave esistente: la recupero dal ramo android-key."
  git fetch -q "$REPO_URL" android-key
  git show FETCH_HEAD:upload.jks.enc > upload.jks.enc
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:KEY_PASSWORD -in upload.jks.enc -out upload.jks
else
  echo "Prima volta: creo la chiave di caricamento e la salvo cifrata nel ramo android-key."
  keytool -genkeypair -keystore upload.jks -alias sahbi -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$P" -keypass "$P" -dname "CN=Sahbi, O=Sahbi, C=FR" >/dev/null
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:KEY_PASSWORD -in upload.jks -out upload.jks.enc
  tmp="$(mktemp -d)"; cp upload.jks.enc "$tmp/"
  printf 'Chiave di caricamento di Sahbi (Google Play), CIFRATA.\nSi apre solo con la password salvata nel segreto GitHub SAHBI_KEY_PASSWORD.\nNon cancellare questo ramo.\n' > "$tmp/LEGGIMI.txt"
  ( cd "$tmp" && git init -q && git checkout -q -b android-key && git add . \
    && git -c user.name="sahbi-bot" -c user.email="bot@sahbi.bond" commit -qm "Chiave di caricamento cifrata" \
    && git push -q "$REPO_URL" android-key )
fi
export KEY_PASSWORD="$P"
keytool -list -v -keystore upload.jks -alias sahbi -storepass "$P" | grep -E "SHA256:" | sed 's/.*SHA256: *//' > "$OUT/sha256.txt"
echo "Impronta SHA-256 della chiave di caricamento: $(cat "$OUT/sha256.txt")"

echo "== Progetto Android (Bubblewrap)"
npm install -g @bubblewrap/cli >/dev/null 2>&1
mkdir -p ~/.bubblewrap
printf '{"jdkPath":"%s","androidSdkPath":"%s"}\n' "$JAVA_HOME" "$ANDROID_HOME" > ~/.bubblewrap/config.json
# Numero di versione che sale da solo a ogni costruzione (Google Play lo richiede).
jq --argjson c "$RUN" --arg n "1.0.$RUN" '.appVersionCode=$c | .appVersionName=$n | .appVersion=$n' twa-manifest.json > t.json && mv t.json twa-manifest.json
bubblewrap update --skipVersionUpgrade < /dev/null

echo "== Compilazione"
chmod +x ./gradlew
./gradlew --no-daemon -q bundleRelease assembleRelease

echo "== Firma"
BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
AAB="$(ls app/build/outputs/bundle/release/*.aab | head -1)"
APKU="$(ls app/build/outputs/apk/release/*.apk | head -1)"
cp "$AAB" "$OUT/sahbi-$RUN.aab"
jarsigner -keystore upload.jks -storepass "$P" -keypass "$P" -sigalg SHA256withRSA -digestalg SHA-256 "$OUT/sahbi-$RUN.aab" sahbi >/dev/null
"$BT/zipalign" -f -p 4 "$APKU" "$OUT/aligned.apk"
"$BT/apksigner" sign --ks upload.jks --ks-key-alias sahbi --ks-pass env:KEY_PASSWORD --key-pass env:KEY_PASSWORD --out "$OUT/sahbi-$RUN.apk" "$OUT/aligned.apk"
rm -f "$OUT/aligned.apk" upload.jks
ls -la "$OUT"
echo "== FATTO"
