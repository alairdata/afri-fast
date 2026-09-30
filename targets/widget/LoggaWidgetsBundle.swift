//  LoggaWidgetsBundle.swift — widget extension target
//  Replace the bundle file Xcode generates with this one.

import SwiftUI
import WidgetKit

@main
struct LoggaWidgetsBundle: WidgetBundle {
    var body: some Widget {
        LoggaTodayWidget()
        LoggaEnergyWidget()
        LoggaYourDayWidget()
    }
}
