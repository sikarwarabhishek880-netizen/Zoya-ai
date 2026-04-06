import { motion } from "motion/react";

interface WaveformProps {
  isSpeaking: boolean;
  isListening: boolean;
  isVibeMode?: boolean;
}

export const Waveform = ({ isSpeaking, isListening, isVibeMode }: WaveformProps) => {
  const bars = Array.from({ length: 20 });

  return (
    <div className="flex items-center justify-center gap-1 h-32">
      {bars.map((_, i) => (
        <motion.div
          key={i}
          className={`w-1.5 rounded-full ${isVibeMode ? "bg-gradient-to-b from-cyan-400 to-pink-500" : "bg-pink-500"}`}
          animate={{
            height: isVibeMode ? [40, 120, 60, 140, 40] : isSpeaking ? [20, 80, 40, 100, 20] : isListening ? [10, 30, 10, 40, 10] : 10,
            opacity: isVibeMode || isSpeaking || isListening ? 1 : 0.3,
          }}
          transition={{
            duration: isVibeMode ? 0.3 : 0.5,
            repeat: Infinity,
            delay: i * 0.05,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};
