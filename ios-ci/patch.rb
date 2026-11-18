# Réglages du projet Xcode de Sahbi : équipe, signature manuelle, numéros de version, iPhone seulement.
require 'xcodeproj'
p = Xcodeproj::Project.open('ios/App/App.xcodeproj')
t = p.targets.find { |x| x.name == 'App' }
t.build_configurations.each do |c|
  s = c.build_settings
  s['DEVELOPMENT_TEAM'] = ENV.fetch('TEAM')
  s['CODE_SIGN_STYLE'] = 'Manual'
  s['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
  s['CODE_SIGN_IDENTITY[sdk=iphoneos*]'] = 'Apple Distribution'
  s['PROVISIONING_PROFILE_SPECIFIER'] = 'Sahbi AppStore CI'
  s['MARKETING_VERSION'] = ENV.fetch('MV')
  s['CURRENT_PROJECT_VERSION'] = ENV.fetch('BN')
  s['TARGETED_DEVICE_FAMILY'] = '1'
  s['PRODUCT_BUNDLE_IDENTIFIER'] = 'bond.sahbi.app'
end
p.save
puts 'Projet Xcode préparé'
