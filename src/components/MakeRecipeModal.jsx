import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';

const MakeRecipeModal = ({ show, onClose, method }) => {
  const [ingredientInput, setIngredientInput] = useState('');

  if (!show) return null;

  const handleClose = () => {
    setIngredientInput('');
    onClose();
  };

  return (
    <View style={styles.weightPageOverlay}>
      <View style={styles.weightPage}>
        <View style={styles.weightPageHeader}>
          <TouchableOpacity style={styles.weightBackBtn} onPress={handleClose}>
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <Text style={styles.weightPageTitle}>
            {method === 'photo' ? '📸 Scan Ingredients' : '📝 List Ingredients'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.weightPageContent}>
          {/* Photo Method */}
          {method === 'photo' && (
            <View style={styles.logMealContent}>
              <View style={styles.cameraPlaceholder}>
                <Text style={styles.cameraIcon}>🍳</Text>
                <Text style={styles.cameraText}>Take a photo of your fridge, pantry, or ingredients</Text>
                <TouchableOpacity style={styles.cameraBtn}>
                  <Text style={styles.cameraBtnText}>Take Photo</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.generatedRecipes}>
                <Text style={styles.generatedRecipesTitle}>AI will suggest recipes based on what you have!</Text>
              </View>
            </View>
          )}

          {/* List Method */}
          {method === 'list' && (
            <View style={styles.logMealContent}>
              <View style={styles.mealInputContainer}>
                <Text style={styles.mealInputLabel}>What ingredients do you have?</Text>
                <TextInput
                  multiline
                  style={styles.mealTextarea}
                  placeholder="e.g., eggs, milk, bread, cheese, tomatoes..."
                  value={ingredientInput}
                  onChangeText={setIngredientInput}
                />
                <View style={styles.voiceInputRow}>
                  <TouchableOpacity style={styles.voiceMiniBtn}>
                    <Text style={styles.voiceMiniBtnText}>🎤 Say it</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.analyzeMealBtn}>
                  <Text style={styles.analyzeMealBtnText}>Generate Recipes</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.suggestedRecipes}>
                <Text style={styles.suggestedRecipesTitle}>Suggested Recipes</Text>
                <View style={styles.suggestedRecipesList}>
                  <View style={styles.suggestedRecipeItem}>
                    <Text style={styles.suggestedRecipeEmoji}>🍳</Text>
                    <View style={styles.suggestedRecipeInfo}>
                      <Text style={styles.suggestedRecipeName}>Classic French Omelette</Text>
                      <Text style={styles.suggestedRecipeMeta}>15 min • 320 cal</Text>
                    </View>
                  </View>
                  <View style={styles.suggestedRecipeItem}>
                    <Text style={styles.suggestedRecipeEmoji}>🥪</Text>
                    <View style={styles.suggestedRecipeInfo}>
                      <Text style={styles.suggestedRecipeName}>Grilled Cheese Sandwich</Text>
                      <Text style={styles.suggestedRecipeMeta}>10 min • 450 cal</Text>
                    </View>
                  </View>
                  <View style={styles.suggestedRecipeItem}>
                    <Text style={styles.suggestedRecipeEmoji}>🥗</Text>
                    <View style={styles.suggestedRecipeInfo}>
                      <Text style={styles.suggestedRecipeName}>Caprese Salad</Text>
                      <Text style={styles.suggestedRecipeMeta}>5 min • 280 cal</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          )}
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
  logMealContent: {
    padding: 20,
  },
  cameraPlaceholder: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  cameraIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  cameraText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  cameraBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    backgroundColor: '#059669',
    borderRadius: 12,
  },
  cameraBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mealInputContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  mealInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  mealTextarea: {
    width: '100%',
    minHeight: 120,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.15)',
    borderRadius: 14,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  voiceInputRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  voiceMiniBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderRadius: 8,
  },
  voiceMiniBtnText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  analyzeMealBtn: {
    padding: 16,
    backgroundColor: '#059669',
    borderRadius: 14,
    alignItems: 'center',
  },
  analyzeMealBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  generatedRecipes: {
    marginTop: 24,
    alignItems: 'center',
  },
  generatedRecipesTitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  suggestedRecipes: {
    marginTop: 24,
  },
  suggestedRecipesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  suggestedRecipesList: {
    flexDirection: 'column',
    gap: 10,
  },
  suggestedRecipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
    borderRadius: 12,
  },
  suggestedRecipeEmoji: {
    fontSize: 32,
  },
  suggestedRecipeInfo: {
    flexDirection: 'column',
    gap: 4,
  },
  suggestedRecipeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  suggestedRecipeMeta: {
    fontSize: 12,
    color: '#888',
  },
});

export default MakeRecipeModal;
