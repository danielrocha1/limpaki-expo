import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

export function useLoadingSkeletonPulse() {
  const pulse = useRef(new Animated.Value(0.55)).current;
  const dotScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const opacityLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.95,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const dotLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotScale, {
          toValue: 1.12,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dotScale, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    opacityLoop.start();
    dotLoop.start();

    return () => {
      opacityLoop.stop();
      dotLoop.stop();
    };
  }, [pulse, dotScale]);

  return {
    blockPulse: { opacity: pulse },
    dotPulse: { opacity: pulse, transform: [{ scale: dotScale }] },
  };
}

export function LoadingSkeletonBlock({ style, animatedStyle }) {
  return <Animated.View style={[style, animatedStyle]} />;
}
