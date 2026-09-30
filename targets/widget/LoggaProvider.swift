//  LoggaProvider.swift — widget extension target

import WidgetKit

struct LoggaEntry: TimelineEntry {
    let date: Date
    let day: LoggaDay
}

struct LoggaProvider: TimelineProvider {
    func placeholder(in context: Context) -> LoggaEntry {
        LoggaEntry(date: .now, day: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (LoggaEntry) -> Void) {
        let day = context.isPreview ? LoggaDay.placeholder : LoggaStore.load()
        completion(LoggaEntry(date: .now, day: day))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LoggaEntry>) -> Void) {
        let now = Date()
        let calendar = Calendar.current
        let day = LoggaStore.load(now: now)

        // Hourly entries so the energy score keeps pace with the time of day.
        let entries = (0..<6).compactMap { hour -> LoggaEntry? in
            guard let date = calendar.date(byAdding: .hour, value: hour, to: now) else { return nil }
            return LoggaEntry(date: date, day: day)
        }

        // Refresh again in 6 hours, or at midnight so counters reset — whichever comes first.
        let sixHours = calendar.date(byAdding: .hour, value: 6, to: now) ?? now
        let midnight = calendar.startOfDay(for: calendar.date(byAdding: .day, value: 1, to: now) ?? now)
        completion(Timeline(entries: entries, policy: .after(min(sixHours, midnight))))
    }
}
