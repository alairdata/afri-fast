import React, { useEffect } from 'react';
import Rive, { useRive, useRiveNumber, AutoBind, Fit } from 'rive-react-native';

// The animated calorie gauge (assets/rive/gauge.riv, artboard "Gauge"). It draws its own
// segments, flame, number and "Remaining" label; the app feeds it through the file's
// "Gauge" view model: progress (0 to 1 of the day's goal eaten) and remaining (calories).
const GAUGE_SOURCE = require('../../assets/rive/gauge.riv');
export const RIVE_GAUGE_ASPECT = 300 / 540;

const RiveCalorieGauge = ({ progress, remaining, width, onFail }) => {
  const [setRiveRef, riveRef] = useRive();
  const [, setProgress] = useRiveNumber(riveRef, 'progress');
  const [, setRemaining] = useRiveNumber(riveRef, 'remaining');

  useEffect(() => {
    if (!riveRef) return;
    setProgress(Math.max(0, Math.min(progress, 1)));
    setRemaining(Math.max(0, Math.round(remaining)));
  }, [riveRef, progress, remaining]);

  return (
    <Rive
      ref={setRiveRef}
      source={GAUGE_SOURCE}
      artboardName="Gauge"
      stateMachineName="State Machine 1"
      dataBinding={AutoBind(true)}
      fit={Fit.Contain}
      style={{ width, height: width * RIVE_GAUGE_ASPECT }}
      onError={() => onFail && onFail()}
    />
  );
};

export default RiveCalorieGauge;
