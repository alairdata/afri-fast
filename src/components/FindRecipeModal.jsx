import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';

const FindRecipeModal = ({ show, onClose }) => {
  const [recipeSearchInput, setRecipeSearchInput] = useState('');

  if (!show) return null;

  const handleClose = () => {
    setRecipeSearchInput('');
    onClose();
  };

  return (
    <View style={styles.weightPageOverlay}>
      <View style={styles.weightPage}>
        <View style={styles.weightPageHeader}>
          <TouchableOpacity style={styles.weightBackBtn} onPress={handleClose}>
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <Text style={styles.weightPageTitle}>🔍 Find Recipe</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.weightPageContent}>
          <View style={styles.recipeSearchContainer}>
            <View style={styles.recipeSearchBar}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.recipeSearchInput}
                placeholder="Search recipes or say what you want..."
                value={recipeSearchInput}
                onChangeText={setRecipeSearchInput}
              />
              <TouchableOpacity style={styles.voiceSearchBtn}>
                <Text style={styles.voiceSearchBtnText}>🎤</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cuisineFiltersLarge}>
              <Text style={styles.cuisineFiltersTitle}>Filter by cuisine</Text>
              <View style={styles.cuisineFiltersGrid}>
                {[
                  { name: 'Italian', emoji: '🇮🇹' },
                  { name: 'Mexican', emoji: '🇲🇽' },
                  { name: 'Japanese', emoji: '🇯🇵' },
                  { name: 'Indian', emoji: '🇮🇳' },
                  { name: 'Chinese', emoji: '🇨🇳' },
                  { name: 'Thai', emoji: '🇹🇭' },
                  { name: 'Mediterranean', emoji: '🫒' },
                  { name: 'American', emoji: '🇺🇸' },
                ].map((cuisine) => (
                  <TouchableOpacity key={cuisine.name} style={styles.cuisineGridItem}>
                    <Text style={styles.cuisineGridEmoji}>{cuisine.emoji}</Text>
                    <Text style={styles.cuisineGridName}>{cuisine.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.popularRecipes}>
              <Text style={styles.popularRecipesTitle}>Popular Recipes</Text>
              <View style={styles.popularRecipesList}>
                {[
                  { name: 'Spaghetti Carbonara', emoji: '🍝', time: '25 min', calories: 580 },
                  { name: 'Chicken Tikka Masala', emoji: '🍛', time: '40 min', calories: 490 },
                  { name: 'Sushi Rolls', emoji: '🍣', time: '45 min', calories: 320 },
                  { name: 'Tacos al Pastor', emoji: '🌮', time: '30 min', calories: 420 },
                ].map((recipe, index) => (
                  <View key={index} style={styles.popularRecipeItem}>
                    <Text style={styles.popularRecipeEmoji}>{recipe.emoji}</Text>
                    <View style={styles.popularRecipeInfo}>
                      <Text style={styles.popularRecipeName}>{recipe.name}</Text>
                      <Text style={styles.popularRecipeMeta}>⏱️ {recipe.time} • 🔥 {recipe.calories} cal</Text>
                    </View>
                    <TouchableOpacity style={styles.popularRecipeBtn}>
                      <Text style={styles.popularRecipeBtnText}>View</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  weightPageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F8FAFC',
    zIndex: 1100,
  },
  weightPage: {
    width: '100%',
    flex: 1,
    flexDirection: 'column',
  },
  weightPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  weightBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: '#059669',
  },
  weightPageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  weightPageContent: {
    flex: 1,
    padding: 20,
  },
  recipeSearchContainer: {
    padding: 20,
  },
  recipeSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.15)',
    marginBottom: 20,
  },
  searchIcon: {
    fontSize: 18,
  },
  recipeSearchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  voiceSearchBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceSearchBtnText: {
    fontSize: 16,
  },
  cuisineFiltersLarge: {
    marginBottom: 24,
  },
  cuisineFiltersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  cuisineFiltersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cuisineGridItem: {
    width: '22%',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    borderRadius: 12,
  },
  cuisineGridEmoji: {
    fontSize: 24,
  },
  cuisineGridName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#444',
  },
  popularRecipes: {
    marginTop: 24,
  },
  popularRecipesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  popularRecipesList: {
    flexDirection: 'column',
    gap: 10,
  },
  popularRecipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  popularRecipeEmoji: {
    fontSize: 36,
  },
  popularRecipeInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  popularRecipeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  popularRecipeMeta: {
    fontSize: 11,
    color: '#888',
  },
  popularRecipeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#059669',
    borderRadius: 8,
  },
  popularRecipeBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default FindRecipeModal;
