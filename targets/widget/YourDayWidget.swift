//  YourDayWidget.swift — widget extension target
//  Large widget: calories panel, week streak, water + Log meal buttons.

import AppIntents
import SwiftUI
import WidgetKit

struct LoggaYourDayWidget: Widget {
    let kind = "LoggaYourDayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LoggaProvider()) { entry in
            YourDayWidgetView(entry: entry)
        }
        .configurationDisplayName("Your day")
        .description("Your calories, weekly streak and quick logging in one place.")
        .supportedFamilies([.systemLarge])
        .contentMarginsDisabled()
    }
}

struct YourDayWidgetView: View {
    let entry: LoggaEntry
    private var day: LoggaDay { entry.day }

    var body: some View {
        VStack(spacing: 11) {
            HStack {
                Image("LoggaWordmark")
                    .resizable()
                    .scaledToFit()
                    .frame(height: 18)
                    .accessibilityLabel("Logga")
                Spacer()
                Text("Your day")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(LoggaTheme.muted)
            }

            // Calories panel
            HStack(spacing: 18) {
                ZStack {
                    LoggaRing(progress: day.calorieProgress, lineWidth: 13,
                              color: LoggaTheme.amber, track: Color.white.opacity(0.14))
                    VStack(spacing: 0) {
                        Text("LEFT TODAY")
                            .font(.system(size: 8, weight: .heavy))
                            .kerning(1)
                            .foregroundStyle(LoggaTheme.amber)
                        Text(day.caloriesLeft, format: .number)
                            .font(.loggaNumber(32))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                        Text("calories")
                            .font(.system(size: 9))
                            .foregroundStyle(LoggaTheme.onForest)
                    }
                    .padding(16)
                }
                .frame(width: 124, height: 124)

                VStack(alignment: .leading, spacing: 9) {
                    StatBlock(title: "EATEN", value: day.caloriesEaten)
                    Rectangle().fill(Color.white.opacity(0.14)).frame(height: 1)
                    StatBlock(title: "DAILY GOAL", value: day.calorieGoal)
                }
                Spacer(minLength: 0)
            }
            .padding(15)
            .frame(maxWidth: .infinity)
            .background(LoggaTheme.forest, in: RoundedRectangle(cornerRadius: 17, style: .continuous))

            WeekCard(day: day)

            // Actions
            HStack(spacing: 8) {
                Button(intent: LogWaterIntent()) {
                    HStack(spacing: 5) {
                        Image(systemName: "drop.fill").foregroundStyle(LoggaTheme.water)
                        Text("Water \(day.waterGlasses)/\(day.waterGoal)")
                    }
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(LoggaTheme.waterInk)
                    .frame(maxWidth: .infinity)
                    .frame(height: 34)
                    .background(Color(hex: 0xE4F0F9), in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Log a glass of water")

                LogMealButton(height: 34)
            }
        }
        .padding(15)
        .containerBackground(LoggaTheme.cream, for: .widget)
    }
}

private struct StatBlock: View {
    let title: String
    let value: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.system(size: 9, weight: .heavy))
                .kerning(1)
                .foregroundStyle(Color(hex: 0x9FC3B1))
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(value, format: .number)
                    .font(.loggaNumber(24))
                    .foregroundStyle(.white)
                Text("cal")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(LoggaTheme.onForest)
            }
        }
    }
}

private struct WeekCard: View {
    let day: LoggaDay
    private let labels = ["M", "T", "W", "T", "F", "S", "S"]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("This week")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundStyle(LoggaTheme.ink)
                Spacer()
                HStack(spacing: 3) {
                    Image(systemName: "flame.fill")
                    Text("\(day.streakDays)-day streak")
                }
                .font(.system(size: 11, weight: .heavy))
                .foregroundStyle(LoggaTheme.orange)
            }
            HStack {
                ForEach(0..<7, id: \.self) { index in
                    let logged = index < day.loggedThisWeek.count && day.loggedThisWeek[index]
                    VStack(spacing: 4) {
                        ZStack {
                            if logged {
                                Circle().fill(LoggaTheme.orangeSoft)
                                Image(systemName: "flame.fill")
                                    .font(.system(size: 13))
                                    .foregroundStyle(LoggaTheme.orange)
                            } else {
                                Circle()
                                    .strokeBorder(Color(hex: 0xD5DDD8),
                                                  style: StrokeStyle(lineWidth: 1.5, dash: [3, 3]))
                            }
                        }
                        .frame(width: 28, height: 28)
                        Text(labels[index])
                            .font(.system(size: 9, weight: .bold))
                            .foregroundStyle(LoggaTheme.muted)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(11)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
    }
}

#Preview(as: .systemLarge) {
    LoggaYourDayWidget()
} timeline: {
    LoggaEntry(date: .now, day: .placeholder)
}
