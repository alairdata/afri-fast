//  TodayWidget.swift — widget extension target
//  Medium widget: calories left ring, streak, water (+ button), Log meal.

import AppIntents
import SwiftUI
import WidgetKit

struct LoggaTodayWidget: Widget {
    let kind = "LoggaTodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LoggaProvider()) { entry in
            TodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Calories left, water and your streak — log in one tap.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

struct TodayWidgetView: View {
    let entry: LoggaEntry
    private var day: LoggaDay { entry.day }

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                LoggaRing(progress: day.calorieProgress, lineWidth: 11,
                          color: LoggaTheme.green, track: LoggaTheme.greenSoft)
                VStack(spacing: 0) {
                    Text("LEFT")
                        .font(.system(size: 8, weight: .heavy))
                        .kerning(1)
                        .foregroundStyle(LoggaTheme.green)
                    Text(day.caloriesLeft, format: .number)
                        .font(.loggaNumber(26))
                        .foregroundStyle(LoggaTheme.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text("of \(day.calorieGoal.formatted()) cal")
                        .font(.system(size: 9))
                        .foregroundStyle(LoggaTheme.muted)
                }
                .padding(14)
            }
            .frame(width: 106, height: 106)

            VStack(spacing: 9) {
                HStack {
                    Image("LoggaWordmark")
                        .resizable()
                        .scaledToFit()
                        .frame(height: 16)
                        .accessibilityLabel("Logga")
                    Spacer(minLength: 4)
                    StreakPill(days: day.streakDays)
                }
                WaterRow(day: day)
                LogMealButton()
            }
        }
        .padding(14)
        .containerBackground(.white, for: .widget)
        .widgetURL(LoggaLink.today)
    }
}

struct WaterRow: View {
    let day: LoggaDay

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 1) {
                    ForEach(0..<min(max(day.waterGoal, 1), 10), id: \.self) { index in
                        let filled = index < day.waterGlasses
                        Image(systemName: filled ? "drop.fill" : "drop")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(filled ? LoggaTheme.water : LoggaTheme.water.opacity(0.35))
                    }
                }
                Text("\(day.waterGlasses) of \(day.waterGoal) glasses")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(LoggaTheme.waterInk)
            }
            Spacer(minLength: 4)
            Button(intent: LogWaterIntent()) {
                Image(systemName: "plus")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(.white)
                    .frame(width: 30, height: 30)
                    .background(LoggaTheme.water, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Log a glass of water")
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 7)
        .background(LoggaTheme.waterSoft, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
    }
}

#Preview(as: .systemMedium) {
    LoggaTodayWidget()
} timeline: {
    LoggaEntry(date: .now, day: .placeholder)
}
