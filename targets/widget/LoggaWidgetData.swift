//  LoggaWidgetData.swift
//  Shared between the Logga app target AND the widget extension target.
//  The app writes today's numbers here; the widgets read them.

import Foundation

// MARK: - App Group

enum LoggaStore {
    /// The App Group shared by the Logga app and this widget extension (set in app.json and
    /// targets/widget/expo-target.config.js -- keep all three identical).
    static let appGroupID = "group.com.logga.app"

    private static let storageKey = "logga.widget.day.v1"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroupID) ?? .standard
    }

    /// Loads the saved day. If the saved day is from an earlier date,
    /// the daily counters are reset (goals and streak are kept).
    static func load(now: Date = .now) -> LoggaDay {
        // The app (React Native) stores the snapshot as a JSON *string*; older/native writers may
        // have stored raw Data. Accept both.
        let raw: Data? = defaults.string(forKey: storageKey)?.data(using: .utf8) ?? defaults.data(forKey: storageKey)
        guard
            let data = raw,
            let saved = try? JSONDecoder().decode(LoggaDay.self, from: data)
        else {
            return .empty(on: now)
        }
        if Calendar.current.isDate(saved.date, inSameDayAs: now) {
            return saved
        }
        return saved.resetForNewDay(now)
    }

    static func save(_ day: LoggaDay) {
        // Stored as a JSON string so the app's ExtensionStorage.get() can read it back.
        guard let data = try? JSONEncoder().encode(day), let json = String(data: data, encoding: .utf8) else { return }
        defaults.set(json, forKey: storageKey)
    }
}

// MARK: - Model

struct LoggaDay: Codable, Equatable {
    var date: Date
    var caloriesEaten: Int
    var calorieGoal: Int
    var waterGlasses: Int
    var waterGoal: Int
    var proteinGrams: Int
    var proteinGoal: Int
    var streakDays: Int
    /// Seven values, Monday → Sunday. `true` = the user logged food that day.
    var loggedThisWeek: [Bool]
    /// The app's real burnout likelihood (0-100, higher = worse) and its plain label
    /// ("Low", "Moderate", "High", "Critical"). Optional: until the app has calculated it, the
    /// widget falls back to a simple time-of-day estimate.
    var burnoutScore: Int? = nil
    var burnoutLabel: String? = nil
    /// Which account this snapshot belongs to (the app writes it; widget taps keep it when they re-save).
    var userId: String? = nil

    init(date: Date, caloriesEaten: Int, calorieGoal: Int, waterGlasses: Int, waterGoal: Int,
         proteinGrams: Int, proteinGoal: Int, streakDays: Int, loggedThisWeek: [Bool],
         burnoutScore: Int? = nil, burnoutLabel: String? = nil, userId: String? = nil) {
        self.date = date
        self.caloriesEaten = caloriesEaten
        self.calorieGoal = calorieGoal
        self.waterGlasses = waterGlasses
        self.waterGoal = waterGoal
        self.proteinGrams = proteinGrams
        self.proteinGoal = proteinGoal
        self.streakDays = streakDays
        self.loggedThisWeek = loggedThisWeek
        self.burnoutScore = burnoutScore
        self.burnoutLabel = burnoutLabel
        self.userId = userId
    }

    /// Tolerant decoding: one missing or malformed field no longer throws the whole day away (which
    /// made every widget fall back to an empty day: 0 streak, 0 water, no burnout score).
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func int(_ key: CodingKeys, _ fallback: Int) -> Int { (try? c.decodeIfPresent(Int.self, forKey: key)) ?? fallback }
        date = (try? c.decodeIfPresent(Date.self, forKey: .date)) ?? Date()
        caloriesEaten = int(.caloriesEaten, 0)
        calorieGoal = int(.calorieGoal, 1520)
        waterGlasses = int(.waterGlasses, 0)
        waterGoal = int(.waterGoal, 8)
        proteinGrams = int(.proteinGrams, 0)
        proteinGoal = int(.proteinGoal, 90)
        streakDays = int(.streakDays, 0)
        let week = (try? c.decodeIfPresent([Bool].self, forKey: .loggedThisWeek)) ?? nil
        loggedThisWeek = (week?.count == 7) ? (week ?? []) : Array(repeating: false, count: 7)
        burnoutScore = (try? c.decodeIfPresent(Int.self, forKey: .burnoutScore)) ?? nil
        burnoutLabel = (try? c.decodeIfPresent(String.self, forKey: .burnoutLabel)) ?? nil
        userId = (try? c.decodeIfPresent(String.self, forKey: .userId)) ?? nil
    }

    var caloriesLeft: Int { max(calorieGoal - caloriesEaten, 0) }

    var calorieProgress: Double {
        guard calorieGoal > 0 else { return 0 }
        return min(Double(caloriesEaten) / Double(calorieGoal), 1)
    }

    static func empty(on date: Date) -> LoggaDay {
        LoggaDay(date: date, caloriesEaten: 0, calorieGoal: 1520,
                 waterGlasses: 0, waterGoal: 8, proteinGrams: 0, proteinGoal: 90,
                 streakDays: 0, loggedThisWeek: Array(repeating: false, count: 7))
    }

    func resetForNewDay(_ now: Date) -> LoggaDay {
        var copy = self
        copy.date = now
        copy.caloriesEaten = 0
        copy.waterGlasses = 0
        copy.proteinGrams = 0
        // Starting a new week on Monday clears the week row.
        if Calendar.current.component(.weekday, from: now) == 2,
           !Calendar.current.isDate(date, equalTo: now, toGranularity: .weekOfYear) {
            copy.loggedThisWeek = Array(repeating: false, count: 7)
        }
        return copy
    }

    /// Sample data used for widget previews and the widget gallery.
    static let placeholder = LoggaDay(
        date: .now, caloriesEaten: 520, calorieGoal: 1520,
        waterGlasses: 5, waterGoal: 8, proteinGrams: 58, proteinGoal: 90,
        streakDays: 6, loggedThisWeek: [true, true, true, true, true, true, false]
    )
}

// MARK: - Energy score

/// A simple daily wellbeing heuristic (not medical advice):
/// how well the user is keeping up with food, water and protein
/// compared with where they "should" be by this time of day.
struct EnergyScore {
    let value: Int          // 0–100
    let fuel: Double        // 0–1
    let water: Double       // 0–1
    let protein: Double     // 0–1
    var label: String? = nil   // the app's own burnout label, when it has one

    enum Risk: String { case low = "Low", medium = "Medium", high = "High" }

    var riskText: String { label ?? risk.rawValue }

    var risk: Risk {
        switch value {
        case 70...: return .low
        case 45..<70: return .medium
        default: return .high
        }
    }
}

extension LoggaDay {
    func energyScore(at now: Date = .now) -> EnergyScore {
        // Share of the waking day that has passed (7am → 9pm), never below 15%.
        let cal = Calendar.current
        let hour = Double(cal.component(.hour, from: now)) + Double(cal.component(.minute, from: now)) / 60
        let dayFraction = min(max((hour - 7) / 14, 0.15), 1)

        func onTrack(_ value: Int, _ goal: Int) -> Double {
            guard goal > 0 else { return 0 }
            let ratio = Double(value) / (Double(goal) * dayFraction)
            // Going well over target is penalised too.
            return ratio <= 1 ? ratio : max(0, 1 - (ratio - 1))
        }

        let fuel = onTrack(caloriesEaten, calorieGoal)
        // Paced values feed the score; the bars show true progress toward the goal so they move with
        // every glass / gram (the paced values pinned at full early in the day).
        let waterPace = min(Double(waterGlasses) / (Double(max(waterGoal, 1)) * dayFraction), 1)
        let proteinPace = min(Double(proteinGrams) / (Double(max(proteinGoal, 1)) * dayFraction), 1)
        let water = min(Double(waterGlasses) / Double(max(waterGoal, 1)), 1)
        let protein = min(Double(proteinGrams) / Double(max(proteinGoal, 1)), 1)
        let score = Int((0.4 * fuel + 0.3 * waterPace + 0.3 * proteinPace) * 100)

        // When the app has calculated the real burnout number, use it (energy = 100 - burnout) so the
        // widget and the Insights tab always agree. The bars still show today's progress.
        if let burnout = burnoutScore {
            return EnergyScore(value: min(max(100 - burnout, 0), 100), fuel: min(fuel, 1), water: water, protein: protein, label: burnoutLabel)
        }
        return EnergyScore(value: min(max(score, 0), 100), fuel: fuel, water: water, protein: protein)
    }
}

// MARK: - Deep links

enum LoggaLink {
    static let logMeal = URL(string: "logga://log-meal")!
    static let water   = URL(string: "logga://water")!
    static let energy  = URL(string: "logga://energy")!
    static let today   = URL(string: "logga://today")!
}
