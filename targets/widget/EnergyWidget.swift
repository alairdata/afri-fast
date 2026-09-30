//  EnergyWidget.swift — widget extension target
//  Small widget: energy score gauge, burnout risk, fuel / water / protein bars.

import SwiftUI
import WidgetKit

struct LoggaEnergyWidget: Widget {
    let kind = "LoggaEnergyWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LoggaProvider()) { entry in
            EnergyWidgetView(entry: entry)
        }
        .configurationDisplayName("Energy score")
        .description("How well you're fuelled today, and your burnout risk.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

struct EnergyWidgetView: View {
    let entry: LoggaEntry

    var body: some View {
        let score = entry.day.energyScore(at: entry.date)

        VStack(alignment: .leading, spacing: 3) {
            HStack {
                Text("Energy today")
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: "bolt.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(LoggaTheme.amber)
            }

            ScoreGauge(value: score.value)
                .frame(maxWidth: .infinity)

            Text("Burnout risk: \(score.riskText)")
                .font(.system(size: 9, weight: .heavy))
                .foregroundStyle(LoggaTheme.amber)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(LoggaTheme.amber.opacity(0.18), in: Capsule())
                .frame(maxWidth: .infinity)

            VStack(spacing: 4) {
                FactorBar(label: "Fuel", amount: score.fuel, color: LoggaTheme.mint)
                FactorBar(label: "Water", amount: score.water, color: LoggaTheme.sky)
                FactorBar(label: "Protein", amount: score.protein, color: LoggaTheme.amber)
            }
            .padding(.top, 4)
        }
        .padding(13)
        .containerBackground(LoggaTheme.forest, for: .widget)
        .widgetURL(LoggaLink.energy)
    }
}

struct ScoreGauge: View {
    let value: Int

    var body: some View {
        ZStack(alignment: .bottom) {
            ZStack {
                Circle()
                    .trim(from: 0.5, to: 1)
                    .stroke(Color.white.opacity(0.14), style: StrokeStyle(lineWidth: 9, lineCap: .round))
                Circle()
                    .trim(from: 0.5, to: 0.5 + 0.5 * Double(value) / 100)
                    .stroke(LoggaTheme.amber, style: StrokeStyle(lineWidth: 9, lineCap: .round))
            }
            .frame(width: 96, height: 96)
            .frame(height: 54, alignment: .top)   // only the top half is drawn

            Text("\(value)")
                .font(.loggaNumber(30))
                .foregroundStyle(.white)
                .accessibilityLabel("Energy score \(value) out of 100")
        }
    }
}

struct FactorBar: View {
    let label: String
    let amount: Double
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(LoggaTheme.onForest)
                .frame(width: 38, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.white.opacity(0.14))
                    Capsule().fill(color)
                        .frame(width: max(5, geo.size.width * min(max(amount, 0), 1)))
                }
            }
            .frame(height: 5)
        }
    }
}

#Preview(as: .systemSmall) {
    LoggaEnergyWidget()
} timeline: {
    LoggaEntry(date: .now, day: .placeholder)
}
