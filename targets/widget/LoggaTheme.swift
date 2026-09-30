//  LoggaTheme.swift — widget extension target

import SwiftUI

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: opacity)
    }
}

enum LoggaTheme {
    static let green      = Color(hex: 0x059669)
    static let greenSoft  = Color(hex: 0xE3F5EE)
    static let forest     = Color(hex: 0x1F4D3A)
    static let orange     = Color(hex: 0xE4572E)
    static let orangeSoft = Color(hex: 0xFDEBE5)
    static let amber      = Color(hex: 0xF2A541)
    static let cream      = Color(hex: 0xFAF4E8)
    static let ink        = Color(hex: 0x15241C)
    static let muted      = Color(hex: 0x5F6B64)
    static let water      = Color(hex: 0x3B82C4)
    static let waterSoft  = Color(hex: 0xEEF5FB)
    static let waterInk   = Color(hex: 0x2C5E86)
    static let mint       = Color(hex: 0x6EE7B7)
    static let sky        = Color(hex: 0x8EC5F0)
    static let onForest   = Color(hex: 0xCFE3D8)
}

extension Font {
    /// Chunky display numbers. Swap for your bundled brand font if you add one.
    static func loggaNumber(_ size: CGFloat) -> Font {
        .system(size: size, weight: .heavy, design: .rounded)
    }
}

// MARK: - Shared pieces

struct LoggaRing: View {
    var progress: Double
    var lineWidth: CGFloat
    var color: Color
    var track: Color

    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

struct StreakPill: View {
    var days: Int
    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "flame.fill")
            Text("\(days)-day streak")
        }
        .font(.system(size: 11, weight: .heavy))
        .foregroundStyle(LoggaTheme.orange)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(LoggaTheme.orangeSoft, in: Capsule())
    }
}

struct LogMealButton: View {
    var height: CGFloat = 32
    var body: some View {
        Link(destination: LoggaLink.logMeal) {
            HStack(spacing: 5) {
                Image(systemName: "plus")
                Text("Log meal")
            }
            .font(.system(size: 13, weight: .heavy))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(LoggaTheme.green, in: Capsule())
        }
    }
}
