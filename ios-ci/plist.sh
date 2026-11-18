#!/usr/bin/env bash
# Info.plist : nom, autorisations (micro, appareil photo, photos), lien de retour bond.sahbi.app://, pas de chiffrement spécial.
set -euo pipefail
P=ios/App/App/Info.plist
B=/usr/libexec/PlistBuddy
set_s() { $B -c "Delete :$1" $P 2>/dev/null || true; $B -c "Add :$1 string $2" $P; }
set_s CFBundleDisplayName "Sahbi"
set_s NSMicrophoneUsageDescription "Sahbi utilise le micro quand tu appuies sur le bouton micro, pour écrire ce que tu dis ou parler avec toi."
set_s NSCameraUsageDescription "Sahbi utilise l'appareil photo quand tu choisis de prendre une photo à envoyer."
set_s NSPhotoLibraryUsageDescription "Sahbi ouvre tes photos seulement quand tu choisis une image à envoyer."
set_s NSPhotoLibraryAddUsageDescription "Sahbi enregistre dans tes photos les images que tu choisis de télécharger."
$B -c "Delete :ITSAppUsesNonExemptEncryption" $P 2>/dev/null || true; $B -c "Add :ITSAppUsesNonExemptEncryption bool false" $P
$B -c "Delete :CFBundleURLTypes" $P 2>/dev/null || true
$B -c "Add :CFBundleURLTypes array" -c "Add :CFBundleURLTypes:0 dict" -c "Add :CFBundleURLTypes:0:CFBundleURLName string bond.sahbi.app" \
   -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string bond.sahbi.app" $P
$B -c "Delete :UISupportedInterfaceOrientations" $P 2>/dev/null || true
$B -c "Add :UISupportedInterfaceOrientations array" -c "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait" $P
echo "Info.plist prêt"
