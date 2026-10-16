import React, { useEffect } from 'react';
import Rive, { useRive, useRiveNumber, AutoBind, Fit } from 'rive-react-native';

// The animated Momentum battery (assets/rive/momentum.riv, artboard "Momentum"). It draws its own
// card, title, score pill and battery; the app sets `score` (0-100) on the file's "Momentum" view
// model, and the file picks the colour (red under 35, yellow to 59, green from 60).
const MOMENTUM_SOURCE = require('../../assets/rive/momentum.riv');
export const RIVE_MOMENTUM_ASPECT = 228 / 564;

const RiveMomentum = ({ score, width, onFail }) => {
  const [setRiveRef, riveRef] = useRive();
  const [, setScore] = useRiveNumber(riveRef, 'score');

  useEffect(() => {
    if (!riveRef) return;
    setScore(Math.max(0, Math.min(100, Math.round(score))));
  }, [riveRef, score]);

  return (
    <Rive
      ref={setRiveRef}
      source={MOMENTUM_SOURCE}
      artboardName="Momentum"
      stateMachineName="State Machine 1"
      dataBinding={AutoBind(true)}
      fit={Fit.Contain}
      style={{ width, height: width * RIVE_MOMENTUM_ASPECT }}
      onError={() => onFail && onFail()}
    />
  );
};

export default RiveMomentum;
