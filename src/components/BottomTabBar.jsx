import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

const ALL_TABS = [
  { id: 'today', label: 'Today', icon: 'home-outline', iconActive: 'home' },
  { id: 'meals', label: 'Meals', icon: 'restaurant-outline', iconActive: 'restaurant' },
  { id: 'progress', label: 'Progress', icon: 'bar-chart-outline', iconActive: 'bar-chart' },
  { id: 'whispers', label: 'Whispers', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
];

const BottomTabBar = ({ activeTab, onTabChange, whispersUnlocked = false }) => {
  const tabs = ALL_TABS.filter(t => t.id !== 'whispers' || whispersUnlocked);

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => onTabChange(tab.id)}
          >
            <Ionicons
              name={isActive ? tab.iconActive : tab.icon}
              size={22}
              color={isActive ? '#059669' : '#9CA3AF'}
            />
            <Text style={isActive ? styles.tabLabel : styles.tabLabelInactive}>{tab.label}</Text>
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
    paddingBottom: 24,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    zIndex: 20,
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
    color: '#059669',
  },
  tabLabelInactive: {
    fontSize: 10,
    fontWeight: '500',
    color: '#9CA3AF',
  },
});

export default BottomTabBar;
