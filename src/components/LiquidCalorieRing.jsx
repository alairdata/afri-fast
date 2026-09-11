/**
 * LiquidCalorieRing
 * -----------------------------------------------------------------------------
 * Expo managed-workflow safe: react-native-svg (v15) + RN Animated only.
 * No Reanimated, no native linking. Works on iOS / Android / react-native-web.
 *
 * Props
 *   ratio          0..1  calories eaten / goal (clamped)
 *   overflowRatio  0..1  how far over goal, as a fraction of goal (clamped)
 *   size           px, default 200
 *   style          optional container style
 *
 * The center is intentionally empty — overlay your own label/number/unit
 * absolutely on top of this component.
 *
 *   <View style={{ width: 200, height: 200 }}>
 *     <LiquidCalorieRing ratio={0.72} overflowRatio={0} size={200} />
 *     <View style={StyleSheet.absoluteFill} pointerEvents="none">
 *       ...your text...
 *     </View>
 *   </View>
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
  Circle,
  Path,
  G,
} from 'react-native-svg';

/* ------------------------------------------------------------------ colors */

export const RING_COLORS = {
  liquidTop: '#34D399',    // gradient start (top of the disc)
  liquidBottom: '#059669', // gradient end  (bottom of the disc)
  crest: '#047857',        // darker two-tone crest wave riding above the body
  track: '#ECF8F1',        // soft mint empty portion
  trackShade: '#E1F3E8',   // gentle shading toward the bottom of the empty part
  ring: '#A9E3C4',         // light green ring around the gauge
};

/* ----------------------------------------------------------------- helpers */

const f = (n) => Math.round(n * 100) / 100;
const clamp01 = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/**
 * Closed polygon: sampled sine surface at `levelY`, then down to below the box.
 * 40 segments is smooth at any size the gauge is realistically rendered at.
 */
function wavePath(size, levelY, amp, phase, waves) {
  const steps = 40;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const x = (size * i) / steps;
    const y = levelY + amp * Math.sin((x / size) * waves * Math.PI * 2 + phase);
    d += `${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)} `;
  }
  const floor = f(size + amp + 8);
  return `${d}L${f(size)} ${floor} L0 ${floor} Z`;
}

/** Dome of liquid bulging above the rim: a convex meniscus, tangent at the rim. */
function bulgePath(size, spill) {
  const r = size / 2;
  const cx = r;
  const cy = r;
  const w = r * (0.40 + 0.15 * spill);        // half-chord where it meets the rim
  const h = r * 0.34 * spill;                 // height above the rim
  const yc = cy - Math.sqrt(Math.max(r * r - w * w, 0));
  const top = cy - r - h;
  return (
    `M${f(cx - w)} ${f(yc)} ` +
    `C${f(cx - w * 0.9)} ${f(yc - h * 0.8)}, ${f(cx - w * 0.45)} ${f(top)}, ${f(cx)} ${f(top)} ` +
    `C${f(cx + w * 0.45)} ${f(top)}, ${f(cx + w * 0.9)} ${f(yc - h * 0.8)}, ${f(cx + w)} ${f(yc)} ` +
    `A${f(r)} ${f(r)} 0 0 0 ${f(cx - w)} ${f(yc)} Z`
  );
}

/* --------------------------------------------------------------- component */

export default function LiquidCalorieRing({
  ratio = 0,
  overflowRatio = 0,
  size = 200,
  style,
}) {
  const targetLevel = clamp01(ratio);
  const targetSpill = clamp01(overflowRatio);

  const phaseA = useRef(new Animated.Value(0)).current;
  const levelA = useRef(new Animated.Value(targetLevel)).current;
  const spillA = useRef(new Animated.Value(targetSpill)).current;

  // SVG path data is a string, so we read the Animated values through
  // listeners and rebuild the geometry — hence useNativeDriver: false.
  const [phase, setPhase] = useState(0);
  const [level, setLevel] = useState(targetLevel);
  const [spill, setSpill] = useState(targetSpill);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(phaseA, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [phaseA]);

  useEffect(() => {
    const id = phaseA.addListener(({ value }) => setPhase(value * Math.PI * 2));
    return () => phaseA.removeListener(id);
  }, [phaseA]);

  useEffect(() => {
    const id = levelA.addListener(({ value }) => setLevel(value));
    return () => levelA.removeListener(id);
  }, [levelA]);

  useEffect(() => {
    const id = spillA.addListener(({ value }) => setSpill(value));
    return () => spillA.removeListener(id);
  }, [spillA]);

  useEffect(() => {
    Animated.timing(levelA, {
      toValue: targetLevel,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [targetLevel, levelA]);

  useEffect(() => {
    Animated.timing(spillA, {
      toValue: targetSpill,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [targetSpill, spillA]);

  /* ---------------------------------------------------------- geometry */

  const r = size / 2;
  const pad = size * 0.22;      // headroom for the bulge
  const outer = size + pad * 2;
  const ringW = Math.max(3, size * 0.035);

  const levelY = size * (1 - level);
  // one long, lazy wavelength across the disc — same read as the reference
  const baseAmp = size * 0.028;
  // flatten the surface as it approaches empty / full so it never clips oddly
  const taper = Math.max(0, Math.min(1, level * 7, (1 - level) * 7));
  const amp = baseAmp * taper;

  // darker crest wave sits slightly higher and out of phase, so it shows as a
  // two-tone band wherever it rises above the lighter body
  const crestD = wavePath(size, levelY - amp * 0.55, amp * 0.9, phase + 1.1, 1);
  const bodyD = wavePath(size, levelY, amp, phase, 1);

  const showSpill = spill > 0.004;
  const uid = `lcr${size}`;

  return (
    <View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Svg
        width={outer}
        height={outer}
        viewBox={`0 0 ${f(outer)} ${f(outer)}`}
        style={{ position: 'absolute', left: -pad, top: -pad }}
      >
        <Defs>
          <LinearGradient id={`${uid}-liquid`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={RING_COLORS.liquidTop} />
            <Stop offset="1" stopColor={RING_COLORS.liquidBottom} />
          </LinearGradient>
          <LinearGradient id={`${uid}-track`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={RING_COLORS.track} />
            <Stop offset="1" stopColor={RING_COLORS.trackShade} />
          </LinearGradient>
          <ClipPath id={`${uid}-disc`}>
            <Circle cx={f(r)} cy={f(r)} r={f(r)} />
          </ClipPath>
        </Defs>

        <G x={f(pad)} y={f(pad)}>
          {/* soft warm empty track */}
          <Circle cx={f(r)} cy={f(r)} r={f(r)} fill={`url(#${uid}-track)`} />

          {/* liquid, clipped to the disc */}
          <G clipPath={`url(#${uid}-disc)`}>
            <Path d={crestD} fill={RING_COLORS.crest} />
            <Path d={bodyD} fill={`url(#${uid}-liquid)`} />
          </G>

          {/* overflow: the same green liquid heaped above the rim */}
          {showSpill ? <Path d={bulgePath(size, spill)} fill={RING_COLORS.liquidTop} /> : null}

          {/* light green ring */}
          <Circle
            cx={f(r)}
            cy={f(r)}
            r={f(r - ringW / 2)}
            fill="none"
            stroke={RING_COLORS.ring}
            strokeWidth={ringW}
          />
        </G>
      </Svg>
    </View>
  );
}
