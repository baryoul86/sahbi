# Réglages du projet Xcode de Sahbi : équipe, signature automatique (cloud), numéros de version, iPhone seulement.
require 'xcodeproj'
require 'fileutils'
p = Xcodeproj::Project.open('ios/App/App.xcodeproj')
t = p.targets.find { |x| x.name == 'App' }
t.build_configurations.each do |c|
  s = c.build_settings
  s['DEVELOPMENT_TEAM'] = ENV.fetch('TEAM')
  s['CODE_SIGN_STYLE'] = 'Automatic'
  s['MARKETING_VERSION'] = ENV.fetch('MV')
  s['CURRENT_PROJECT_VERSION'] = ENV.fetch('BN')
  s['TARGETED_DEVICE_FAMILY'] = '1'
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'bond.sahbi.app'
end
p.save
puts 'Projet Xcode préparé'

# Plugin d'achats Apple (StoreKit) : fichiers Swift ajoutés à l'app, et l'écran principal les utilise.
p = Xcodeproj::Project.open('ios/App/App.xcodeproj')
t = p.targets.find { |x| x.name == 'App' }
g = p.main_group.find_subpath('App', false) || p.main_group
%w[SahbiStorePlugin.swift SahbiViewController.swift].each do |f|
  FileUtils.cp(File.join(__dir__, 'native', f), File.join('ios/App/App', f))
  next if g.files.any? { |x| x.path == f }
  t.add_file_references([g.new_reference(f)])
end
p.save
sb = 'ios/App/App/Base.lproj/Main.storyboard'
s = File.read(sb)
s2 = s.sub(/customClass="CAPBridgeViewController" customModule="Capacitor"/, 'customClass="SahbiViewController" customModule="App" customModuleProvider="target"')
abort('Main.storyboard : CAPBridgeViewController introuvable') if s2 == s
File.write(sb, s2)
puts 'Achats Apple (StoreKit) ajoutés'

# Connexion avec Apple : droit (entitlement) dans l'app.
FileUtils.cp(File.join(__dir__, 'native', 'App.entitlements'), 'ios/App/App/App.entitlements')
p = Xcodeproj::Project.open('ios/App/App.xcodeproj')
t = p.targets.find { |x| x.name == 'App' }
t.build_configurations.each { |c| c.build_settings['CODE_SIGN_ENTITLEMENTS'] = 'App/App.entitlements' }
p.save
puts 'Connexion avec Apple ajoutée'
