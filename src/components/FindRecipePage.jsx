import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';

const FindRecipePage = ({ show, onClose, savedRecipes, onSaveMeal, onSayMeal, onWriteMeal }) => {
  const [recipeSearchInput, setRecipeSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [calMin, setCalMin] = useState(0);
  const [calMax, setCalMax] = useState(4000);
  const [selectedMealType, setSelectedMealType] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [countrySearch, setCountrySearch] = useState('');
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [mealMode, setMealMode] = useState(null); // 'cooked' or 'raw'
  const [servings, setServings] = useState({});
  const [editingCalIdx, setEditingCalIdx] = useState(null);
  const [editCalValue, setEditCalValue] = useState('');


  const hasActiveFilters = calMin > 0 || calMax < 4000 || selectedMealType !== null || selectedCountry !== null;

  const mealCategories = {
    'Soups': ['Egusi Soup', 'Pepper Soup', 'Groundnut Soup', 'Ogbono Soup', 'Banga Soup'],
    'Stews': ['Chicken Stew', 'Beef Stew', 'Fish Stew', 'Ofada Stew'],
    'Swallows': ['Pounded Yam', 'Eba (Garri)', 'Amala', 'Fufu', 'Semovita'],
    'Fried': ['Fried Plantain (Dodo)', 'Akara', 'Puff Puff', 'Fried Rice', 'Kelewele'],
    'Grilled': ['Suya', 'Grilled Tilapia', 'Grilled Chicken', 'Asun (Grilled Goat)'],
    'Snacks': ['Chin Chin', 'Meat Pie', 'Moi Moi', 'Boli & Groundnut', 'Kilishi'],
  };

  const allMeals = [
    { name: 'Jollof Rice & Grilled Chicken', category: 'Fried', country: 'Nigeria', image: { uri: 'https://www.foodfusion.com/wp-content/uploads/2025/07/Nigerian-Jollof-Rice-with-Grilled-Chicken-5.jpg' } },
    { name: 'Egusi Soup & Pounded Yam', category: 'Soups', country: 'Nigeria', image: { uri: 'https://nutriscan.app/calories-nutrition/images/egusi-soup-fe0df.webp' } },
    { name: 'Suya Spiced Grilled Fish', category: 'Grilled', country: 'Nigeria', image: { uri: 'https://cheflolaskitchen.com/wp-content/uploads/2023/01/nigerian-suya-34-1024x717.jpg.webp' } },
    { name: 'Injera with Misir Wot', category: 'Stews', country: 'Ethiopia', image: { uri: 'https://assets.nourishingmeals.com/sites/default/files/styles/fullscreen_banner/public/media/ETHIOPIOAN%20RED%20LENTIL%20STEW%20-%20MISIR%20WAT-1.jpg?h=5554a5ef' } },
    { name: 'Waakye with Shito', category: 'Fried', country: 'Ghana', image: { uri: 'https://img-global.cpcdn.com/steps/3da1defa2c4ac461/400x400cq80/photo.jpg' } },
    { name: 'Pepper Soup with Catfish', category: 'Soups', country: 'Nigeria', image: { uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJJ88UrNyOBTZ53Npuzs-hIBQtKxXCcAw9mQ&s' } },
    { name: 'Plantain & Egg Sauce', category: 'Fried', country: 'Nigeria', image: { uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRFC5A5GVaaXRxZNY5M89-DEsTGXC5IjHK1wQ&s' } },
    { name: 'Okra Soup & Fufu', category: 'Soups', country: 'Nigeria', image: { uri: 'https://i.ytimg.com/vi/bV2sg6mmSH8/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDvW2kzS1kNR0zdRUZaHFvvl8gb6Q' } },
    { name: 'Eba & Ogbono Soup', category: 'Swallows', country: 'Nigeria', image: { uri: 'https://dearanns.com/wp-content/uploads/2024/02/Nigerian-Eba.jpg' } },
    { name: 'Chicken Stew & Rice', category: 'Stews', country: 'Nigeria', image: { uri: 'https://www.mydiasporakitchen.com/wp-content/uploads/2025/05/Nigerian-chicken-stew-recipe-0.jpeg' } },
    { name: 'Akara & Pap', category: 'Snacks', country: 'Nigeria', image: { uri: 'https://kikifoodies.com/wp-content/uploads/2024/11/E685E539-B688-4131-BFFE-2288C9899A61-scaled.jpeg' } },
    { name: 'Moi Moi', category: 'Snacks', country: 'Nigeria', image: { uri: 'https://estherafricanfoods.com/wp-content/uploads/2023/02/Healthy-foods-1080x675.webp' } },
    { name: 'Kelewele', category: 'Fried', country: 'Ghana', image: { uri: 'https://demandafrica.com/wp-content/uploads/2017/05/Kelewele-Ghana-Spicy-Fried-Plantains.jpg' } },
    { name: 'Grilled Tilapia & Banku', category: 'Grilled', country: 'Ghana', image: { uri: 'https://www.finedininglovers.com/sites/default/files/styles/1_1_768x768/public/recipe_content_images/Whole%20Baked%20Tilapia_Photo%20by%20Nassima%20Rothaker%20%281%29.jpg.webp?itok=ZFsudwz6' } },
    { name: 'Amala & Ewedu', category: 'Swallows', country: 'Nigeria', image: { uri: 'https://nutriscan.app/calories-nutrition/images/egusi-soup-fe0df.webp' } },
    { name: 'Groundnut Soup', category: 'Soups', country: 'Ghana', image: { uri: 'https://www.seriouseats.com/thmb/RlxyVRR_JeCXwqZh7J3-RrntUB0=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/__opt__aboutcom__coeus__resources__content_migration__serious_eats__seriouseats.com__recipes__images__2017__06__20170511-groundnut-soup-vicky-wasik-2-2-e832005ef69c473f8f45a0a2a91f7775.jpg' } },
    { name: 'Fried Rice & Chicken', category: 'Fried', country: 'Nigeria', image: { uri: 'https://www.foodfusion.com/wp-content/uploads/2025/07/Nigerian-Jollof-Rice-with-Grilled-Chicken-5.jpg' } },
    { name: 'Boli & Groundnut', category: 'Snacks', country: 'Nigeria', image: { uri: 'https://demandafrica.com/wp-content/uploads/2017/05/Kelewele-Ghana-Spicy-Fried-Plantains.jpg' } },
    { name: 'Asun (Spicy Goat)', category: 'Grilled', country: 'Nigeria', image: { uri: 'https://cheflolaskitchen.com/wp-content/uploads/2023/01/nigerian-suya-34-1024x717.jpg.webp' } },
    { name: 'Semovita & Banga Soup', category: 'Swallows', country: 'Nigeria', image: { uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJJ88UrNyOBTZ53Npuzs-hIBQtKxXCcAw9mQ&s' } },
  ];

  const searchResults = recipeSearchInput.trim()
    ? allMeals.filter(m => m.name.toLowerCase().includes(recipeSearchInput.toLowerCase()))
    : [];

  const [recentlyLogged, setRecentlyLogged] = useState([
    'Jollof Rice & Grilled Chicken',
    'Egusi Soup & Pounded Yam',
    'Plantain & Egg Sauce',
  ]);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedCountryFilter, setSelectedCountryFilter] = useState(null);
  const [showAllCountries, setShowAllCountries] = useState(false);

  const allAfricanCountries = [
    { flag: '🇳🇬', name: 'Nigeria' }, { flag: '🇬🇭', name: 'Ghana' }, { flag: '🇿🇦', name: 'South Africa' },
    { flag: '🇪🇹', name: 'Ethiopia' }, { flag: '🇰🇪', name: 'Kenya' }, { flag: '🇨🇲', name: 'Cameroon' },
    { flag: '🇸🇳', name: 'Senegal' }, { flag: '🇹🇿', name: 'Tanzania' }, { flag: '🇺🇬', name: 'Uganda' },
    { flag: '🇲🇦', name: 'Morocco' }, { flag: '🇪🇬', name: 'Egypt' }, { flag: '🇨🇩', name: 'Congo' },
    { flag: '🇷🇼', name: 'Rwanda' }, { flag: '🇲🇿', name: 'Mozambique' }, { flag: '🇨🇮', name: 'Ivory Coast' },
    { flag: '🇱🇷', name: 'Liberia' }, { flag: '🇧🇯', name: 'Benin' }, { flag: '🇹🇬', name: 'Togo' },
    { flag: '🇲🇱', name: 'Mali' }, { flag: '🇧🇫', name: 'Burkina Faso' }, { flag: '🇳🇪', name: 'Niger' },
    { flag: '🇹🇩', name: 'Chad' }, { flag: '🇬🇳', name: 'Guinea' }, { flag: '🇸🇱', name: 'Sierra Leone' },
    { flag: '🇬🇲', name: 'Gambia' }, { flag: '🇬🇦', name: 'Gabon' }, { flag: '🇲🇼', name: 'Malawi' },
    { flag: '🇿🇲', name: 'Zambia' }, { flag: '🇿🇼', name: 'Zimbabwe' }, { flag: '🇧🇼', name: 'Botswana' },
    { flag: '🇳🇦', name: 'Namibia' }, { flag: '🇲🇬', name: 'Madagascar' }, { flag: '🇸🇩', name: 'Sudan' },
    { flag: '🇱🇾', name: 'Libya' }, { flag: '🇹🇳', name: 'Tunisia' }, { flag: '🇩🇿', name: 'Algeria' },
    { flag: '🇦🇴', name: 'Angola' }, { flag: '🇸🇴', name: 'Somalia' }, { flag: '🇪🇷', name: 'Eritrea' },
    { flag: '🇩🇯', name: 'Djibouti' }, { flag: '🇲🇺', name: 'Mauritius' }, { flag: '🇨🇻', name: 'Cape Verde' },
    { flag: '🇬🇶', name: 'Equatorial Guinea' }, { flag: '🇸🇿', name: 'Eswatini' }, { flag: '🇱🇸', name: 'Lesotho' },
    { flag: '🇧🇮', name: 'Burundi' }, { flag: '🇨🇫', name: 'Central African Republic' }, { flag: '🇸🇨', name: 'Seychelles' },
    { flag: '🇸🇹', name: 'São Tomé' }, { flag: '🇰🇲', name: 'Comoros' }, { flag: '🇲🇷', name: 'Mauritania' },
    { flag: '🇬🇼', name: 'Guinea-Bissau' }, { flag: '🇸🇸', name: 'South Sudan' },
  ];

  const getMealsForCountry = (countryName) => {
    return allMeals.filter(m => m.country === countryName);
  };

  const logMealAndTrack = (mealName) => {
    setRecentlyLogged(prev => {
      const filtered = prev.filter(m => m !== mealName);
      return [mealName, ...filtered].slice(0, 5);
    });
    setSelectedMeal(null);
  };

  const getMealsForCategory = (catName) => {
    return allMeals.filter(m => m.category === catName);
  };

  const mealData = {
    'Jollof Rice & Grilled Chicken': {
      image: { uri: 'https://www.foodfusion.com/wp-content/uploads/2025/07/Nigerian-Jollof-Rice-with-Grilled-Chicken-5.jpg' },
      cooked: [
        { name: 'Jollof Rice', sizes: { Small: 180, Medium: 320, Large: 480 }, defaultSize: 'Medium', protein: 5, carbs: 45, fat: 8 },
        { name: 'Grilled Chicken', sizes: { Small: 120, Medium: 200, Large: 300 }, defaultSize: 'Medium', protein: 30, carbs: 0, fat: 6 },
      ],
      raw: [
        { name: 'Rice (uncooked)', unit: 'tbsp', defaultQty: 6, calPerUnit: 15, protein: 0.4, carbs: 3.3, fat: 0.03 },
        { name: 'Tomato Stew', unit: 'tbsp', defaultQty: 3, calPerUnit: 12, protein: 0.3, carbs: 2.5, fat: 0.2 },
        { name: 'Chicken Breast', unit: 'piece', defaultQty: 1, calPerUnit: 165, protein: 31, carbs: 0, fat: 3.6 },
        { name: 'Vegetable Oil', unit: 'tbsp', defaultQty: 2, calPerUnit: 120, protein: 0, carbs: 0, fat: 14 },
        { name: 'Onions', unit: 'tbsp', defaultQty: 2, calPerUnit: 4, protein: 0.1, carbs: 0.9, fat: 0 },
        { name: 'Scotch Bonnet', unit: 'piece', defaultQty: 1, calPerUnit: 18, protein: 0.8, carbs: 3.7, fat: 0.2 },
      ],
    },
    'Egusi Soup & Pounded Yam': {
      image: { uri: 'https://nutriscan.app/calories-nutrition/images/egusi-soup-fe0df.webp' },
      cooked: [
        { name: 'Pounded Yam', sizes: { Small: 200, Medium: 350, Large: 500 }, defaultSize: 'Medium', protein: 3, carbs: 55, fat: 0.5 },
        { name: 'Egusi Soup', sizes: { Small: 150, Medium: 280, Large: 400 }, defaultSize: 'Medium', protein: 12, carbs: 5, fat: 18 },
      ],
      raw: [
        { name: 'Yam (pounded)', unit: 'tbsp', defaultQty: 8, calPerUnit: 20, protein: 0.3, carbs: 4.8, fat: 0.02 },
        { name: 'Egusi (melon seeds)', unit: 'tbsp', defaultQty: 4, calPerUnit: 35, protein: 1.8, carbs: 0.5, fat: 3 },
        { name: 'Spinach/Ugwu', unit: 'tbsp', defaultQty: 3, calPerUnit: 2, protein: 0.3, carbs: 0.3, fat: 0 },
        { name: 'Palm Oil', unit: 'tbsp', defaultQty: 2, calPerUnit: 120, protein: 0, carbs: 0, fat: 14 },
        { name: 'Stockfish', unit: 'piece', defaultQty: 1, calPerUnit: 80, protein: 17, carbs: 0, fat: 0.8 },
        { name: 'Crayfish', unit: 'tbsp', defaultQty: 1, calPerUnit: 25, protein: 5, carbs: 0, fat: 0.3 },
      ],
    },
    'Suya Spiced Grilled Fish': {
      image: { uri: 'https://cheflolaskitchen.com/wp-content/uploads/2023/01/nigerian-suya-34-1024x717.jpg.webp' },
      cooked: [
        { name: 'Grilled Fish', sizes: { Small: 100, Medium: 180, Large: 260 }, defaultSize: 'Medium', protein: 26, carbs: 0, fat: 4 },
        { name: 'Suya Spice Mix', sizes: { Light: 30, Medium: 50, Heavy: 75 }, defaultSize: 'Medium', protein: 1.5, carbs: 2, fat: 2.5 },
      ],
      raw: [
        { name: 'Tilapia Fish', unit: 'piece', defaultQty: 1, calPerUnit: 130, protein: 26, carbs: 0, fat: 2.7 },
        { name: 'Suya Spice (Yaji)', unit: 'tbsp', defaultQty: 2, calPerUnit: 30, protein: 1.5, carbs: 2, fat: 2 },
        { name: 'Groundnut Oil', unit: 'tbsp', defaultQty: 1, calPerUnit: 120, protein: 0, carbs: 0, fat: 14 },
        { name: 'Onions (sliced)', unit: 'tbsp', defaultQty: 2, calPerUnit: 4, protein: 0.1, carbs: 0.9, fat: 0 },
      ],
    },
    'Injera with Misir Wot': {
      image: { uri: 'https://assets.nourishingmeals.com/sites/default/files/styles/fullscreen_banner/public/media/ETHIOPIOAN%20RED%20LENTIL%20STEW%20-%20MISIR%20WAT-1.jpg?h=5554a5ef' },
      cooked: [
        { name: 'Injera', sizes: { '1 piece': 70, '2 pieces': 140, '3 pieces': 210 }, defaultSize: '2 pieces', protein: 5, carbs: 28, fat: 1 },
        { name: 'Misir Wot', sizes: { Small: 120, Medium: 220, Large: 330 }, defaultSize: 'Medium', protein: 10, carbs: 18, fat: 5 },
      ],
      raw: [
        { name: 'Injera', unit: 'piece', defaultQty: 2, calPerUnit: 70, protein: 2.5, carbs: 14, fat: 0.5 },
        { name: 'Red Lentils', unit: 'tbsp', defaultQty: 5, calPerUnit: 22, protein: 1.5, carbs: 3.2, fat: 0.1 },
        { name: 'Berbere Spice', unit: 'tbsp', defaultQty: 1, calPerUnit: 16, protein: 0.8, carbs: 3, fat: 0.5 },
        { name: 'Onions', unit: 'tbsp', defaultQty: 3, calPerUnit: 4, protein: 0.1, carbs: 0.9, fat: 0 },
        { name: 'Niter Kibbeh', unit: 'tbsp', defaultQty: 1, calPerUnit: 100, protein: 0, carbs: 0, fat: 11 },
      ],
    },
    'Waakye with Shito': {
      image: { uri: 'https://img-global.cpcdn.com/steps/3da1defa2c4ac461/400x400cq80/photo.jpg' },
      cooked: [
        { name: 'Waakye', sizes: { Small: 200, Medium: 350, Large: 500 }, defaultSize: 'Medium', protein: 8, carbs: 50, fat: 2 },
        { name: 'Shito Sauce', sizes: { Light: 40, Medium: 80, Heavy: 120 }, defaultSize: 'Medium', protein: 0.5, carbs: 2, fat: 6 },
        { name: 'Fried Plantain', sizes: { '2 slices': 70, '4 slices': 140, '6 slices': 210 }, defaultSize: '4 slices', protein: 0.5, carbs: 10, fat: 3.5 },
      ],
      raw: [
        { name: 'Rice & Beans', unit: 'tbsp', defaultQty: 8, calPerUnit: 18, protein: 0.6, carbs: 3.5, fat: 0.1 },
        { name: 'Shito Sauce', unit: 'tbsp', defaultQty: 2, calPerUnit: 45, protein: 0.5, carbs: 1.5, fat: 4 },
        { name: 'Spaghetti', unit: 'tbsp', defaultQty: 3, calPerUnit: 20, protein: 0.7, carbs: 4, fat: 0.1 },
        { name: 'Fried Plantain', unit: 'slice', defaultQty: 4, calPerUnit: 35, protein: 0.2, carbs: 5, fat: 1.8 },
        { name: 'Boiled Egg', unit: 'piece', defaultQty: 1, calPerUnit: 78, protein: 6, carbs: 0.6, fat: 5.3 },
      ],
    },
    'Pepper Soup with Catfish': {
      image: { uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJJ88UrNyOBTZ53Npuzs-hIBQtKxXCcAw9mQ&s' },
      cooked: [
        { name: 'Pepper Soup Broth', sizes: { Small: 60, Medium: 100, Large: 150 }, defaultSize: 'Medium', protein: 2, carbs: 4, fat: 1 },
        { name: 'Catfish', sizes: { Small: 100, Medium: 180, Large: 260 }, defaultSize: 'Medium', protein: 26, carbs: 0, fat: 5 },
      ],
      raw: [
        { name: 'Catfish', unit: 'piece', defaultQty: 1, calPerUnit: 150, protein: 26, carbs: 0, fat: 5 },
        { name: 'Pepper Soup Spice', unit: 'tbsp', defaultQty: 2, calPerUnit: 10, protein: 0.3, carbs: 2, fat: 0.3 },
        { name: 'Scotch Bonnet', unit: 'piece', defaultQty: 1, calPerUnit: 18, protein: 0.8, carbs: 3.7, fat: 0.2 },
        { name: 'Onions', unit: 'tbsp', defaultQty: 2, calPerUnit: 4, protein: 0.1, carbs: 0.9, fat: 0 },
      ],
    },
    'Plantain & Egg Sauce': {
      image: { uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRFC5A5GVaaXRxZNY5M89-DEsTGXC5IjHK1wQ&s' },
      cooked: [
        { name: 'Fried Plantain', sizes: { '3 slices': 105, '5 slices': 175, '8 slices': 280 }, defaultSize: '5 slices', protein: 1, carbs: 25, fat: 9 },
        { name: 'Egg Sauce', sizes: { Small: 130, Medium: 220, Large: 310 }, defaultSize: 'Medium', protein: 12, carbs: 3, fat: 14 },
      ],
      raw: [
        { name: 'Plantain (fried)', unit: 'slice', defaultQty: 6, calPerUnit: 35, protein: 0.2, carbs: 5, fat: 1.8 },
        { name: 'Eggs', unit: 'piece', defaultQty: 2, calPerUnit: 78, protein: 6, carbs: 0.6, fat: 5.3 },
        { name: 'Tomatoes', unit: 'tbsp', defaultQty: 2, calPerUnit: 4, protein: 0.2, carbs: 0.8, fat: 0 },
        { name: 'Onions', unit: 'tbsp', defaultQty: 1, calPerUnit: 4, protein: 0.1, carbs: 0.9, fat: 0 },
        { name: 'Vegetable Oil', unit: 'tbsp', defaultQty: 2, calPerUnit: 120, protein: 0, carbs: 0, fat: 14 },
      ],
    },
    'Okra Soup & Fufu': {
      image: { uri: 'https://i.ytimg.com/vi/bV2sg6mmSH8/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDvW2kzS1kNR0zdRUZaHFvvl8gb6Q' },
      cooked: [
        { name: 'Fufu', sizes: { Small: 180, Medium: 300, Large: 450 }, defaultSize: 'Medium', protein: 2, carbs: 45, fat: 0.5 },
        { name: 'Okra Soup', sizes: { Small: 130, Medium: 250, Large: 380 }, defaultSize: 'Medium', protein: 15, carbs: 4, fat: 16 },
      ],
      raw: [
        { name: 'Fufu', unit: 'tbsp', defaultQty: 8, calPerUnit: 18, protein: 0.2, carbs: 4.5, fat: 0.02 },
        { name: 'Okra (chopped)', unit: 'tbsp', defaultQty: 4, calPerUnit: 3, protein: 0.2, carbs: 0.6, fat: 0 },
        { name: 'Palm Oil', unit: 'tbsp', defaultQty: 2, calPerUnit: 120, protein: 0, carbs: 0, fat: 14 },
        { name: 'Beef/Goat Meat', unit: 'piece', defaultQty: 2, calPerUnit: 75, protein: 12, carbs: 0, fat: 3 },
        { name: 'Crayfish', unit: 'tbsp', defaultQty: 1, calPerUnit: 25, protein: 5, carbs: 0, fat: 0.3 },
      ],
    },
  };

  const openMealDetail = (mealName) => {
    const data = mealData[mealName];
    if (!data) return;
    setMealMode(null);
    setServings({});
    setEditingCalIdx(null);
    setSelectedMeal(mealName);
  };

  const initMode = (mode) => {
    const data = mealData[selectedMeal];
    const items = mode === 'cooked' ? data.cooked : data.raw;
    const initial = {};
    items.forEach((item, i) => {
      if (mode === 'cooked') {
        initial[i] = { size: item.defaultSize, cal: item.sizes[item.defaultSize] };
      } else {
        initial[i] = { qty: item.defaultQty, cal: item.calPerUnit };
      }
    });
    setServings(initial);
    setMealMode(mode);
  };

  const getMealTotals = () => {
    if (!selectedMeal || !mealMode || !mealData[selectedMeal]) return { cal: 0, protein: 0, carbs: 0, fat: 0 };
    const data = mealData[selectedMeal];
    const items = mealMode === 'cooked' ? data.cooked : data.raw;
    let cal = 0, protein = 0, carbs = 0, fat = 0;
    items.forEach((item, i) => {
      const s = servings[i];
      if (!s) return;
      if (mealMode === 'cooked') {
        cal += s.cal;
        protein += item.protein;
        carbs += item.carbs;
        fat += item.fat;
      } else {
        cal += s.qty * s.cal;
        protein += s.qty * item.protein;
        carbs += s.qty * item.carbs;
        fat += s.qty * item.fat;
      }
    });
    return { cal: Math.round(cal), protein: protein.toFixed(1), carbs: carbs.toFixed(1), fat: fat.toFixed(1) };
  };

  const countries = [
    '🇳🇬 Nigeria', '🇬🇭 Ghana', '🇪🇹 Ethiopia', '🇰🇪 Kenya',
    '🇿🇦 South Africa', '🇸🇳 Senegal', '🇨🇲 Cameroon', '🇹🇿 Tanzania',
    '🇺🇬 Uganda', '🇲🇦 Morocco', '🇪🇬 Egypt', '🇨🇩 Congo',
    '🇷🇼 Rwanda', '🇲🇿 Mozambique', '🇨🇮 Ivory Coast',
  ];
  const filteredCountries = countries.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  if (!show) return null;

  return (
    <View style={styles.recipePageOverlay}>
      <View style={styles.recipePage}>
        {/* Header */}
        <View style={styles.recipePageHeader}>
          <TouchableOpacity style={styles.recipeBackBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color="#059669" />
          </TouchableOpacity>
          <Text style={styles.recipePageTitle}>Find Your Meal</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.recipePageContent}>
          {/* Search Bar + Country Filter */}
          <View style={styles.searchRow}>
            <View style={styles.recipeSearchBarContainer}>
              <TextInput
                style={styles.recipeSearchInputNew}
                placeholder="Find your meal..."
                value={recipeSearchInput}
                onChangeText={setRecipeSearchInput}
              />
            </View>
            <TouchableOpacity
              style={[styles.filterBtn, selectedCountryFilter && styles.filterBtnActive]}
              onPress={() => setShowAllCountries(true)}
            >
              <Text style={selectedCountryFilter ? { fontSize: 18, color: '#fff' } : { fontSize: 18 }}>🌍</Text>
            </TouchableOpacity>
          </View>
          {selectedCountryFilter && (
            <TouchableOpacity style={styles.activeFilterChip} onPress={() => setSelectedCountryFilter(null)}>
              <Text style={styles.activeFilterChipText}>{allAfricanCountries.find(c => c.name === selectedCountryFilter)?.flag} {selectedCountryFilter}  ✕</Text>
            </TouchableOpacity>
          )}

          {/* All Countries Modal */}
          <Modal
            visible={showAllCountries}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowAllCountries(false)}
          >
            <SafeAreaView style={styles.mealDetailModal}>
              <View style={styles.mealDetailHeader}>
                <TouchableOpacity onPress={() => setShowAllCountries(false)}>
                  <Text style={{ fontSize: 20, color: '#1F1F1F' }}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.mealDetailHeaderTitle}>Select Country</Text>
                <View style={{ width: 20 }} />
              </View>
              <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                <View style={styles.allCountriesGrid}>
                  {allAfricanCountries.map((c, i) => (
                    <TouchableOpacity key={i} style={[styles.allCountriesItem, selectedCountryFilter === c.name && { backgroundColor: '#059669' }]} onPress={() => { setSelectedCountryFilter(c.name); setShowAllCountries(false); }}>
                      <Text style={styles.countryFlag}>{c.flag}</Text>
                      <Text style={[styles.allCountriesName, selectedCountryFilter === c.name && { color: '#fff' }]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ height: 40 }} />
              </ScrollView>
            </SafeAreaView>
          </Modal>

          {/* Filter Modal */}
          <Modal
            visible={showFilters}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowFilters(false)}
          >
            <SafeAreaView style={styles.filterModal}>
              <View style={styles.filterModalHeader}>
                <TouchableOpacity onPress={() => setShowFilters(false)}>
                  <Text style={{ fontSize: 20, color: '#1F1F1F' }}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.filterModalTitle}>Filters</Text>
                <TouchableOpacity onPress={() => { setCalMin(0); setCalMax(4000); setSelectedMealType(null); setSelectedCountry(null); }}>
                  <Text style={styles.filterResetText}>Reset</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.filterModalContent} showsVerticalScrollIndicator={false}>
                {/* Calorie Range */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Calories</Text>
                  <Text style={styles.filterRangeText}>{calMin} - {calMax} cal</Text>
                  <View style={styles.sliderRow}>
                    <Text style={styles.sliderLabel}>Min</Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={4000}
                      step={50}
                      value={calMin}
                      onValueChange={(val) => { if (val <= calMax) setCalMin(val); }}
                      minimumTrackTintColor="#059669"
                      maximumTrackTintColor="#E5E7EB"
                      thumbTintColor="#059669"
                    />
                  </View>
                  <View style={styles.sliderRow}>
                    <Text style={styles.sliderLabel}>Max</Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={0}
                      maximumValue={4000}
                      step={50}
                      value={calMax}
                      onValueChange={(val) => { if (val >= calMin) setCalMax(val); }}
                      minimumTrackTintColor="#059669"
                      maximumTrackTintColor="#E5E7EB"
                      thumbTintColor="#059669"
                    />
                  </View>
                </View>

                {/* Meal Type */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Meal Type</Text>
                  {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((meal) => (
                    <TouchableOpacity
                      key={meal}
                      style={styles.filterOptionRow}
                      onPress={() => setSelectedMealType(selectedMealType === meal ? null : meal)}
                    >
                      <Text style={styles.filterOptionText}>{meal}</Text>
                      <View style={[styles.filterRadio, selectedMealType === meal && styles.filterRadioActive]}>
                        {selectedMealType === meal && <View style={styles.filterRadioDot} />}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Country */}
                <View style={styles.filterSection}>
                  <Text style={styles.filterSectionTitle}>Country</Text>
                  <View style={styles.countrySearchBar}>
                    <Text style={{ fontSize: 14 }}>🔍</Text>
                    <TextInput
                      style={styles.countrySearchInput}
                      placeholder="Search country..."
                      value={countrySearch}
                      onChangeText={setCountrySearch}
                    />
                  </View>
                  {filteredCountries.map((country) => (
                    <TouchableOpacity
                      key={country}
                      style={styles.filterOptionRow}
                      onPress={() => setSelectedCountry(selectedCountry === country ? null : country)}
                    >
                      <Text style={styles.filterOptionText}>{country}</Text>
                      <View style={[styles.filterRadio, selectedCountry === country && styles.filterRadioActive]}>
                        {selectedCountry === country && <View style={styles.filterRadioDot} />}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>

              <TouchableOpacity style={styles.applyFiltersBtn} onPress={() => setShowFilters(false)}>
                <Text style={styles.applyFiltersBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </Modal>

          {/* Search Results */}
          {recipeSearchInput.trim().length > 0 && (
            <View style={styles.recipeSection}>
              <Text style={styles.recipeSectionTitle}>Search Results</Text>
              {searchResults.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {searchResults.map((item, i) => (
                    <TouchableOpacity key={i} style={styles.trendingCard} onPress={() => openMealDetail(item.name)}>
                      <Image source={item.image} style={styles.trendingCardImage} resizeMode="cover" />
                      <Text style={styles.trendingCardTitle}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={{ color: '#888', fontSize: 14 }}>No meals found for "{recipeSearchInput}"</Text>
              )}
            </View>
          )}

          {/* Recently Logged */}
          {recentlyLogged.length > 0 && !recipeSearchInput.trim() && (
            <View style={styles.recipeSection}>
              <Text style={styles.recipeSectionTitle}>Recently Logged</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {recentlyLogged.map((mealName, i) => {
                  const meal = allMeals.find(m => m.name === mealName);
                  if (!meal) return null;
                  return (
                    <TouchableOpacity key={i} style={styles.trendingCard} onPress={() => openMealDetail(meal.name)}>
                      <Image source={meal.image} style={styles.trendingCardImage} resizeMode="cover" />
                      <Text style={styles.trendingCardTitle}>{meal.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Category Page */}
          {selectedCategory && !recipeSearchInput.trim() && (
            <View style={styles.recipeSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.recipeSectionTitle}>{selectedCategory}</Text>
                <TouchableOpacity onPress={() => setSelectedCategory(null)}>
                  <Text style={{ color: '#059669', fontWeight: '600', fontSize: 14 }}>Clear</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {getMealsForCategory(selectedCategory).map((item, i) => (
                  <TouchableOpacity key={i} style={styles.trendingCard} onPress={() => openMealDetail(item.name)}>
                    <Image source={item.image} style={styles.trendingCardImage} resizeMode="cover" />
                    <Text style={styles.trendingCardTitle}>{item.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Trending Recipes */}
          <View style={styles.recipeSection}>
            <Text style={styles.recipeSectionTitle}>🔥 Trending Now</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                { name: 'Jollof Rice & Grilled Chicken', time: '45 min', image: { uri: 'https://www.foodfusion.com/wp-content/uploads/2025/07/Nigerian-Jollof-Rice-with-Grilled-Chicken-5.jpg' } },
                { name: 'Egusi Soup & Pounded Yam', time: '50 min', image: { uri: 'https://nutriscan.app/calories-nutrition/images/egusi-soup-fe0df.webp' } },
                { name: 'Suya Spiced Grilled Fish', time: '30 min', image: { uri: 'https://cheflolaskitchen.com/wp-content/uploads/2023/01/nigerian-suya-34-1024x717.jpg.webp' } },
                { name: 'Injera with Misir Wot', time: '40 min', image: { uri: 'https://assets.nourishingmeals.com/sites/default/files/styles/fullscreen_banner/public/media/ETHIOPIOAN%20RED%20LENTIL%20STEW%20-%20MISIR%20WAT-1.jpg?h=5554a5ef' } },
                { name: 'Waakye with Shito', time: '35 min', image: { uri: 'https://img-global.cpcdn.com/steps/3da1defa2c4ac461/400x400cq80/photo.jpg' } },
              ].map((item, i) => (
                <TouchableOpacity key={i} style={styles.trendingCard} onPress={() => openMealDetail(item.name)}>
                  <Image source={item.image} style={styles.trendingCardImage} resizeMode="cover" />
                  <Text style={styles.trendingCardTitle}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* This Week's Picks */}
          <View style={styles.recipeSection}>
            <Text style={styles.recipeSectionTitle}>⭐ This Week's Picks</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                { name: 'Pepper Soup with Catfish', time: '35 min', image: { uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJJ88UrNyOBTZ53Npuzs-hIBQtKxXCcAw9mQ&s' } },
                { name: 'Plantain & Egg Sauce', time: '15 min', image: { uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRFC5A5GVaaXRxZNY5M89-DEsTGXC5IjHK1wQ&s' } },
                { name: 'Okra Soup & Fufu', time: '40 min', image: { uri: 'https://i.ytimg.com/vi/bV2sg6mmSH8/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDvW2kzS1kNR0zdRUZaHFvvl8gb6Q' } },
              ].map((item, i) => (
                <TouchableOpacity key={i} style={styles.trendingCard} onPress={() => openMealDetail(item.name)}>
                  <Image source={item.image} style={styles.trendingCardImage} resizeMode="cover" />
                  <Text style={styles.trendingCardTitle}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Popular Categories */}
          <View style={styles.recipeSection}>
            <Text style={styles.recipeSectionTitle}>Popular Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[
                { name: 'Soups', image: { uri: 'https://www.seriouseats.com/thmb/RlxyVRR_JeCXwqZh7J3-RrntUB0=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/__opt__aboutcom__coeus__resources__content_migration__serious_eats__seriouseats.com__recipes__images__2017__06__20170511-groundnut-soup-vicky-wasik-2-2-e832005ef69c473f8f45a0a2a91f7775.jpg' } },
                { name: 'Stews', image: { uri: 'https://www.mydiasporakitchen.com/wp-content/uploads/2025/05/Nigerian-chicken-stew-recipe-0.jpeg' } },
                { name: 'Swallows', image: { uri: 'https://dearanns.com/wp-content/uploads/2024/02/Nigerian-Eba.jpg' } },
                { name: 'Fried', image: { uri: 'https://demandafrica.com/wp-content/uploads/2017/05/Kelewele-Ghana-Spicy-Fried-Plantains.jpg' } },
                { name: 'Grilled', image: { uri: 'https://www.finedininglovers.com/sites/default/files/styles/1_1_768x768/public/recipe_content_images/Whole%20Baked%20Tilapia_Photo%20by%20Nassima%20Rothaker%20%281%29.jpg.webp?itok=ZFsudwz6' } },
                { name: 'Snacks', image: { uri: 'https://kikifoodies.com/wp-content/uploads/2024/11/E685E539-B688-4131-BFFE-2288C9899A61-scaled.jpeg' } },
              ].map((cat, i) => (
                <TouchableOpacity key={i} style={styles.trendingCard} onPress={() => setSelectedCategory(cat.name)}>
                  <Image source={cat.image} style={styles.trendingCardImage} resizeMode="cover" />
                  <Text style={styles.trendingCardTitle}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Country Filter Results */}
          {selectedCountryFilter && (
            <View style={styles.recipeSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.recipeSectionTitle}>{selectedCountryFilter} Meals</Text>
                <TouchableOpacity onPress={() => setSelectedCountryFilter(null)}>
                  <Text style={{ color: '#059669', fontWeight: '600', fontSize: 14 }}>Clear</Text>
                </TouchableOpacity>
              </View>
              {getMealsForCountry(selectedCountryFilter).length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {getMealsForCountry(selectedCountryFilter).map((item, i) => (
                    <TouchableOpacity key={i} style={styles.trendingCard} onPress={() => openMealDetail(item.name)}>
                      <Image source={item.image} style={styles.trendingCardImage} resizeMode="cover" />
                      <Text style={styles.trendingCardTitle}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={{ color: '#888', fontSize: 14 }}>No meals yet for {selectedCountryFilter}. Coming soon!</Text>
              )}
            </View>
          )}

          <View style={styles.recipeSection}>
            <Text style={styles.recipeSectionTitle}>Saved Meals</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {savedRecipes.map((recipe) => (
                <TouchableOpacity key={recipe.id} style={styles.trendingCard} onPress={() => openMealDetail(recipe.name)}>
                  <Image source={typeof recipe.image === 'string' ? { uri: recipe.image } : recipe.image} style={styles.trendingCardImage} resizeMode="cover" />
                  <Text style={styles.trendingCardTitle}>{recipe.name}</Text>
                  <Text style={styles.savedCalText}>{recipe.calories} cal</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Didn't find your meal? */}
          <View style={styles.customMealSection}>
            <Text style={styles.customMealTitle}>Didn't find your meal?</Text>
            <Text style={styles.customMealDesc}>You can log it by telling us or typing it in</Text>
            <View style={styles.customMealActions}>
              <TouchableOpacity style={styles.customMealBtn} onPress={onSayMeal}>
                <Text style={styles.customMealBtnIcon}>🎤</Text>
                <Text style={styles.customMealBtnText}>Say it</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.customMealBtn} onPress={onWriteMeal}>
                <Text style={styles.customMealBtnIcon}>✍️</Text>
                <Text style={styles.customMealBtnText}>Write it</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>

      {/* Meal Detail Modal */}
      <Modal
        visible={selectedMeal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMeal(null)}
      >
        <SafeAreaView style={styles.mealDetailModal}>
          <View style={styles.mealDetailHeader}>
            <TouchableOpacity onPress={() => setSelectedMeal(null)}>
              <Text style={{ fontSize: 20, color: '#1F1F1F' }}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.mealDetailHeaderTitle}>Meal Details</Text>
            {mealMode ? (
              <TouchableOpacity onPress={() => {
                if (selectedMeal && mealData[selectedMeal]) {
                  const meal = allMeals.find(m => m.name === selectedMeal);
                  const t = getMealTotals();
                  onSaveMeal && onSaveMeal({
                    id: Date.now(),
                    name: selectedMeal,
                    calories: t.cal,
                    image: meal?.image || mealData[selectedMeal].image,
                  });
                }
              }}>
                <Text style={{ fontSize: 14, color: savedRecipes.find(r => r.name === selectedMeal) ? '#888' : '#059669', fontWeight: '600' }}>
                  {savedRecipes.find(r => r.name === selectedMeal) ? 'Saved' : 'Save'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 20 }} />
            )}
          </View>

          {selectedMeal && mealData[selectedMeal] && (
            <ScrollView style={styles.mealDetailContent} showsVerticalScrollIndicator={false}>
              <Image source={mealData[selectedMeal].image} style={styles.mealDetailImage} resizeMode="cover" />
              <Text style={styles.mealDetailTitle}>{selectedMeal}</Text>

              {/* Mode Selection */}
              {!mealMode && (
                <View>
                  <Text style={styles.ingredientsTitle}>How was this prepared?</Text>
                  <TouchableOpacity style={styles.modeBtn} onPress={() => initMode('cooked')}>
                    <Text style={styles.modeBtnEmoji}>🍽️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modeBtnTitle}>Already prepared</Text>
                      <Text style={styles.modeBtnDesc}>I bought it or someone made it for me</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modeBtn} onPress={() => initMode('raw')}>
                    <Text style={styles.modeBtnEmoji}>🥘</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modeBtnTitle}>I made it myself</Text>
                      <Text style={styles.modeBtnDesc}>I know the raw ingredients I used</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* Macro Summary - only show after mode selected */}
              {mealMode && (() => { const t = getMealTotals(); return (
                <View style={styles.macroSummary}>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{t.cal}</Text>
                    <Text style={styles.macroLabel}>cal</Text>
                  </View>
                  <View style={styles.macroDivider} />
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{t.protein}g</Text>
                    <Text style={styles.macroLabel}>protein</Text>
                  </View>
                  <View style={styles.macroDivider} />
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{t.carbs}g</Text>
                    <Text style={styles.macroLabel}>carbs</Text>
                  </View>
                  <View style={styles.macroDivider} />
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{t.fat}g</Text>
                    <Text style={styles.macroLabel}>fat</Text>
                  </View>
                </View>
              ); })()}

              {/* COOKED MODE - Size picker per component */}
              {mealMode === 'cooked' && (
                <View>
                  <Text style={styles.ingredientsTitle}>Select your portion sizes</Text>
                  {mealData[selectedMeal].cooked.map((item, i) => {
                    const s = servings[i];
                    if (!s) return null;
                    return (
                      <View key={i} style={styles.cookedItemCard}>
                        <View style={styles.cookedItemHeader}>
                          <Text style={styles.ingredientName}>{item.name}</Text>
                          {editingCalIdx === i ? (
                            <View style={styles.editCalRow}>
                              <TextInput
                                style={styles.editCalInput}
                                value={editCalValue}
                                onChangeText={setEditCalValue}
                                keyboardType="numeric"
                                autoFocus
                              />
                              <TouchableOpacity
                                style={styles.editCalSave}
                                onPress={() => {
                                  setServings(prev => ({ ...prev, [i]: { ...prev[i], cal: parseFloat(editCalValue) || prev[i].cal } }));
                                  setEditingCalIdx(null);
                                }}
                              >
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Save</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity onPress={() => { setEditingCalIdx(i); setEditCalValue(String(s.cal)); }}>
                              <Text style={styles.ingredientCalEditable}>{s.cal} cal ✎</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <View style={styles.sizeOptions}>
                          {Object.keys(item.sizes).map(size => (
                            <TouchableOpacity
                              key={size}
                              style={[styles.sizeBtn, s.size === size && styles.sizeBtnActive]}
                              onPress={() => setServings(prev => ({ ...prev, [i]: { size, cal: item.sizes[size] } }))}
                            >
                              <Text style={[styles.sizeBtnText, s.size === size && styles.sizeBtnTextActive]}>{size}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* RAW MODE - Ingredient quantities */}
              {mealMode === 'raw' && (
                <View>
                  <Text style={styles.ingredientsTitle}>Adjust your ingredients</Text>
                  {mealData[selectedMeal].raw.map((ing, i) => {
                    const s = servings[i];
                    if (!s) return null;
                    return (
                      <View key={i} style={styles.ingredientRow}>
                        <View style={styles.ingredientInfo}>
                          <Text style={styles.ingredientName}>{ing.name}</Text>
                          {editingCalIdx === i ? (
                            <View style={styles.editCalRow}>
                              <TextInput
                                style={styles.editCalInput}
                                value={editCalValue}
                                onChangeText={setEditCalValue}
                                keyboardType="numeric"
                                autoFocus
                              />
                              <Text style={styles.editCalLabel}>cal/{ing.unit}</Text>
                              <TouchableOpacity
                                style={styles.editCalSave}
                                onPress={() => {
                                  setServings(prev => ({ ...prev, [i]: { ...prev[i], cal: parseFloat(editCalValue) || prev[i].cal } }));
                                  setEditingCalIdx(null);
                                }}
                              >
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Save</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity onPress={() => { setEditingCalIdx(i); setEditCalValue(String(s.cal)); }}>
                              <Text style={styles.ingredientCalEditable}>{Math.round(s.qty * s.cal)} cal ✎</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <View style={styles.qtyControl}>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => setServings(prev => ({ ...prev, [i]: { ...prev[i], qty: Math.max(0, prev[i].qty - 1) } }))}
                          >
                            <Text style={styles.qtyBtnText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.qtyValue}>{s.qty} {ing.unit}</Text>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => setServings(prev => ({ ...prev, [i]: { ...prev[i], qty: prev[i].qty + 1 } }))}
                          >
                            <Text style={styles.qtyBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {mealMode && (
                <TouchableOpacity style={styles.switchModeBtn} onPress={() => setMealMode(null)}>
                  <Text style={styles.switchModeBtnText}>Switch to {mealMode === 'cooked' ? 'raw ingredients' : 'prepared portions'}</Text>
                </TouchableOpacity>
              )}

              <View style={{ height: 100 }} />
            </ScrollView>
          )}

          {mealMode && (
            <TouchableOpacity style={styles.logMealBtn} onPress={() => logMealAndTrack(selectedMeal)}>
              <Text style={styles.logMealBtnText}>Add to Meal Log</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  recipePageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FAFAFA',
    zIndex: 100,
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
    paddingBottom: 16,
    paddingTop: 8,
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recipeSearchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  searchIcon: {
    fontSize: 18,
  },
  recipeSearchInputNew: {
    flex: 1,
    fontSize: 14,
    backgroundColor: 'transparent',
    padding: 0,
  },
  cuisineFiltersSection: {
    marginBottom: 14,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(5, 150, 105, 0.1)',
  },
  filterBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterBtnIcon: {
    fontSize: 20,
    color: '#1F1F1F',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  filterModal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  filterResetText: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
  },
  filterModalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterSection: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 12,
  },
  filterRangeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 16,
    textAlign: 'center',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 13,
    color: '#888',
    width: 32,
    fontWeight: '600',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F8F8',
  },
  filterOptionText: {
    fontSize: 16,
    color: '#1F1F1F',
  },
  filterRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRadioActive: {
    borderColor: '#059669',
  },
  filterRadioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#059669',
  },
  countrySearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  countrySearchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
    color: '#1F1F1F',
  },
  applyFiltersBtn: {
    backgroundColor: '#059669',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  applyFiltersBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  cuisineFiltersScroll: {
    flexDirection: 'row',
  },
  cuisineFilter: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: 20,
    marginRight: 8,
  },
  cuisineFilterText: {
    fontSize: 12,
    color: '#666',
  },
  cuisineFilterActive: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#059669',
    borderRadius: 20,
    marginRight: 8,
  },
  cuisineFilterActiveText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
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
  trendingCard: {
    width: 180,
    marginRight: 12,
  },
  trendingCardImage: {
    width: 180,
    height: 140,
    borderRadius: 16,
    marginBottom: 10,
  },
  trendingCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F1F1F',
    lineHeight: 20,
    marginBottom: 4,
  },
  trendingCardTime: {
    fontSize: 12,
    color: '#999',
  },
  featuredCardsScroll: {
    flexDirection: 'row',
    marginTop: 12,
  },
  featuredCard: {
    width: 160,
    padding: 16,
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.1)',
    marginRight: 12,
  },
  featuredCardEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  featuredCardTag: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
    overflow: 'hidden',
  },
  featuredCardName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 8,
  },
  featuredCardMeta: {
    flexDirection: 'row',
    gap: 10,
  },
  featuredCardMetaText: {
    fontSize: 10,
    color: '#888',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  categoryItem: {
    width: '31%',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.08)',
    borderRadius: 14,
  },
  categoryEmoji: {
    fontSize: 28,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  categoryCount: {
    fontSize: 10,
    color: '#888',
  },
  savedRecipesList: {
    flexDirection: 'column',
    gap: 10,
  },
  savedRecipeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    backgroundColor: 'rgba(5, 150, 105, 0.04)',
    borderRadius: 12,
  },
  savedRecipeImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedRecipeImageText: {
    fontSize: 24,
  },
  savedRecipeInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  savedRecipeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  savedRecipeMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  savedRecipeTime: {
    fontSize: 11,
    color: '#888',
  },
  savedRecipeCalories: {
    fontSize: 11,
    color: '#888',
  },
  countryCard: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  countryFlag: {
    fontSize: 36,
    marginBottom: 6,
  },
  countryCardName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  countryCardActive: {
    backgroundColor: '#059669',
  },
  allCountriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  allCountriesItem: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  allCountriesName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F1F1F',
    marginTop: 4,
  },
  seeMoreCard: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  seeMoreArrow: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 4,
  },
  seeMoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  customMealSection: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  customMealTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 4,
  },
  customMealDesc: {
    fontSize: 13,
    color: '#888',
    marginBottom: 14,
  },
  customMealActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  customMealBtn: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#F5F3FF',
    minWidth: 120,
  },
  customMealBtnIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  customMealBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  activeFilterChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  activeFilterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  savedCalText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  mealDetailModal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mealDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  mealDetailHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  mealDetailContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  mealDetailImage: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    marginTop: 16,
    marginBottom: 16,
  },
  mealDetailTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F1F1F',
    marginBottom: 16,
  },
  macroSummary: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#059669',
  },
  macroLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  macroDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modeBtnEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  modeBtnTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 2,
  },
  modeBtnDesc: {
    fontSize: 13,
    color: '#888',
  },
  cookedItemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cookedItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sizeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  sizeBtnActive: {
    backgroundColor: '#059669',
  },
  sizeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  sizeBtnTextActive: {
    color: '#fff',
  },
  switchModeBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 16,
  },
  switchModeBtnText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  ingredientsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 14,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  ingredientInfo: {
    flex: 1,
    marginRight: 12,
  },
  ingredientName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 2,
  },
  ingredientCal: {
    fontSize: 12,
    color: '#888',
  },
  cookedToggle: {
    flexDirection: 'row',
    marginTop: 6,
  },
  cookedBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
  },
  cookedBtnActive: {
    backgroundColor: '#059669',
  },
  cookedBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  cookedBtnTextActive: {
    color: '#fff',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  qtyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
    minWidth: 60,
    textAlign: 'center',
  },
  ingredientCalEditable: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  editCalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  editCalInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 14,
    width: 60,
    textAlign: 'center',
  },
  editCalLabel: {
    fontSize: 11,
    color: '#888',
    marginLeft: 4,
    marginRight: 8,
  },
  editCalSave: {
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  logMealBtn: {
    backgroundColor: '#059669',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  logMealBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default FindRecipePage;
