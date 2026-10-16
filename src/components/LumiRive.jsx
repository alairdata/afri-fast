import React, { useState } from 'react';
import { Image } from 'react-native';
import Rive, { Fit } from 'rive-react-native';

// Animated Lumi (assets/rive/lumi-*.riv, each plays its "State Machine 1"). If a file fails to load,
// the matching still Lumi shows instead.
const LUMIS = {
  blink:   { source: require('../../assets/rive/lumi-blink.riv'),   still: require('../../assets/lumi/lumi-avatar.png') },
  eating:  { source: require('../../assets/rive/lumi-eating.riv'),  still: require('../../assets/lumi/lumi-food.png') },
  reading: { source: require('../../assets/rive/lumi-reading.riv'), still: require('../../assets/lumi/lumi-think.png') },
};

export default function LumiRive({ name, width, height }) {
  const [failed, setFailed] = useState(false);
  const lumi = LUMIS[name];
  const style = { width, height };
  if (failed) return <Image source={lumi.still} style={style} resizeMode="contain" accessibilityLabel="Lumi" />;
  return (
    <Rive
      source={lumi.source}
      stateMachineName="State Machine 1"
      autoplay
      fit={Fit.Contain}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
