// Single source of truth for check-in chip icons and section colors.
// Used by CheckInPage (chips) and LogMealModal (check-in widget).

export const CHECKIN_ICON_SECTIONS = {
  emotionalMoods: {
    color: '#F59E0B', bg: '#FFFBEB',
    icons: {
      'Calm':        'leaf-outline',
      'Anxious':     'alert-circle-outline',
      'Happy':       'sunny-outline',
      'Irritable':   'flame-outline',
      'Sad':         'rainy-outline',
      'Tired':       'moon-outline',
      'Overwhelmed': 'thunderstorm-outline',
      'Energized':   'flash-outline',
      'Stressed':    'pulse-outline',
      'Content':     'heart-outline',
      'Hopeful':     'star-outline',
      'Lonely':      'person-outline',
      'Proud':       'ribbon-outline',
      'Frustrated':  'close-circle-outline',
      'Indifferent': 'remove-circle-outline',
      'Distracted':  'shuffle-outline',
    },
  },
  satietyMoods: {
    color: '#22C55E', bg: '#F0FDF4',
    icons: {
      'Full':          'restaurant-outline',
      'Guilty':        'alert-circle-outline',
      'Uncomfortable': 'bandage-outline',
      'Bad':           'thumbs-down-outline',
      'Really good':   'thumbs-up-outline',
      'Energized':     'flash-outline',
      'Refreshed':     'water-outline',
      'Motivated':     'trending-up-outline',
      'Numb':          'remove-circle-outline',
      'Restless':      'walk-outline',
    },
  },
  fastingSymptoms: {
    color: '#9333EA', bg: '#FAF5FF',
    icons: {
      'Headache':        'medical-outline',
      'Dizziness':       'sync-outline',
      'Nausea':          'warning-outline',
      'Fatigue':         'battery-dead-outline',
      'Muscle weakness': 'body-outline',
      'Feeling cold':    'snow-outline',
      'Dry mouth':       'water-outline',
      'Brain fog':       'cloud-outline',
      'Slow thinking':   'hourglass-outline',
      'Irritability':    'flame-outline',
      'Mood swings':     'swap-horizontal-outline',
      'Anxiety':         'alert-circle-outline',
      'Mental clarity':  'bulb-outline',
      'Feeling light':   'leaf-outline',
      'Improved focus':  'eye-outline',
      'Sense of control':'checkmark-circle-outline',
    },
  },
  currentLocation: {
    color: '#3B82F6', bg: '#EFF6FF', single: true,
    icons: {
      'Home':           'home-outline',
      'Work/school':    'briefcase-outline',
      'Commuting':      'car-outline',
      'Outdoors':       'leaf-outline',
      'Social setting': 'people-outline',
      'Other':          'grid-outline',
    },
  },
  currentCompany: {
    color: '#F97316', bg: '#FFF7ED', single: true,
    icons: {
      'Alone':               'person-outline',
      'With family':         'people-outline',
      'With friends':        'heart-outline',
      'In a public setting': 'business-outline',
      'At work/class':       'school-outline',
    },
  },
  typicalDay: {
    color: '#EF4444', bg: '#FFF1F2', single: true,
    icons: {
      'Yes, fairly normal':      'checkmark-circle-outline',
      'Busier than usual':       'flame-outline',
      'More relaxed than usual': 'leaf-outline',
      'Unusual/disrupted day':   'shuffle-outline',
    },
  },
};

// Flatten a check-in data object into [{ value, icon, color, bg }] across all sections
export function collectCheckInIcons(data) {
  if (!data) return [];
  const items = [];
  Object.entries(CHECKIN_ICON_SECTIONS).forEach(([key, sec]) => {
    const val = data[key];
    const values = sec.single ? (val ? [val] : []) : (val || []);
    values.forEach(v => items.push({
      value: v,
      icon: sec.icons[v] || 'ellipse-outline',
      color: sec.color,
      bg: sec.bg,
    }));
  });
  return items;
}
