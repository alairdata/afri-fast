Pod::Spec.new do |s|
  s.name           = 'LoggaWidgetBridge'
  s.version        = '1.0.0'
  s.summary        = 'Shares the day snapshot with the Logga home-screen widgets through the App Group.'
  s.description    = 'Writes and reads App Group UserDefaults and reloads WidgetKit timelines.'
  s.license        = 'MIT'
  s.author         = 'Logga'
  s.homepage       = 'https://logga.app'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
