import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Image } from 'react-native';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';

const MakeRecipePage = ({ show, onClose }) => {
  const [makeRecipeMethod, setMakeRecipeMethod] = useState(null);
  const [showMakeRecipeModal, setShowMakeRecipeModal] = useState(false);

  if (!show) return null;

  const renderSection = (title, subtitle, items) => (
    <View style={styles.recipeSection}>
      <Text style={styles.recipeSectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.recipeSectionSubtitle}>{subtitle}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recipeCardsScroll}>
        {items.map((item, index) => (
          <View key={index} style={styles.recipeImageCard}>
            {item.image ? (
              <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={styles.recipeImageCardImg} resizeMode="cover" />
            ) : (
              <View style={[styles.recipeImageCardImg, styles.recipeImagePlaceholder]}>
                <Text style={styles.recipeImagePlaceholderText}>{item.name.charAt(0)}</Text>
              </View>
            )}
            {item.tag && (
              <View style={styles.recipeCardTag}>
                <Text style={styles.recipeCardTagText}>{item.tag}</Text>
              </View>
            )}
            <Text style={styles.recipeImageCardName}>{item.name}</Text>
            <View style={styles.recipeImageCardMeta}>
              <Text style={styles.recipeImageCardCal}>{item.cal}</Text>
              <Text style={styles.recipeImageCardTime}>{item.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.recipePageOverlay}>
      <View style={styles.recipePage}>
        {/* Header */}
        <View style={styles.recipePageHeader}>
          <TouchableOpacity style={styles.recipeBackBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <Text style={styles.recipePageTitle}>Make a Recipe</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.recipePageContent}>
          {/* Input Options */}
          <View style={styles.makeRecipeOptionsRow}>
            <TouchableOpacity style={styles.makeRecipeCard} onPress={() => { setMakeRecipeMethod('photo'); setShowMakeRecipeModal(true); }}>
              <View style={[styles.makeRecipeCardBg, { backgroundColor: '#ECFDF5' }]}>
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <Circle cx="12" cy="13" r="4" />
                </Svg>
              </View>
              <Text style={styles.makeRecipeCardTitle}>Take a{'\n'}Picture</Text>
              <Text style={styles.makeRecipeCardDesc}>Snap your fridge or pantry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.makeRecipeCard} onPress={() => { setMakeRecipeMethod('list'); setShowMakeRecipeModal(true); }}>
              <View style={[styles.makeRecipeCardBg, { backgroundColor: '#EFF6FF' }]}>
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </Svg>
              </View>
              <Text style={styles.makeRecipeCardTitle}>List{'\n'}Ingredients</Text>
              <Text style={styles.makeRecipeCardDesc}>Type or say what you have</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.recipeSearchBar}>
            <TextInput
              style={styles.recipeSearchInput}
              placeholder="Search recipes..."
              placeholderTextColor="#999"
            />
          </View>

          {renderSection('Fasting-Friendly', 'Perfect for breaking your fast', [
            { name: 'Pepper Soup (Light)', cal: '120 cal', time: '25 min', tag: 'Gentle', image: null },
            { name: 'Boiled Yam & Egg Sauce', cal: '350 cal', time: '20 min', tag: 'Protein-rich', image: null },
            { name: 'Oat & Banana Porridge', cal: '280 cal', time: '10 min', tag: 'Easy to digest', image: null },
            { name: 'Moi Moi', cal: '250 cal', time: '45 min', tag: 'High fiber', image: null },
          ])}

          {renderSection('Breakfast', 'Start your morning right', [
            { name: 'Akara & Pap', cal: '320 cal', time: '20 min', image: null },
            { name: 'Bread & Egg Stew', cal: '380 cal', time: '15 min', image: null },
            { name: 'Tom Brown Porridge', cal: '250 cal', time: '10 min', image: null },
            { name: 'Hausa Koko & Koose', cal: '290 cal', time: '25 min', image: null },
          ])}

          {renderSection('Lunch', 'Midday meals to keep you going', [
            { name: 'Jollof Rice & Chicken', cal: '520 cal', time: '45 min', image: null },
            { name: 'Eba & Egusi Soup', cal: '580 cal', time: '40 min', image: null },
            { name: 'Banku & Tilapia', cal: '450 cal', time: '35 min', image: null },
            { name: 'Waakye & Shito', cal: '490 cal', time: '50 min', image: null },
          ])}

          {renderSection('Dinner', 'Light and satisfying evening meals', [
            { name: 'Pepper Soup & Fish', cal: '280 cal', time: '30 min', image: null },
            { name: 'Beans & Plantain', cal: '420 cal', time: '35 min', image: null },
            { name: 'Light Okra Soup & Fufu', cal: '380 cal', time: '30 min', image: null },
            { name: 'Grilled Suya & Salad', cal: '310 cal', time: '20 min', image: null },
          ])}

          {renderSection('Snacks', 'Healthy bites between meals', [
            { name: 'Chin Chin (Baked)', cal: '150 cal', time: '30 min', image: null },
            { name: 'Roasted Plantain', cal: '180 cal', time: '15 min', image: null },
            { name: 'Groundnuts & Banana', cal: '200 cal', time: '2 min', image: null },
            { name: 'Puff Puff (Mini)', cal: '220 cal', time: '20 min', image: null },
          ])}

          {renderSection('Desserts', 'Sweet treats, African style', [
            { name: 'Coconut Candy', cal: '120 cal', time: '15 min', image: null },
            { name: 'Banana Fritters', cal: '180 cal', time: '10 min', image: null },
            { name: 'Kuli Kuli Bites', cal: '160 cal', time: '25 min', image: null },
            { name: 'Sweet Potato Pudding', cal: '200 cal', time: '35 min', image: null },
          ])}

          {renderSection('Drinks', 'Refreshing beverages', [
            { name: 'Zobo (Hibiscus)', cal: '60 cal', time: '30 min', image: null },
            { name: 'Sobolo', cal: '50 cal', time: '25 min', image: null },
            { name: 'Chapman', cal: '120 cal', time: '5 min', image: null },
            { name: 'Kunu Zaki', cal: '90 cal', time: '40 min', image: null },
          ])}

          {renderSection('Fasting Drinks', 'Zero calorie drinks for your fast', [
            { name: 'Black Coffee', cal: '2 cal', time: '3 min', tag: '0 sugar', image: null },
            { name: 'Green Tea', cal: '0 cal', time: '5 min', tag: 'Metabolism boost', image: null },
            { name: 'Lemon Water', cal: '5 cal', time: '2 min', tag: 'Detox', image: null },
            { name: 'Ginger & Lemon Tea', cal: '8 cal', time: '5 min', tag: 'Anti-inflammatory', image: null },
          ])}

          {renderSection('Quick & Easy', 'Ready in under 15 minutes', [
            { name: 'Indomie & Egg', cal: '450 cal', time: '8 min', image: null },
            { name: 'Fried Plantain & Eggs', cal: '380 cal', time: '10 min', image: null },
            { name: 'Bread & Beans', cal: '350 cal', time: '5 min', image: null },
            { name: 'Garri & Groundnut', cal: '300 cal', time: '3 min', image: null },
          ])}

          {renderSection('Low Fat', 'Light on fat, big on taste', [
            { name: 'Grilled Fish & Veggies', cal: '220 cal', time: '25 min', tag: '5g fat', image: null },
            { name: 'Boiled Yam & Garden Egg Stew', cal: '280 cal', time: '20 min', tag: '4g fat', image: null },
            { name: 'Steamed Moi Moi', cal: '200 cal', time: '45 min', tag: '3g fat', image: null },
            { name: 'Pepper Soup (No Oil)', cal: '150 cal', time: '30 min', tag: '2g fat', image: null },
          ])}

          {renderSection('Low Carb', 'Keep the carbs down', [
            { name: 'Suya & Cabbage Salad', cal: '280 cal', time: '15 min', tag: '8g carbs', image: null },
            { name: 'Egg & Spinach Stew', cal: '220 cal', time: '15 min', tag: '6g carbs', image: null },
            { name: 'Grilled Chicken & Avocado', cal: '320 cal', time: '20 min', tag: '5g carbs', image: null },
            { name: 'Fish & Okra Soup', cal: '180 cal', time: '25 min', tag: '10g carbs', image: null },
          ])}

          {renderSection('High Protein', 'Fuel your muscles', [
            { name: 'Suya Platter', cal: '350 cal', time: '20 min', tag: '40g protein', image: null },
            { name: 'Beans & Dodo', cal: '420 cal', time: '25 min', tag: '28g protein', image: null },
            { name: 'Grilled Tilapia & Yam', cal: '380 cal', time: '30 min', tag: '35g protein', image: null },
            { name: 'Egg & Corned Beef Sauce', cal: '340 cal', time: '15 min', tag: '30g protein', image: null },
          ])}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  recipePageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -120,
    backgroundColor: '#FAFAFA',
    zIndex: 9999,
    overflow: 'hidden',
  },
  recipePage: {
    flex: 1,
    flexDirection: 'column',
  },
  recipePageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    paddingTop: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  recipeBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 20,
    color: '#059669',
  },
  recipePageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  recipePageContent: {
    flex: 1,
    padding: 20,
  },
  makeRecipeOptionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  makeRecipeCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  makeRecipeCardBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  makeRecipeCardIcon: {
    fontSize: 28,
  },
  makeRecipeCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
    lineHeight: 22,
    marginBottom: 6,
  },
  makeRecipeCardDesc: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
  },
  recipeSearchBar: {
    marginBottom: 20,
  },
  recipeSearchInput: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 14,
    color: '#1F1F1F',
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.12)',
  },
  recipeCardsScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  recipeImageCard: {
    width: 170,
    marginRight: 12,
  },
  recipeImageCardImg: {
    width: 170,
    height: 130,
    borderRadius: 16,
    marginBottom: 10,
  },
  recipeImagePlaceholder: {
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeImagePlaceholderText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  recipeImageCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1F1F',
    lineHeight: 19,
    marginBottom: 4,
  },
  recipeImageCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipeImageCardCal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  recipeImageCardTime: {
    fontSize: 11,
    color: '#999',
  },
  recipeCardTag: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    borderRadius: 6,
    marginBottom: 8,
  },
  recipeCardTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  recipeSection: {
    marginBottom: 24,
  },
  recipeSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  recipeSectionSubtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: -8,
    marginBottom: 12,
  },
  quickIdeasList: {
    flexDirection: 'column',
    gap: 10,
  },
  quickIdeaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  quickIdeaEmoji: {
    fontSize: 28,
  },
  quickIdeaInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
  },
  quickIdeaName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  quickIdeaIngredients: {
    fontSize: 11,
    color: '#888',
  },
  quickIdeaBenefit: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
  },
  quickIdeaTime: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
  },
  tipsList: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 12,
  },
  tipIcon: {
    fontSize: 24,
  },
  tipText: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
    flex: 1,
  },
});

export default MakeRecipePage;
