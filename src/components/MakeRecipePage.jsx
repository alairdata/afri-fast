import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Image, Modal, SafeAreaView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../lib/supabase';
import { ensureAiConsent, AiConsentError } from '../lib/consent';
import { AFRICAN_RECIPES, RECIPE_CATEGORIES } from '../lib/africanRecipes';
import { useRecipesVersion } from '../lib/recipes';
import { useSubscription } from '../lib/subscription';
import { unlock } from './ProLock';
import LumiRive from './LumiRive';
import { useSavedRecipes, toggleSavedRecipe, useCustomRecipes, removeCustomRecipe } from '../lib/savedRecipes';
import { showAlert } from '../lib/alert';
import ShimmerImage from './ShimmerImage';
import HeaderFade, { useHeaderFadeScroll } from './HeaderFade';
import { aiHeaders } from '../lib/aiAuth';
import { dc, themedStyles } from '../lib/theme';

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

// The label above a recipe's name: the kind of dish, read from its name, never a meal time like "Lunch".
const DISH_TYPES = [
  [/drink/i, 'DRINK', 'category'],
  [/soup/i, 'SOUP'],
  [/rice|waakye/i, 'RICE DISH'],
  [/porridge|\bpap\b|koko|oatmeal|kunu/i, 'PORRIDGE'],
  [/yam/i, 'YAM DISH'],
  [/beans|moi moi/i, 'BEANS DISH'],
  [/stew|sauce/i, 'STEW'],
  [/salad/i, 'SALAD'],
  [/suya|grilled/i, 'GRILL'],
  [/plantain|dodo/i, 'PLANTAIN DISH'],
  [/tilapia|fish/i, 'FISH DISH'],
  [/indomie/i, 'NOODLES'],
  [/dessert/i, 'SWEET TREAT', 'category'],
  [/snack/i, 'SNACK', 'category'],
];
const dishLabel = (recipe) => {
  const hit = DISH_TYPES.find(([re, , field]) => re.test(field === 'category' ? recipe.category || '' : recipe.name || ''));
  return hit ? hit[1] : null;
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

export const RecipeDetailModal = ({ recipe, visible, onClose, onLogMeal, userCountry, userId }) => {
  const savedIds = useSavedRecipes(userId);
  const [servings, setServings] = useState(1);
  const [communityPhotos, setCommunityPhotos] = useState([]);
  const [communityCard, setCommunityCard] = useState(null);
  const detailFade = useHeaderFadeScroll();
  useEffect(() => { detailFade.scrollY.setValue(0); }, [recipe?.id]);

  // Reset servings + fetch community photos when recipe changes
  useEffect(() => { setServings(1); }, [recipe?.id]);
  useEffect(() => {
    if (!recipe?.id || !visible) return;
    setCommunityPhotos([]);
    supabase
      .from('recipe_community_photos')
      .select('id, photo_url, items, created_at, user_id')
      .eq('recipe_id', recipe.id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => { if (data) setCommunityPhotos(data); });
  }, [recipe?.id, visible]);

  // A reported photo is hidden for everyone straight away (database trigger) until it is reviewed.
  const reportPhoto = (p) => {
    showAlert('Report this photo?', "It will be hidden right away and we'll review it within 24 hours.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report', style: 'destructive', onPress: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          const uid = session?.user?.id;
          if (!uid) return;
          const { error } = await supabase.from('community_reports').insert({ photo_id: String(p.id), reporter_id: uid, reason: 'inappropriate' });
          setCommunityPhotos((prev) => prev.filter((x) => x.id !== p.id));
          setCommunityCard(null);
          showAlert(error ? "Couldn't send the report" : 'Thanks for letting us know', error ? 'Please try again, or contact support from Settings.' : "We've hidden this photo and will review it.");
        },
      },
    ]);
  };

  // Hide every photo from this person, for this user only.
  const blockPoster = (p) => {
    showAlert("Hide this person's photos?", "You won't see any community photos from them again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Hide', style: 'destructive', onPress: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          const uid = session?.user?.id;
          if (!uid || !p.user_id || p.user_id === uid) return;
          await supabase.from('community_blocks').upsert({ blocker_id: uid, blocked_id: p.user_id });
          setCommunityPhotos((prev) => prev.filter((x) => x.user_id !== p.user_id));
          setCommunityCard(null);
        },
      },
    ]);
  };

  if (!recipe) return null;

  const scale = servings;
  const scaled = (val) => Math.round(val * scale);
  const displayName = getLocalName(recipe, userCountry);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={detail.container}>
        <HeaderFade bg="#FFFFFF" scrollY={detailFade.scrollY} />
        {/* Header */}
        <View style={detail.header}>
          <TouchableOpacity style={detail.closeBtn} onPress={onClose}>
            <Text style={detail.closeX}>✕</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {userId ? (
            <TouchableOpacity
              style={[detail.closeBtn, { marginRight: onLogMeal ? 10 : 0 }]}
              onPress={() => (recipe.custom ? (removeCustomRecipe(userId, recipe.id), onClose()) : toggleSavedRecipe(userId, recipe.id))}
              accessibilityLabel={recipe.custom || savedIds.includes(recipe.id) ? 'Remove from saved recipes' : 'Save recipe'}
            >
              <Ionicons name={recipe.custom || savedIds.includes(recipe.id) ? 'bookmark' : 'bookmark-outline'} size={17} color={recipe.custom || savedIds.includes(recipe.id) ? dc('#059669', 'text') : dc('#4B5563', 'text')} />
            </TouchableOpacity>
          ) : null}
          {onLogMeal && (
            <TouchableOpacity style={detail.logBtn} onPress={() => { onLogMeal({ ...recipe, calories: scaled(recipe.calories), protein: scaled(recipe.protein), carbs: scaled(recipe.carbs), fats: scaled(recipe.fats), servings }); onClose(); }}>
              <Text style={detail.logBtnText}>Log Meal</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={detail.scroll} showsVerticalScrollIndicator={false} {...detailFade.scrollProps}>
          {/* Image */}
          {recipe.imageUrl ? (
            <View>
              <ShimmerImage uri={recipe.imageUrl} style={detail.heroImage} />
              {recipe.aiImage && (
                <View style={detail.aiBadge}>
                  <Ionicons name="sparkles-outline" size={11} color={dc("#fff", 'text')} />
                  <Text style={detail.aiBadgeText}>AI image · how it could look</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[detail.heroImage, detail.heroPlaceholder]}>
              <Text style={detail.heroEmoji}>🍽️</Text>
            </View>
          )}

          <View style={detail.body}>
            {/* What kind of dish it is (not a meal time: people eat the same dish at any time of day) */}
            {dishLabel(recipe) ? <Text style={detail.categoryLabel}>{dishLabel(recipe)}</Text> : null}

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
                  <Text style={[detail.chipText, { color: dc('#EF4444', 'text') }]}>{recipe.cookTime} cook</Text>
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

            {/* Note */}
            {recipe.note && (
              <View style={detail.noteBox}>
                <Text style={detail.noteText}>📝 {recipe.note}</Text>
              </View>
            )}

            {/* Community Photos */}
            <View style={detail.section}>
              <Text style={detail.sectionTitle}>How others ate this meal</Text>
              {communityPhotos.length === 0 ? (
                <View style={detail.communityEmpty}>
                  <Text style={detail.communityEmptyIcon}>📸</Text>
                  <Text style={detail.communityEmptyText}>Be the first to log this meal</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={detail.communityScroll}>
                  {communityPhotos.map((p) => (
                    <TouchableOpacity key={p.id} style={detail.communityCard} onPress={() => setCommunityCard(p)} activeOpacity={0.85}>
                      <View style={detail.communityAvatar}>
                        <Ionicons name="person-circle" size={36} color={dc("#059669", 'text')} />
                      </View>
                      <ShimmerImage uri={p.photo_url} style={detail.communityPhoto} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Community photo share card */}
      <Modal visible={!!communityCard} transparent={false} animationType="slide" onRequestClose={() => setCommunityCard(null)}>
        <View style={detail.cardScreen}>
          <TouchableOpacity style={detail.cardBackBtn} onPress={() => setCommunityCard(null)}>
            <Ionicons name="chevron-back" size={22} color={dc("#fff", 'text')} />
          </TouchableOpacity>
          {communityCard && (() => {
            const items = communityCard.items || [];
            const total = items.reduce((s, f) => s + (f.cal || f.calories || 0), 0);
            return (
              <ScrollView contentContainerStyle={detail.cardScroll} showsVerticalScrollIndicator={false}>
                <View style={detail.cardTopLabel}>
                  <Ionicons name="person-circle" size={16} color={dc("#059669", 'text')} />
                  <Text style={detail.cardTopLabelText}>Community Meal</Text>
                </View>
                <View style={detail.card}>
                  {/* Photo */}
                  <View style={[detail.cardImgPanel, { height: 340 }]}>
                    <ShimmerImage uri={communityCard.photo_url} style={StyleSheet.absoluteFill} />
                  </View>
                  {/* Detected foods */}
                  <View style={detail.cardInfoPanel}>
                    <Text style={detail.cardFoodsTitle}>Detected Foods</Text>
                  </View>
                  <View style={detail.cardItems}>
                    {items.length === 0
                      ? <View style={detail.cardItem}><Text style={detail.cardItemName}>No ingredients recorded</Text></View>
                      : items.map((f, i) => (
                          <View key={i} style={detail.cardItem}>
                            <View style={[detail.cardDot, { backgroundColor: i === 0 ? dc('#4ade80', 'bg') : i === 1 ? dc('#60a5fa', 'bg') : i === 2 ? dc('#f59e0b', 'bg') : dc('#a78bfa', 'bg') }]} />
                            <Text style={detail.cardItemName}>{f.name}</Text>
                            <Text style={detail.cardItemCal}>{f.cal || f.calories || 0} cal</Text>
                          </View>
                        ))
                    }
                  </View>
                  {/* Total */}
                  <View style={detail.cardKcalSection}>
                    <Text style={[detail.cardKcalNum, total >= 1000 && { fontSize: 40, letterSpacing: -2 }]}>{total}</Text>
                    <Text style={detail.cardKcalUnit}>KCAL</Text>
                  </View>
                  {/* Footer */}
                  <View style={detail.cardFooter}>
                    <Text style={detail.cardFooterText}>Community · Logga</Text>
                    <View style={detail.cardFooterBadge}><Text style={detail.cardFooterBadgeText}>Made with Logga →</Text></View>
                  </View>
                </View>
                {/* Buttons */}
                <View style={detail.cardActions}>
                  <TouchableOpacity
                    style={detail.cardLogBtn}
                    onPress={() => {
                      if (onLogMeal) {
                        onLogMeal({
                          ...recipe,
                          calories: total || recipe.calories,
                          photo: communityCard.photo_url,
                          name: items.length ? items.map(f => f.name).join(', ') : recipe.name,
                        });
                      }
                      setCommunityCard(null);
                      onClose();
                    }}
                  >
                    <Text style={detail.cardLogBtnText}>Log this meal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={detail.cardDoneBtn} onPress={() => setCommunityCard(null)}>
                    <Text style={detail.cardDoneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
                {/* Safety (guideline 1.2): report a photo, or hide everything from the person who shared it */}
                <View style={detail.cardSafetyRow}>
                  <TouchableOpacity onPress={() => reportPhoto(communityCard)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={detail.cardSafetyTxt}>Report photo</Text>
                  </TouchableOpacity>
                  {communityCard.user_id ? (
                    <>
                      <Text style={detail.cardSafetyDot}>·</Text>
                      <TouchableOpacity onPress={() => blockPoster(communityCard)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={detail.cardSafetyTxt}>Hide this person's photos</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              </ScrollView>
            );
          })()}
        </View>
      </Modal>
    </Modal>
  );
};

// ── Make Recipe Page ─────────────────────────────────────────────────────────


const CATEGORY_META = {
  'Weight Loss Friendly': { icon: 'flag-outline', subtitle: 'Low calorie, big satisfaction' },
  'Breakfast': { icon: 'sunny-outline', subtitle: 'Start your morning right' },
  'Lunch': { icon: 'restaurant-outline', subtitle: 'Midday meals to keep you going' },
  'Dinner': { icon: 'moon-outline', subtitle: 'Light and satisfying evening meals' },
  'Snacks': { icon: 'nutrition-outline', subtitle: 'Healthy bites between meals' },
  'Desserts': { icon: 'ice-cream-outline', subtitle: 'Sweet treats, African style' },
  'Drinks': { icon: 'cafe-outline', subtitle: 'Refreshing beverages' },
  'Weight Loss Drinks': { icon: 'water-outline', subtitle: 'Low-calorie drinks that support your goals' },
  'Quick & Easy': { icon: 'flash-outline', subtitle: 'Ready in under 15 minutes' },
  'Low Fat': { icon: 'leaf-outline', subtitle: 'Light on fat, big on taste' },
  'Low Carb': { icon: 'remove-circle-outline', subtitle: 'Keep the carbs down' },
  'High Protein': { icon: 'barbell-outline', subtitle: 'Fuel your muscles' },
};

const getLocalName = (recipe, userCountry) =>
  (userCountry && recipe.localNames?.[userCountry]) || recipe.name;

export const RecipeCard = ({ recipe, onPress, userCountry }) => {
  const [imgError, setImgError] = useState(false);
  const displayName = getLocalName(recipe, userCountry);
  const toMins = t => { if (!t) return 0; const n = parseInt(t); return isNaN(n) ? 0 : /hr/i.test(t) ? n * 60 : n; };
  const total = toMins(recipe.prepTime) + toMins(recipe.cookTime);
  const timeStr = total >= 60 ? `${Math.floor(total / 60)}h ${total % 60 > 0 ? `${total % 60}m` : ''}`.trim() : total > 0 ? `${total} mins` : null;
  const showImg = recipe.imageUrl && !imgError;
  return (
    <TouchableOpacity style={styles.recipeCard} onPress={onPress}>
      {showImg ? (
        <ShimmerImage
          uri={recipe.imageUrl}
          style={styles.recipeCardImg}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.recipeCardImg, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={styles.recipeCardEmoji}>🍽️</Text>
        </View>
      )}
      <Text style={styles.recipeCardName} numberOfLines={2}>{displayName}</Text>
      <View style={styles.recipeCardMeta}>
        <Text style={styles.recipeCardCal}>{recipe.calories} cal</Text>
        {timeStr && <Text style={styles.recipeCardTime}>{timeStr}</Text>}
      </View>
    </TouchableOpacity>
  );
};

const GEMINI_BASE = Platform.OS === 'web' ? '' : 'https://afri-fast.vercel.app';

const readUriAsBase64 = async (uri) => {
  if (Platform.OS === 'web') {
    if (uri.startsWith('data:')) return uri.split(',')[1];
    const blob = await fetch(uri).then(r => r.blob());
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
};

const scoreRecipe = (recipe, identifiedIngredients) => {
  if (!identifiedIngredients.length || !recipe.ingredients?.length) return 0;
  const lower = identifiedIngredients.map(i => i.toLowerCase());
  let score = 0;
  for (const ing of recipe.ingredients) {
    const words = ing.name.toLowerCase().split(/[\s,/()+]+/).filter(w => w.length > 2);
    if (lower.some(id => words.some(w => id.includes(w) || w.includes(id)))) score++;
  }
  return score;
};

const WEST_AFRICA = new Set(['Nigeria', 'Ghana', 'Benin', 'Togo', 'Sierra Leone', 'Liberia', 'Gambia', 'Senegal', 'Ivory Coast', 'Niger', 'Burkina Faso', 'Guinea', 'Guinea-Bissau', 'Mali', 'Mauritania', 'Cabo Verde']);

const recipeMatchesCountry = (recipe, country) =>
  !!recipe.countries?.some(c =>
    c === country ||
    c.startsWith(`${country} (`) ||
    c === 'Universal' ||
    ((c === 'West Africa' || c === 'All West African countries') && WEST_AFRICA.has(country))
  );

const recipesForCountry = (country) => {
  if (!country) return AFRICAN_RECIPES;
  // Every recipe stays visible; the user's country's dishes just come first in each section.
  const matched = AFRICAN_RECIPES.filter(r => recipeMatchesCountry(r, country));
  return [...matched, ...AFRICAN_RECIPES.filter(r => !matched.includes(r))];
};

const MakeRecipePage = ({ show, onLogMeal, userCountry, userId, onOpenKitchen }) => {
  const customRecipes = useCustomRecipes(userId);
  const savedIds = useSavedRecipes(userId);
  const [showSaved, setShowSaved] = useState(false);
  // The search box is well down the page. When the keyboard opens we scroll the page so the box sits at the
  // top of what is left on screen (and add room at the bottom so there is something to scroll into).
  const pageScrollRef = useRef(null);
  const searchY = useRef(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [makeRecipeMethod, setMakeRecipeMethod] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [photoPhase, setPhotoPhase] = useState(null); // null | 'analyzing' | 'results' | 'error'
  const [photoIngredients, setPhotoIngredients] = useState([]);
  const [photoMatches, setPhotoMatches] = useState([]);
  const [photoError, setPhotoError] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [pendingUris, setPendingUris] = useState([]);
  const { isPro } = useSubscription();
  const [listOpen, setListOpen] = useState(false);
  const [listText, setListText] = useState('');
  const cameraRef = useRef(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const recipesVersion = useRecipesVersion(); // the list from Supabase arrived or changed
  const visibleRecipes = useMemo(() => recipesForCountry(userCountry), [userCountry, recipesVersion]);
  const freeRecipeIds = useMemo(() => {
    const ids = new Set();
    RECIPE_CATEGORIES.forEach(cat => { const first = visibleRecipes.find(r => r.category === cat); if (first) ids.add(first.id); });
    return ids;
  }, [visibleRecipes]);
  const isLocked = (recipe) => !recipe.custom && !isPro && !freeRecipeIds.has(recipe.id);

  // 'List it': match recipes to the ingredients you type (no AI needed).
  const findFromList = () => {
    const ingredients = listText.split(/[,\n]+/).map(t => t.trim()).filter(Boolean);
    if (!ingredients.length) return;
    const scored = AFRICAN_RECIPES
      .map(r => ({ r, s: scoreRecipe(r, ingredients) }))
      .filter(({ s }) => s > 0)
      .sort((x, y) => y.s - x.s)
      .slice(0, 8)
      .map(({ r }) => r);
    setPhotoIngredients(ingredients);
    setPhotoMatches(scored);
    setPhotoError(scored.length ? null : "No recipes match those ingredients yet. Try adding a few more.");
    setPhotoPhase(scored.length ? 'results' : 'error');
    setListOpen(false);
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return visibleRecipes.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      Object.values(r.localNames || {}).some(n => n.toLowerCase().includes(q)) ||
      (r.ingredients || []).some(ing => (ing.name || '').toLowerCase().includes(q))
    );
  }, [searchQuery, visibleRecipes]);

  const openRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setDetailVisible(true);
  };

  useEffect(() => {
    if (makeRecipeMethod === 'photo') {
      setMakeRecipeMethod(null);
      openCamera();
    } else if (makeRecipeMethod === 'gallery') {
      setMakeRecipeMethod(null);
      launchGalleryRecipe();
    }
  }, [makeRecipeMethod]);

  const openCamera = async () => {
    if (!(await ensureAiConsent())) return; // ingredient photos go to the AI provider
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        showAlert('Camera access needed', 'Please allow camera access to take photos of your ingredients.');
        return;
      }
    }
    setPendingUris([]);
    setShowCamera(true);
  };

  const takeRecipePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      setPendingUris(prev => [...prev, photo.uri]);
    } catch (e) {
      console.log('Camera error:', e);
    }
  };

  const pickGalleryInsideCamera = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Gallery access needed', 'Please allow gallery access to pick photos.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      allowsMultipleSelection: true,
    });
    if (picked.canceled || !picked.assets?.length) return;
    setPendingUris(prev => [...prev, ...picked.assets.map(a => a.uri)]);
  };

  const analyseUris = async (uris) => {
    setPhotoPhase('analyzing');
    setPhotoError(null);
    setPhotoIngredients([]);
    setPhotoMatches([]);
    setPendingUris([]);
    try {
      if (!(await ensureAiConsent({ silent: true }))) throw new AiConsentError();
      const images = await Promise.all(uris.map(readUriAsBase64));
      const resp = await fetch(`${GEMINI_BASE}/api/gemini`, {
        method: 'POST',
        headers: await aiHeaders(),
        body: JSON.stringify({ type: 'identify_ingredients', data: { images } }),
      });
      const result = await resp.json();
      if (!resp.ok || result.error) throw new Error(result.error || 'Could not analyse photos');
      const ingredients = result.ingredients || [];
      setPhotoIngredients(ingredients);
      const scored = AFRICAN_RECIPES
        .map(r => ({ r, s: scoreRecipe(r, ingredients) }))
        .filter(({ s }) => s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 8)
        .map(({ r }) => r);
      setPhotoMatches(scored.length > 0 ? scored : AFRICAN_RECIPES.filter((_, i) => i < 6));
      setPhotoPhase('results');
    } catch (e) {
      setPhotoError(e.message || 'Something went wrong. Try again.');
      setPhotoPhase('error');
    }
  };

  const launchGalleryRecipe = async () => {
    if (!(await ensureAiConsent())) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Gallery access needed', 'Please allow gallery access to pick photos.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      allowsMultipleSelection: true,
    });
    if (picked.canceled || !picked.assets?.length) return;
    await analyseUris(picked.assets.map(a => a.uri));
  };

  const renderRecipeCard = (recipe) => {
    const displayName = getLocalName(recipe, userCountry);
    const isLocalised = displayName !== recipe.name;
    const locked = isLocked(recipe);
    return (
      <TouchableOpacity key={recipe.id} style={styles.recipeCard} onPress={() => (locked ? unlock('recipe') : openRecipe(recipe))}>
        {recipe.imageUrl ? (
          <ShimmerImage uri={recipe.imageUrl} style={styles.recipeCardImg} />
        ) : (
          <View style={[styles.recipeCardImg, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={styles.recipeCardEmoji}>🍽️</Text>
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

  const pageFade = useHeaderFadeScroll();
  if (!show) return null;

  return (
    // While the camera is open it needs to sit above the bottom tab bar (zIndex
    // 20) like a true full-screen capture UI; otherwise this sits below it so
    // the tab bar stays visible, since this now only renders as the Ideas tab.
    <View style={[styles.overlay, showCamera && { zIndex: 9999 }]}>
      <HeaderFade bg="#F2F2F2" scrollY={pageFade.scrollY} />
      <View style={styles.page}>
        {/* Header: Recipes is a tab now, so no back arrow; the bookmark opens saved recipes */}
        <View style={styles.header}>
          <Text style={styles.pageHeading} accessibilityRole="header">What sounds good today?</Text>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowSaved(true)} accessibilityLabel="Saved recipes">
            <Ionicons name={savedIds.length || customRecipes.length ? 'bookmark' : 'bookmark-outline'} size={19} color={dc("#1F1F1F", 'text')} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={pageScrollRef}
          {...pageFade.scrollProps}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          stickyHeaderIndices={[0]}
          contentContainerStyle={{ paddingBottom: searchFocused ? 420 : 100 }}
        >
          {/* Search */}
          <View style={styles.searchBar} onLayout={(e) => { searchY.current = e.nativeEvent.layout.y; }}>
            <Ionicons name="search" size={17} color={dc("#4B5563", 'text')} style={{ marginRight: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Find a recipe or ingredient..."
              placeholderTextColor={dc("#9CA3AF", 'text')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => {
                setSearchFocused(true);
                setTimeout(() => pageScrollRef.current?.scrollTo({ y: Math.max(0, searchY.current - 12), animated: true }), 150);
              }}
              onBlur={() => setSearchFocused(false)}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
                <Ionicons name="close-circle" size={16} color={dc("#ccc", 'text')} />
              </TouchableOpacity>
            )}
          </View>

          {/* Build a recipe from my kitchen (Pro): type, snap or say what you have and get a recipe that fits */}
          <TouchableOpacity style={styles.kitchenCard} onPress={() => (isPro ? onOpenKitchen && onOpenKitchen() : unlock('recipe_photo'))} activeOpacity={0.85} accessibilityLabel="Build a recipe from my kitchen">
            <View style={styles.kitchenIcon}><Ionicons name="restaurant-outline" size={20} color={dc("#16A34A", 'text')} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kitchenTitle}>Build a recipe from my kitchen</Text>
              <Text style={styles.actionDesc}>Snap a photo or list what you have</Text>
              {!isPro && <View style={styles.proPill}><Text style={styles.proPillText}>PRO</Text></View>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={dc("#6B7280", 'text')} />
          </TouchableOpacity>

          {/* Shop It (a grocery list from the meals you plan to cook) is hidden until it is built */}

          {listOpen && isPro && (
            <View style={styles.listBox}>
              <TextInput
                style={styles.listInput}
                placeholder="e.g. rice, tomatoes, chicken, onions"
                placeholderTextColor={dc("#999", 'text')}
                value={listText}
                onChangeText={setListText}
                multiline
                autoFocus
              />
              <TouchableOpacity style={[styles.listBtn, !listText.trim() && { opacity: 0.5 }]} onPress={findFromList} disabled={!listText.trim()}>
                <Text style={styles.listBtnTxt}>Find recipes</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Photo analysis states */}
          {photoPhase === 'analyzing' && (
            <View style={styles.photoAnalyzing}>
              <LumiRive name="reading" width={120} height={120} />
              <Text style={styles.photoAnalyzingText}>Analysing your ingredients...</Text>
            </View>
          )}

          {photoPhase === 'error' && (
            <View style={styles.photoErrorBox}>
              <Text style={styles.photoErrorText}>{photoError || 'Could not analyse the photo.'}</Text>
              <TouchableOpacity onPress={() => (photoIngredients.length && listText ? setListOpen(true) : openCamera())} style={styles.photoRetryBtn}>
                <Text style={styles.photoRetryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          )}

          {photoPhase === 'results' && photoMatches.length > 0 && (
            <View style={styles.photoResults}>
              <View style={styles.photoResultsHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.photoResultsTitle}>Recipes you can make</Text>
                  {photoIngredients.length > 0 && (
                    <Text style={styles.photoResultsSub} numberOfLines={1}>
                      Spotted: {photoIngredients.slice(0, 5).join(', ')}{photoIngredients.length > 5 ? ` +${photoIngredients.length - 5} more` : ''}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => { setPhotoPhase(null); setPhotoMatches([]); }}>
                  <Ionicons name="close-circle" size={22} color={dc("#ccc", 'text')} />
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll}>
                {photoMatches.map(recipe => renderRecipeCard(recipe))}
              </ScrollView>
            </View>
          )}

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
                const recipes = visibleRecipes.filter(r => r.category === cat);
                if (recipes.length === 0) return null;
                const meta = CATEGORY_META[cat] || {};
                return (
                  <View key={cat} style={styles.section}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {meta.icon ? <Ionicons name={meta.icon} size={20} color={dc("#16201b", 'text')} /> : null}
                      <Text style={styles.sectionTitle}>{cat}</Text>
                    </View>
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

      {/* In-app Camera overlay */}
      {showCamera && (
        <View style={styles.cameraOverlay}>
          {!cameraPermission?.granted ? (
            <View style={styles.cameraPermission}>
              <Ionicons name="camera-outline" size={48} color={dc("#D1D5DB", 'text')} />
              <Text style={styles.cameraPermissionText}>Camera access is required</Text>
            </View>
          ) : (
            <>
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />

              {/* Back button */}
              <TouchableOpacity style={styles.camBackBtn} onPress={() => { setShowCamera(false); setPendingUris([]); }}>
                <Ionicons name="chevron-back" size={26} color={dc("#fff", 'text')} />
              </TouchableOpacity>

              {/* Hint */}
              {pendingUris.length === 0 && (
                <Text style={styles.camHint}>Snap your fridge, pantry or ingredients</Text>
              )}

              {/* Thumbnail strip — inside camera, above controls */}
              {pendingUris.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.camStrip}
                  contentContainerStyle={styles.camStripContent}
                >
                  {pendingUris.map((uri, i) => (
                    <View key={i} style={styles.camThumbWrap}>
                      <Image source={{ uri }} style={styles.camThumb} />
                      <TouchableOpacity
                        style={styles.camThumbRemove}
                        onPress={() => setPendingUris(prev => prev.filter((_, j) => j !== i))}
                      >
                        <Ionicons name="close-circle" size={20} color={dc("#fff", 'text')} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Bottom controls */}
              <View style={styles.camControls}>
                {/* Gallery picker */}
                <TouchableOpacity style={styles.camSideBtn} onPress={pickGalleryInsideCamera}>
                  <Ionicons name="image-outline" size={28} color={dc("#fff", 'text')} />
                  {pendingUris.length > 0 && <Text style={styles.camSideBtnLabel}>Add more</Text>}
                </TouchableOpacity>

                {/* Shutter */}
                <TouchableOpacity style={styles.camShutter} onPress={takeRecipePhoto}>
                  <View style={styles.camShutterInner} />
                </TouchableOpacity>

                {/* Find recipes */}
                {pendingUris.length > 0 ? (
                  <TouchableOpacity style={styles.camFindBtn} onPress={() => { setShowCamera(false); analyseUris(pendingUris); }}>
                    <Text style={styles.camFindBtnText}>Find{'\n'}recipes</Text>
                    <Ionicons name="arrow-forward" size={16} color={dc("#fff", 'text')} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.camSideBtn} />
                )}
              </View>
            </>
          )}
        </View>
      )}

      {/* Saved recipes */}
      <Modal visible={showSaved} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSaved(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: dc('#F2F2F2', 'bg') }}>
          <View style={styles.savedHeader}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowSaved(false)} accessibilityLabel="Close">
              <Ionicons name="chevron-down" size={24} color={dc("#1F1F1F", 'text')} />
            </TouchableOpacity>
            <Text style={styles.pageTitle}>Saved recipes</Text>
            <View style={{ width: 44 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            {(() => {
              const saved = [...customRecipes, ...savedIds.map(id => AFRICAN_RECIPES.find(r => r.id === id)).filter(Boolean)];
              if (!saved.length) return (
                <View style={{ alignItems: 'center', paddingVertical: 80 }}>
                  <Ionicons name="bookmark-outline" size={32} color={dc("#9CA3AF", 'text')} />
                  <Text style={styles.savedEmptyTitle}>No saved recipes yet</Text>
                  <Text style={styles.savedEmptySub}>Tap the bookmark on any recipe to keep it here.</Text>
                </View>
              );
              return (
                <View style={styles.savedGrid}>
                  {saved.map(recipe => renderRecipeCard(recipe))}
                </View>
              );
            })()}
          </ScrollView>
        </SafeAreaView>
        {/* The recipe opens over the saved list */}
        <RecipeDetailModal
          recipe={selectedRecipe}
          visible={detailVisible && showSaved}
          onClose={() => setDetailVisible(false)}
          onLogMeal={(r) => { setShowSaved(false); onLogMeal && onLogMeal(r); }}
          userCountry={userCountry}
          userId={userId}
        />
      </Modal>

      {/* Recipe Detail Modal */}
      <RecipeDetailModal
        recipe={selectedRecipe}
        visible={detailVisible && !showSaved}
        onClose={() => setDetailVisible(false)}
        onLogMeal={onLogMeal}
        userCountry={userCountry}
        userId={userId}
      />
    </View>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = themedStyles({
  overlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#F2F2F2',
    // Below BottomTabBar's zIndex (20): this is the Recipes tab, so the tab bar stays on top.
    zIndex: 1,
  },
  page: { flex: 1, flexDirection: 'column' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: 20, paddingRight: 8, paddingBottom: 10, paddingTop: 10,
  },
  headerIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 17, fontWeight: '600', color: '#1F1F1F' },
  pageHeading: { flex: 1, fontSize: 20, fontWeight: '700', color: '#1F1F1F', letterSpacing: -0.3 },
  content: { flex: 1, paddingHorizontal: 20 },

  actionRow: { flexDirection: 'row', gap: 10 },
  kitchenCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#E2E9E4', borderRadius: 16, padding: 14, marginBottom: 18 },
  kitchenIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  kitchenTitle: { fontSize: 16, fontWeight: '700', color: '#1F1F1F' },
  actionCard: { flex: 1, backgroundColor: '#E2E9E4', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
  actionTitle: { fontSize: 16, fontWeight: '600', color: '#1F1F1F', marginTop: 8 },
  actionDesc: { fontSize: 12, color: '#4B5563', marginTop: 3 },
  proPill: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.06)' },
  proPillText: { fontSize: 11, fontWeight: '700', color: '#1F1F1F' },
  shopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10, marginBottom: 18,
    backgroundColor: '#FCFCFC', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
  },
  shopIcon: { width: 50, height: 50, borderRadius: 10, backgroundColor: '#F0F2F1', alignItems: 'center', justifyContent: 'center' },
  shopTitle: { fontSize: 16, fontWeight: '600', color: '#1F1F1F' },
  savedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  savedGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  savedEmptyTitle: { fontSize: 16, fontWeight: '700', color: '#1F1F1F', marginTop: 12 },
  savedEmptySub: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  listBox: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 20, borderWidth: 1.5, borderColor: 'rgba(5,150,105,0.12)' },
  listInput: { minHeight: 64, fontSize: 15, color: '#1F1F1F', textAlignVertical: 'top' },
  listBtn: { marginTop: 8, height: 44, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  listBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FCFCFC', borderRadius: 10,
    paddingVertical: 13, paddingHorizontal: 14,
    marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1F1F1F' },

  section: { marginBottom: 18 },
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

  cameraOverlay: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10000, backgroundColor: '#000', overflow: 'hidden',
  },
  cameraPermission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  cameraPermissionText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center' },
  camBackBtn: {
    position: 'absolute', top: 50, left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  camHint: {
    position: 'absolute', bottom: 160, alignSelf: 'center',
    color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, textAlign: 'center',
  },
  camStrip: {
    position: 'absolute', bottom: 148, left: 0, right: 0,
  },
  camStripContent: { paddingHorizontal: 16, gap: 10, alignItems: 'flex-end' },
  camThumbWrap: { position: 'relative' },
  camThumb: { width: 64, height: 64, borderRadius: 10, borderWidth: 2, borderColor: '#fff' },
  camThumbRemove: {
    position: 'absolute', top: -7, right: -7,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10,
  },
  camControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 130, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 32, paddingBottom: Platform.OS === 'web' ? 20 : 36,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  camSideBtn: {
    width: 64, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  camSideBtnLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  camShutter: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  camShutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
  camFindBtn: {
    width: 64, backgroundColor: '#059669', borderRadius: 14,
    paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  camFindBtnText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 14 },

  photoAnalyzing: {
    alignItems: 'center', gap: 10,
    backgroundColor: '#F0FDF4', borderRadius: 14,
    padding: 16, marginBottom: 20,
    borderWidth: 1.5, borderColor: 'rgba(5,150,105,0.15)',
  },
  photoAnalyzingText: { fontSize: 14, color: '#059669', fontWeight: '600' },

  photoErrorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 14,
    padding: 16, marginBottom: 20,
    borderWidth: 1.5, borderColor: 'rgba(239,68,68,0.2)',
    gap: 10,
  },
  photoErrorText: { fontSize: 13, color: '#DC2626' },
  photoRetryBtn: { alignSelf: 'flex-start', backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14 },
  photoRetryText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  photoResults: { marginBottom: 28 },
  photoResultsHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8,
  },
  photoResultsTitle: { fontSize: 16, fontWeight: '700', color: '#1F1F1F' },
  photoResultsSub: { fontSize: 12, color: '#888', marginTop: 2 },
});

const detail = themedStyles({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
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

  aiBadge: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: 'rgba(17,24,39,0.6)' },

  aiBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },

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
  communityScroll: { marginTop: 12 },
  communityCard: { marginRight: 10, alignItems: 'center', width: 90 },
  communityAvatar: { marginBottom: -20, zIndex: 1 },
  communityAvatarIcon: { fontSize: 18 },
  communityPhoto: { width: 90, height: 160, borderRadius: 16, backgroundColor: '#E5E7EB' },
  noteBox: { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FDE68A' },
  noteText: { fontSize: 13, color: '#92400E', lineHeight: 19 },
  communityEmpty: { alignItems: 'center', paddingVertical: 24 },
  communityEmptyIcon: { fontSize: 32 },
  communityEmptyText: { fontSize: 13, color: '#9CA3AF', marginTop: 8, fontWeight: '500' },

  // Community card modal
  cardScreen: { flex: 1, backgroundColor: '#0a0a0a' },
  cardBackBtn: { position: 'absolute', top: Platform.OS === 'web' ? 16 : 48, left: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  cardScroll: { paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 72 : 104, paddingBottom: 48, alignItems: 'center' },
  cardTopLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 18 },
  cardTopLabelText: { fontSize: 13, fontWeight: '700', color: '#059669' },
  card: { alignSelf: 'stretch', backgroundColor: '#111', borderRadius: 24, overflow: 'hidden' },
  cardImgPanel: { width: '100%', backgroundColor: '#064E3B' },
  cardInfoPanel: { backgroundColor: '#111', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 4 },
  cardFoodsTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 },
  cardItems: { backgroundColor: '#0e0e0e', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  cardItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', gap: 12 },
  cardDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  cardItemName: { flex: 1, fontSize: 13, fontWeight: '500', color: '#e5e5e5' },
  cardItemCal: { fontSize: 13, fontWeight: '700', color: '#fff', minWidth: 56, textAlign: 'right' },
  cardKcalSection: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 14, backgroundColor: '#111' },
  cardKcalNum: { fontSize: 50, fontWeight: '900', color: '#fff', lineHeight: 50, letterSpacing: -2 },
  cardKcalUnit: { fontSize: 12, color: '#4ade80', fontWeight: '600', marginBottom: 7, letterSpacing: 1, textTransform: 'uppercase' },
  cardFooter: { paddingHorizontal: 24, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0d0d0d' },
  cardFooterText: { fontSize: 11, color: 'rgba(255,255,255,0.22)' },
  cardFooterBadge: { backgroundColor: '#16a34a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  cardFooterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  cardActions: { flexDirection: 'row', gap: 12, marginTop: 20, width: '100%' },
  cardLogBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#059669', borderRadius: 14, paddingVertical: 14 },
  cardLogBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cardDoneBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingVertical: 14 },
  cardDoneBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cardSafetyRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 18 },
  cardSafetyTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  cardSafetyDot: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
});

export default MakeRecipePage;
