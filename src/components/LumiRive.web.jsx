import React from 'react';
import { Image } from 'react-native';

// Web has no Rive runtime here, so Lumi shows as a still.
const STILLS = {
  blink: require('../../assets/lumi/lumi-avatar.png'),
  eating: require('../../assets/lumi/lumi-food.png'),
  reading: require('../../assets/lumi/lumi-think.png'),
};

export default function LumiRive({ name, width, height }) {
  return <Image source={STILLS[name]} style={{ width, height }} resizeMode="contain" accessibilityLabel="Lumi" />;
}
