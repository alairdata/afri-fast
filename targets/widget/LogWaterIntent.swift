//  LogWaterIntent.swift
//  Add to BOTH the app target and the widget extension target.
//  Powers the "+" water button, which works right from the home screen (iOS 17+).

import AppIntents
import WidgetKit

struct LogWaterIntent: AppIntent {
    static let title: LocalizedStringResource = "Log a glass of water"
    static let description = IntentDescription("Adds one glass of water to today in Logga.")

    func perform() async throws -> some IntentResult {
        var day = LoggaStore.load()
        day.waterGlasses += 1
        LoggaStore.save(day)
        // WidgetKit refreshes the widgets automatically after a button intent runs.
        return .result()
    }
}
