//  LogWaterIntent.swift
//  Add to BOTH the app target and the widget extension target.
//  Powers the "+" water button, which works right from the home screen (iOS 17+).

import AppIntents
import UserNotifications
import WidgetKit

struct LogWaterIntent: AppIntent {
    static let title: LocalizedStringResource = "Log water"
    static let description = IntentDescription("Adds one serving of water (a glass, sachet or bottle, as you track it) to today in Logga.")

    func perform() async throws -> some IntentResult {
        var day = LoggaStore.load()
        day.waterGlasses += 1
        LoggaStore.save(day)
        // The app plans today's 15:00 "You're at X% of your water" nudge ahead of time and can't see this tap
        // until it is opened again, so drop that nudge rather than let it report stale numbers.
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["smart-water-0"])
        // WidgetKit refreshes the widgets automatically after a button intent runs.
        return .result()
    }
}
