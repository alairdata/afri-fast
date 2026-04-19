import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Image, Modal, SafeAreaView, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { AFRICAN_RECIPES, RECIPE_CATEGORIES } from '../lib/africanRecipes';

// ── Ingredient amount scaler ─────────────────────────────────────────────────

const SKIP_WORDS = ['to taste', 'a pinch', 'plenty', 'as needed', 'optional'];

const toNiceFraction = (n) => {
  if (n === 0) return '0';
  const whole = Math.floor(n);
  const frac = n - whole;
  const fracs = { 0.25: '¼', 0.5: '½', 0.75: '¾', 0.33: '⅓', 0.67: '⅔' };
  const key = Object.keys(fracs).find(k => Math.abs(frac - parseFloat(k)) < 0.05);
  const fracStr = key ? fracs[key] : (frac > 0.05 ? `${Math.round(frac * 4)}/4` : '');
  if (whole === 0) return fracStr || String(Math.round(n * 10) / 10);
  return fracStr ? `${whole}${fracStr}` : String(Math.round(n * 10) / 10);
};

const scaleAmount = (amount, scale) => {
  if (!amount || scale === 1) return amount;
  const lower = amount.toLowerCase();
  if (SKIP_WORDS.some(w => lower.startsWith(w))) return amount;

  // Strip leading ~ prefix (e.g. "~50 cubes"), scale, then restore
  const approx = amount.startsWith('~');
  const str = approx ? amount.slice(1) : amount;
  const prefix = approx ? '~' : '';

  // Range: "5-7 leaves" → scale both numbers
  const rangeMatch = str.match(/^(\d+)-(\d+)(.*)$/);
  if (rangeMatch) {
    const lo = toNiceFraction(parseFloat(rangeMatch[1]) * scale);
    const hi = toNiceFraction(parseFloat(rangeMatch[2]) * scale);
    return `${prefix}${lo}-${hi}${rangeMatch[3]}`;
  }

  // Fraction: "1/4 bulb" → parse and scale
  const fracMatch = str.match(/^(\d+)\/(\d+)(.*)$/);
  if (fracMatch) {
    const val = (parseInt(fracMatch[1]) / parseInt(fracMatch[2])) * scale;
    return `${prefix}${toNiceFraction(val)}${fracMatch[3]}`;
  }

  // Integer or decimal: "2 tbsp", "1.5 cups"
  const numMatch = str.match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]) * scale;
    return `${prefix}${toNiceFraction(val)}${numMatch[2]}`;
  }

  return amount;
};

// ── Recipe Detail Popup ──────────────────────────────────────────────────────

const RecipeDetailModal = ({ recipe, visible, onClose, onLogMeal, userCountry }) => {
  const [servings, setServings] = useState(1);

  // Reset servings when recipe changes
  React.useEffect(() => { setServings(1); }, [recipe?.id]);

  if (!recipe) return null;

  const scale = servings;
  const scaled = (val) => Math.round(val * scale);
  const displayName = getLocalName(recipe, userCountry);
  const isLocalised = displayName !== recipe.name;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={detail.container}>
        {/* Header */}
        <View style={detail.header}>
          <TouchableOpacity style={detail.closeBtn} onPress={onClose}>
            <Text style={detail.closeX}>✕</Text>
          </TouchableOpacity>
          {onLogMeal && (
            <TouchableOpacity style={detail.logBtn} onPress={() => { onLogMeal({ ...recipe, calories: scaled(recipe.calories), protein: scaled(recipe.protein), carbs: scaled(recipe.carbs), fats: scaled(recipe.fats), servings }); onClose(); }}>
              <Text style={detail.logBtnText}>Log Meal</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={detail.scroll} showsVerticalScrollIndicator={false}>
          {/* Image */}
          {recipe.imageUrl ? (
            <Image source={{ uri: recipe.imageUrl }} style={detail.heroImage} resizeMode="cover" />
          ) : (
            <View style={[detail.heroImage, detail.heroPlaceholder]}>
              <Text style={detail.heroEmoji}>🍽️</Text>
            </View>
          )}

          <View style={detail.body}>
            {/* Category label */}
            <Text style={detail.categoryLabel}>{recipe.category.toUpperCase()}</Text>

            {/* Title + description */}
            <Text style={detail.title}>{displayName}</Text>
            <Text style={detail.description}>{recipe.description}</Text>

            {/* Serving adjuster */}
            <View style={detail.servingRow}>
              <Text style={detail.servingLabel}>Servings</Text>
              <View style={detail.servingControls}>
                <TouchableOpacity
                  style={[detail.servingBtn, servings <= 0.5 && { opacity: 0.3 }]}
                  onPress={() => setServings(s => Math.max(0.5, parseFloat((s - 0.5).toFixed(1))))}
                  disabled={servings <= 0.5}
                >
                  <Text style={detail.servingBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={detail.servingCount}>{servings}</Text>
                <TouchableOpacity
                  style={detail.servingBtn}
                  onPress={() => setServings(s => parseFloat((s + 0.5).toFixed(1)))}
                >
                  <Text style={detail.servingBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={detail.servingYield}>{scaleAmount(recipe.yield, scale)}</Text>
            </View>

            {/* Nutrition row */}
            <View style={detail.nutritionRow}>
              {[
                { val: scaled(recipe.calories), unit: 'kcal' },
                { val: `${scaled(recipe.protein)}g`, unit: 'protein' },
                { val: `${scaled(recipe.carbs)}g`, unit: 'carbs' },
                { val: `${scaled(recipe.fats)}g`, unit: 'fats' },
              ].map((n, i) => (
                <View key={i} style={detail.nutritionBox}>
                  <Text style={detail.nutritionVal}>{n.val}</Text>
                  <Text style={detail.nutritionUnit}>{n.unit}</Text>
                </View>
              ))}
            </View>

            {/* Time chips */}
            <View style={detail.chipsRow}>
              {recipe.prepTime ? (
                <View style={detail.chip}>
                  <Text style={detail.chipIcon}>⏱</Text>
                  <Text style={detail.chipText}>{recipe.prepTime} prep</Text>
                </View>
              ) : null}
              {recipe.cookTime ? (
                <View style={[detail.chip, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                  <Text style={detail.chipIcon}>🔥</Text>
                  <Text style={[detail.chipText, { color: '#EF4444' }]}>{recipe.cookTime} cook</Text>
                </View>
              ) : null}
            </View>

            {/* Also known as — other countries' names */}
            {Object.keys(recipe.localNames || {}).length > 0 && (
              <View style={detail.localNamesRow}>
                <Text style={detail.localNamesLabel}>Also known as: </Text>
                <Text style={detail.localNamesText}>
                  {[...new Set(Object.values(recipe.localNames))].filter(n => n !== displayName).join(' · ')}
                </Text>
              </View>
            )}

            {/* Ingredients */}
            {recipe.ingredients?.length > 0 && (
              <View style={detail.section}>
                <Text style={detail.sectionTitle}>Ingredients</Text>
                <View style={detail.ingredientsGrid}>
                  {recipe.ingredients.map((ing, i) => (
                    <View key={i} style={detail.ingredientRow}>
                      <View style={detail.ingredientDot} />
                      <Text style={detail.ingredientName}>{ing.name}</Text>
                      <Text style={detail.ingredientAmount}>{scaleAmount(ing.amount, scale)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Instructions */}
            {recipe.instructions?.length > 0 && (
              <View style={detail.section}>
                <Text style={detail.sectionTitle}>Instructions</Text>
                {recipe.instructions.map((step, i) => (
                  <View key={i} style={detail.stepRow}>
                    <View style={detail.stepNum}>
                      <Text style={detail.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={detail.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Countries */}
            {recipe.countries?.length > 0 && (
              <Text style={detail.countries}>🌍 {recipe.countries.join(' · ')}</Text>
            )}

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ── Make Recipe Page ─────────────────────────────────────────────────────────

const CATEGORY_META = {
  'Fasting-Friendly': { emoji: '⚡', subtitle: 'Perfect for breaking your fast' },
  'Breakfast': { emoji: '🌅', subtitle: 'Start your morning right' },
  'Lunch': { emoji: '☀️', subtitle: 'Midday meals to keep you going' },
  'Dinner': { emoji: '🌙', subtitle: 'Light and satisfying evening meals' },
  'Snacks': { emoji: '🤏', subtitle: 'Healthy bites between meals' },
  'Desserts': { emoji: '🍬', subtitle: 'Sweet treats, African style' },
  'Drinks': { emoji: '🥤', subtitle: 'Refreshing beverages' },
  'Fasting Drinks': { emoji: '💧', subtitle: 'Zero-calorie drinks for your fast' },
  'Quick & Easy': { emoji: '⚡', subtitle: 'Ready in under 15 minutes' },
  'Low Fat': { emoji: '🥗', subtitle: 'Light on fat, big on taste' },
  'Low Carb': { emoji: '💪', subtitle: 'Keep the carbs down' },
  'High Protein': { emoji: '🏋️', subtitle: 'Fuel your muscles' },
};

const getLocalName = (recipe, userCountry) =>
  (userCountry && recipe.localNames?.[userCountry]) || recipe.name;

const MakeRecipePage = ({ show, onClose, onLogMeal, userCountry }) => {
  const [makeRecipeMethod, setMakeRecipeMethod] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return AFRICAN_RECIPES.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.localNames?.some(n => n.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const openRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setDetailVisible(true);
  };

  const renderRecipeCard = (recipe) => {
    const displayName = getLocalName(recipe, userCountry);
    const isLocalised = displayName !== recipe.name;
    return (
      <TouchableOpacity key={recipe.id} style={styles.recipeCard} onPress={() => openRecipe(recipe)}>
        {recipe.imageUrl ? (
          <Image source={{ uri: recipe.imageUrl }} style={styles.recipeCardImg} resizeMode="cover" />
        ) : (
          <View style={styles.recipeCardImg}>
            <Text style={styles.recipeCardEmoji}>🍽️</Text>
          </View>
        )}
        {recipe.fastingFriendly && (
          <View style={styles.recipeCardTag}>
            <Text style={styles.recipeCardTagText}>Fasting ✓</Text>
          </View>
        )}
        <Text style={styles.recipeCardName} numberOfLines={2}>{displayName}</Text>
        <View style={styles.recipeCardMeta}>
          <Text style={styles.recipeCardCal}>{recipe.calories} cal</Text>
          {(recipe.prepTime || recipe.cookTime) ? (
            <Text style={styles.recipeCardTime}>
              {(() => {
                const toMins = t => {
                  if (!t) return 0;
                  const n = parseInt(t);
                  return isNaN(n) ? 0 : /hr/i.test(t) ? n * 60 : n;
                };
                const total = toMins(recipe.prepTime) + toMins(recipe.cookTime);
                return total >= 60 ? `${Math.floor(total / 60)}h ${total % 60 > 0 ? `${total % 60}m` : ''}`.trim() : `${total} mins`;
              })()}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  if (!show) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Make a Recipe</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Action cards */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionCard} onPress={() => setMakeRecipeMethod('photo')}>
              <View style={[styles.actionIconBg, { backgroundColor: '#ECFDF5' }]}>
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <Circle cx="12" cy="13" r="4" />
                </Svg>
              </View>
              <Text style={styles.actionTitle}>Take a{'\n'}Picture</Text>
              <Text style={styles.actionDesc}>Snap your fridge or pantry</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => setMakeRecipeMethod('list')}>
              <View style={[styles.actionIconBg, { backgroundColor: '#EFF6FF' }]}>
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </Svg>
              </View>
              <Text style={styles.actionTitle}>List{'\n'}Ingredients</Text>
              <Text style={styles.actionDesc}>Type or say what you have</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#999" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#ccc" />
              </TouchableOpacity>
            )}
          </View>

          {/* Search results */}
          {searchQuery.trim().length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {searchResults.length > 0 ? `${searchResults.length} results` : 'No results found'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll}>
                {searchResults.map(renderRecipeCard)}
              </ScrollView>
            </View>
          ) : (
            <>
              {RECIPE_CATEGORIES.map(cat => {
                const recipes = AFRICAN_RECIPES.filter(r => r.category === cat);
                if (recipes.length === 0) return null;
                const meta = CATEGORY_META[cat] || {};
                return (
                  <View key={cat} style={styles.section}>
                    <Text style={styles.sectionTitle}>{meta.emoji} {cat}</Text>
                    {meta.subtitle && <Text style={styles.sectionSubtitle}>{meta.subtitle}</Text>}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll}>
                      {recipes.map(renderRecipeCard)}
                    </ScrollView>
                  </View>
                );
              })}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onLogMeal={onLogMeal}
        userCountry={userCountry}
      />
    </View>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#FAFAFA',
    zIndex: 9999,
  },
  page: { flex: 1, flexDirection: 'column' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, paddingTop: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(5,150,105,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  pageTitle: { fontSize: 18, fontWeight: '600', color: '#1F1F1F' },
  content: { flex: 1, paddingHorizontal: 20 },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20 },
  actionCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  actionIconBg: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  actionTitle: { fontSize: 18, fontWeight: '700', color: '#1F1F1F', lineHeight: 22, marginBottom: 6 },
  actionDesc: { fontSize: 12, color: '#888', lineHeight: 16 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: 'rgba(5,150,105,0.12)',
    marginBottom: 20,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1F1F1F' },

  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F1F1F', marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: '#888', marginBottom: 12 },
  cardScroll: { marginHorizontal: -20, paddingHorizontal: 20, marginTop: 8 },

  recipeCard: { width: 160, marginRight: 12 },
  recipeCardImg: {
    width: 160, height: 120, borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, overflow: 'hidden',
  },
  recipeCardEmoji: { fontSize: 36 },
  recipeCardTag: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(5,150,105,0.85)',
    paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6,
  },
  recipeCardTagText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  recipeCardName: { fontSize: 13, fontWeight: '700', color: '#1F1F1F', lineHeight: 18, marginBottom: 4 },
  recipeCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recipeCardCal: { fontSize: 12, fontWeight: '600', color: '#059669' },
  recipeCardTime: { fontSize: 11, color: '#999' },
  recipeCardAltName: { fontSize: 11, color: '#999', fontStyle: 'italic', marginTop: -2, marginBottom: 2 },
});

const detail = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  closeX: { fontSize: 16, color: '#666', fontWeight: '600' },
  logBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
  },
  logBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scroll: { flex: 1 },

  heroImage: { width: '100%', height: 220 },
  heroPlaceholder: { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 64 },

  body: { padding: 20 },

  categoryLabel: {
    fontSize: 11, fontWeight: '700', color: '#059669',
    letterSpacing: 1.2, marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#1F1F1F', lineHeight: 30, marginBottom: 4 },
  altName: { fontSize: 13, color: '#aaa', fontStyle: 'italic', marginBottom: 8 },
  description: { fontSize: 14, color: '#666', lineHeight: 21, marginBottom: 20 },

  servingRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 16,
  },
  servingLabel: { fontSize: 13, fontWeight: '600', color: '#1F1F1F', flex: 1 },
  servingControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  servingBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center', justifyContent: 'center',
  },
  servingBtnText: { fontSize: 18, fontWeight: '700', color: '#fff', lineHeight: 22 },
  servingCount: { fontSize: 16, fontWeight: '800', color: '#1F1F1F', minWidth: 28, textAlign: 'center' },
  servingYield: { fontSize: 11, color: '#999', marginLeft: 10 },

  nutritionRow: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
  },
  nutritionBox: {
    flex: 1, backgroundColor: '#1F1F1F', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  nutritionVal: { fontSize: 16, fontWeight: '800', color: '#fff' },
  nutritionUnit: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(5,150,105,0.1)',
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20,
  },
  chipIcon: { fontSize: 13 },
  chipText: { fontSize: 12, fontWeight: '600', color: '#059669' },

  localNamesRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  localNamesLabel: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  localNamesText: { fontSize: 12, color: '#666', fontStyle: 'italic', flex: 1 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F1F1F', marginBottom: 14 },

  ingredientsGrid: { gap: 10 },
  ingredientRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: '#F9FAFB', borderRadius: 10,
  },
  ingredientDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#059669', marginRight: 10, flexShrink: 0,
  },
  ingredientName: { flex: 1, fontSize: 13, color: '#1F1F1F', fontWeight: '500' },
  ingredientAmount: { fontSize: 12, color: '#059669', fontWeight: '600' },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#059669',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, flexShrink: 0, marginTop: 1,
  },
  stepNumText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  stepText: { flex: 1, fontSize: 14, color: '#444', lineHeight: 21 },

  countries: { fontSize: 12, color: '#999', marginTop: 8, marginBottom: 8 },
});

export default MakeRecipePage;
