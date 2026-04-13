import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Vibration } from 'react-native';
import { useTheme } from '../lib/theme';

const ALL_TABS = [
  { id: 'today', label: 'Today', icon: 'home-outline', iconActive: 'home' },
  { id: 'meals', label: 'Meals', icon: 'restaurant-outline', iconActive: 'restaurant' },
  { id: 'progress', label: 'Progress', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  { id: 'whispers', label: 'Whispers', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
];

const BottomTabBar = ({ activeTab, onTabChange, whispersUnlocked = false }) => {
  const { colors } = useTheme();
  const tabs = ALL_TABS.filter(t => t.id !== 'whispers' || whispersUnlocked);

  return (
    <View style={[styles.tabBar, { backgroundColor: colors.tabBar }]}>
      <View style={[styles.separator, { backgroundColor: colors.tabBarBorder }]} />
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => {
              if (Platform.OS === 'web') {
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(6);
              } else {
                Vibration.vibrate(10);
              }
              onTabChange(tab.id);
            }}
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={isActive ? tab.iconActive : tab.icon}
              size={22}
              color={isActive ? colors.accent : colors.textMuted}
            />
            <Text style={[isActive ? styles.tabLabel : styles.tabLabelInactive, { color: isActive ? colors.accent : colors.textMuted }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 8,
    zIndex: 20,
    overflow: 'hidden',
  },
  separator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  tab: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  tabLabelInactive: {
    fontSize: 10,
    fontWeight: '500',
  },
});

export default BottomTabBar;
