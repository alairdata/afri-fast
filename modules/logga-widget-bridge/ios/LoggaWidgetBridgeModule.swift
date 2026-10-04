import ExpoModulesCore
import WidgetKit

// The app's side of the widget hand-off. The widget extension reads the same App Group UserDefaults
// (targets/widget/LoggaWidgetData.swift), so the group id passed in must match it.
public class LoggaWidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LoggaWidgetBridge")

    // Returns false when the App Group is not available to this build, so the caller can tell.
    Function("setString") { (key: String, value: String, group: String) -> Bool in
      guard let defaults = UserDefaults(suiteName: group) else { return false }
      defaults.set(value, forKey: key)
      return true
    }

    Function("getString") { (key: String, group: String) -> String? in
      return UserDefaults(suiteName: group)?.string(forKey: key)
    }

    Function("remove") { (key: String, group: String) in
      UserDefaults(suiteName: group)?.removeObject(forKey: key)
    }

    Function("reloadWidgets") {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
