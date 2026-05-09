import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Path, Circle, Ellipse, Rect } from 'react-native-svg';

export const STAGE_THRESHOLDS = [0, 1, 6, 16, 36, 71, 151];
export const STAGE_NAMES = ['Seed', 'Sprout', 'Sapling', 'Young Tree', 'Mature Tree', 'Grand Tree', 'Ancient Oak'];

export function getStageIndex(count) {
  for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (count >= STAGE_THRESHOLDS[i]) return i;
  }
  return 0;
}

export function getXpInfo(count) {
  const stage = getStageIndex(count);
  const isMax = stage === STAGE_THRESHOLDS.length - 1;
  const current = count - STAGE_THRESHOLDS[stage];
  const needed = isMax ? 0 : STAGE_THRESHOLDS[stage + 1] - STAGE_THRESHOLDS[stage];
  const pct = isMax ? 1 : current / needed;
  return { stage, current, needed, pct, isMax };
}

const Ground = ({ wide }) => (
  <>
    <Rect x={wide ? "8" : "18"} y="246" width={wide ? "184" : "164"} height="34" fill="#4E342E" rx="4"/>
    <Ellipse cx="100" cy="246" rx={wide ? "88" : "80"} ry={wide ? "13" : "11"} fill="#5D4037"/>
  </>
);

const SeedContent = () => (
  <>
    <Ellipse cx="100" cy="241" rx="8" ry="5" fill="#8D6E63"/>
    <Ellipse cx="100" cy="240" rx="4" ry="2" fill="#A1887F"/>
    <Path d="M100 237 L100 244" stroke="#6D4C41" strokeWidth="1.5" strokeLinecap="round"/>
  </>
);

const SproutContent = () => (
  <>
    <Path d="M99 245 Q99 228 100 215 Q101 228 101 245 Z" fill="#2d6a4f"/>
    <Ellipse cx="90" cy="222" rx="11" ry="6" fill="#40c074" transform="rotate(-35, 90, 222)"/>
    <Ellipse cx="110" cy="222" rx="11" ry="6" fill="#40c074" transform="rotate(35, 110, 222)"/>
    <Circle cx="100" cy="212" r="9" fill="#40c074"/>
  </>
);

const SaplingContent = () => (
  <>
    <Path d="M97 246 L97 192 Q97 184 100 184 Q103 184 103 192 L103 246 Z" fill="#5D4037"/>
    <Circle cx="100" cy="176" r="20" fill="#1b4332"/>
    <Circle cx="84" cy="188" r="17" fill="#2d6a4f"/>
    <Circle cx="116" cy="188" r="17" fill="#2d6a4f"/>
    <Circle cx="100" cy="162" r="18" fill="#40c074"/>
    <Circle cx="84" cy="174" r="14" fill="#40c074"/>
    <Circle cx="116" cy="174" r="14" fill="#40c074"/>
  </>
);

const YoungTreeContent = () => (
  <>
    <Path d="M94 246 L94 178 Q94 168 100 168 Q106 168 106 178 L106 246 Z" fill="#4E342E"/>
    <Path d="M96 246 L96 183 Q96 174 100 174 Q104 174 104 183 L104 246 Z" fill="#5D4037"/>
    <Path d="M97 197 Q81 183 73 167" stroke="#795548" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <Path d="M103 197 Q119 183 127 167" stroke="#795548" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <Circle cx="100" cy="154" r="32" fill="#1b4332"/>
    <Circle cx="75" cy="167" r="25" fill="#1b4332"/>
    <Circle cx="125" cy="167" r="25" fill="#1b4332"/>
    <Circle cx="100" cy="130" r="26" fill="#2d6a4f"/>
    <Circle cx="77" cy="150" r="22" fill="#40c074"/>
    <Circle cx="123" cy="150" r="22" fill="#40c074"/>
    <Circle cx="62" cy="164" r="18" fill="#40c074"/>
    <Circle cx="138" cy="164" r="18" fill="#40c074"/>
    <Circle cx="100" cy="116" r="20" fill="#40c074"/>
  </>
);

const MatureTreeContent = () => (
  <>
    <Path d="M90 246 L90 158 Q90 146 100 146 Q110 146 110 158 L110 246 Z" fill="#3E2723"/>
    <Path d="M92 246 L92 163 Q92 152 100 152 Q108 152 108 163 L108 246 Z" fill="#4E342E"/>
    <Path d="M94 246 L94 170 Q94 160 100 160 Q106 160 106 170 L106 246 Z" fill="#5D4037"/>
    <Path d="M93 182 Q71 162 60 142" stroke="#6D4C41" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <Path d="M107 182 Q129 162 140 142" stroke="#6D4C41" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <Path d="M100 172 Q100 154 100 138" stroke="#6D4C41" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <Circle cx="100" cy="124" r="40" fill="#1b4332"/>
    <Circle cx="67" cy="142" r="32" fill="#1b4332"/>
    <Circle cx="133" cy="142" r="32" fill="#1b4332"/>
    <Circle cx="100" cy="98" r="30" fill="#2d6a4f"/>
    <Circle cx="71" cy="118" r="27" fill="#2d6a4f"/>
    <Circle cx="129" cy="118" r="27" fill="#2d6a4f"/>
    <Circle cx="53" cy="138" r="23" fill="#40c074"/>
    <Circle cx="147" cy="138" r="23" fill="#40c074"/>
    <Circle cx="100" cy="81" r="22" fill="#40c074"/>
    <Circle cx="78" cy="102" r="20" fill="#40c074"/>
    <Circle cx="122" cy="102" r="20" fill="#40c074"/>
    <Circle cx="58" cy="124" r="17" fill="#74c69d"/>
    <Circle cx="142" cy="124" r="17" fill="#74c69d"/>
  </>
);

const GrandTreeContent = () => (
  <>
    <Path d="M90 244 Q74 250 56 248" stroke="#3E2723" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <Path d="M110 244 Q126 250 144 248" stroke="#3E2723" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <Path d="M86 246 L86 148 Q86 134 100 134 Q114 134 114 148 L114 246 Z" fill="#3E2723"/>
    <Path d="M88 246 L88 153 Q88 141 100 141 Q112 141 112 153 L112 246 Z" fill="#4E342E"/>
    <Path d="M91 246 L91 160 Q91 149 100 149 Q109 149 109 160 L109 246 Z" fill="#5D4037"/>
    <Path d="M91 172 Q68 152 56 130" stroke="#6D4C41" strokeWidth="8" fill="none" strokeLinecap="round"/>
    <Path d="M109 172 Q132 152 144 130" stroke="#6D4C41" strokeWidth="8" fill="none" strokeLinecap="round"/>
    <Path d="M100 162 Q100 142 100 124" stroke="#6D4C41" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <Path d="M56 131 Q44 118 38 100" stroke="#795548" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <Path d="M144 131 Q156 118 162 100" stroke="#795548" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <Circle cx="100" cy="112" r="48" fill="#1b4332"/>
    <Circle cx="63" cy="130" r="38" fill="#1b4332"/>
    <Circle cx="137" cy="130" r="38" fill="#1b4332"/>
    <Circle cx="36" cy="115" r="28" fill="#2d6a4f"/>
    <Circle cx="164" cy="115" r="28" fill="#2d6a4f"/>
    <Circle cx="100" cy="78" r="36" fill="#2d6a4f"/>
    <Circle cx="70" cy="98" r="32" fill="#2d6a4f"/>
    <Circle cx="130" cy="98" r="32" fill="#2d6a4f"/>
    <Circle cx="38" cy="110" r="25" fill="#40c074"/>
    <Circle cx="162" cy="110" r="25" fill="#40c074"/>
    <Circle cx="100" cy="56" r="26" fill="#40c074"/>
    <Circle cx="78" cy="74" r="24" fill="#40c074"/>
    <Circle cx="122" cy="74" r="24" fill="#40c074"/>
    <Circle cx="68" cy="108" r="6" fill="#E53935"/>
    <Circle cx="136" cy="118" r="6" fill="#E53935"/>
    <Circle cx="110" cy="76" r="5" fill="#E53935"/>
    <Circle cx="44" cy="116" r="5" fill="#FF8A65"/>
    <Circle cx="156" cy="112" r="5" fill="#FF8A65"/>
  </>
);

const AncientOakContent = () => (
  <>
    <Circle cx="100" cy="130" r="92" fill="#40c074" opacity="0.07"/>
    <Path d="M88 244 Q70 254 52 250" stroke="#3E2723" strokeWidth="7" fill="none" strokeLinecap="round"/>
    <Path d="M112 244 Q130 254 148 250" stroke="#3E2723" strokeWidth="7" fill="none" strokeLinecap="round"/>
    <Path d="M84 244 Q66 258 56 264" stroke="#3E2723" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <Path d="M116 244 Q134 258 144 264" stroke="#3E2723" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <Path d="M84 246 L84 142 Q84 126 100 126 Q116 126 116 142 L116 246 Z" fill="#2C1810"/>
    <Path d="M86 246 L86 146 Q86 132 100 132 Q114 132 114 146 L114 246 Z" fill="#3E2723"/>
    <Path d="M89 246 L89 153 Q89 141 100 141 Q111 141 111 153 L111 246 Z" fill="#4E342E"/>
    <Path d="M92 246 L92 162 Q92 150 100 150 Q108 150 108 162 L108 246 Z" fill="#5D4037"/>
    <Path d="M88 167 Q62 146 48 121" stroke="#5D4037" strokeWidth="10" fill="none" strokeLinecap="round"/>
    <Path d="M112 167 Q138 146 152 121" stroke="#5D4037" strokeWidth="10" fill="none" strokeLinecap="round"/>
    <Path d="M100 157 Q100 135 100 116" stroke="#5D4037" strokeWidth="8" fill="none" strokeLinecap="round"/>
    <Path d="M48 122 Q35 107 30 90" stroke="#6D4C41" strokeWidth="7" fill="none" strokeLinecap="round"/>
    <Path d="M152 122 Q165 107 170 90" stroke="#6D4C41" strokeWidth="7" fill="none" strokeLinecap="round"/>
    <Circle cx="100" cy="100" r="56" fill="#1b4332"/>
    <Circle cx="56" cy="122" r="43" fill="#1b4332"/>
    <Circle cx="144" cy="122" r="43" fill="#1b4332"/>
    <Circle cx="30" cy="106" r="27" fill="#2d6a4f"/>
    <Circle cx="170" cy="106" r="27" fill="#2d6a4f"/>
    <Circle cx="100" cy="64" r="40" fill="#2d6a4f"/>
    <Circle cx="68" cy="86" r="35" fill="#2d6a4f"/>
    <Circle cx="132" cy="86" r="35" fill="#2d6a4f"/>
    <Circle cx="32" cy="102" r="24" fill="#40c074"/>
    <Circle cx="168" cy="102" r="24" fill="#40c074"/>
    <Circle cx="100" cy="38" r="28" fill="#40c074"/>
    <Circle cx="76" cy="58" r="27" fill="#40c074"/>
    <Circle cx="124" cy="58" r="27" fill="#40c074"/>
    <Circle cx="22" cy="96" r="19" fill="#74c69d"/>
    <Circle cx="178" cy="96" r="19" fill="#74c69d"/>
    <Circle cx="100" cy="20" r="19" fill="#74c69d"/>
    <Circle cx="62" cy="108" r="7" fill="#E53935"/>
    <Circle cx="142" cy="112" r="7" fill="#E53935"/>
    <Circle cx="112" cy="72" r="6" fill="#E53935"/>
    <Circle cx="32" cy="106" r="5" fill="#FF8A65"/>
    <Circle cx="168" cy="102" r="5" fill="#FF8A65"/>
    <Circle cx="88" cy="46" r="6" fill="#E53935"/>
    <Circle cx="120" cy="36" r="5" fill="#FF8A65"/>
  </>
);

const CONTENTS = [SeedContent, SproutContent, SaplingContent, YoungTreeContent, MatureTreeContent, GrandTreeContent, AncientOakContent];

const WillpowerTree = ({ count = 0, pulseKey = 0, size = 220 }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const stage = getStageIndex(count);
  const TreeContent = CONTENTS[stage];

  useEffect(() => {
    if (!pulseKey) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.12, useNativeDriver: true, speed: 40, bounciness: 14 }),
      Animated.spring(scale, { toValue: 1.0, useNativeDriver: true, speed: 18, bounciness: 4 }),
    ]).start();
  }, [pulseKey]);

  const svgH = Math.round(size * 1.4);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Svg width={size} height={svgH} viewBox="0 0 200 280">
        <Ground wide={stage >= 4} />
        <TreeContent />
      </Svg>
    </Animated.View>
  );
};

export default WillpowerTree;
