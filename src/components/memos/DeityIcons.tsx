import React from "react";

export const ShivaEmblemSVG: React.FC<{ className?: string; color?: string }> = ({
  className = "w-14 h-16",
  color = "#1b357d",
}) => (
  <svg
    viewBox="0 0 100 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Lord Shiva Traditional Portrait Line Art */}
    <g stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
      {/* Jata (Hair Topknot) */}
      <path d="M40 38 C35 30 35 15 50 12 C65 15 65 30 60 38" fill={color} fillOpacity="0.08" />
      <path d="M45 20 C42 16 58 16 55 20" />
      <path d="M42 26 C40 22 60 22 58 26" />
      <path d="M38 32 C36 28 64 28 62 32" />
      {/* Crescent Moon (Chandrama) on left of jata */}
      <path
        d="M34 16 C30 22 34 30 40 32 C37 28 36 22 38 18 C36 17 35 16 34 16 Z"
        fill={color}
      />
      {/* Holy Ganga stream subtle accent */}
      <path d="M50 12 C52 6 56 6 58 10" />

      {/* Face & Head Outline */}
      <path d="M38 38 C32 46 33 65 38 74 C44 84 56 86 62 74 C67 65 68 46 62 38" />
      
      {/* Ears */}
      <path d="M35 48 C32 52 32 58 35 62" />
      <path d="M65 48 C68 52 68 58 65 62" />
      {/* Kundalas (Earrings) */}
      <circle cx="33" cy="62" r="2.5" fill={color} />
      <circle cx="67" cy="62" r="2.5" fill={color} />

      {/* Forehead & Sacred Tripundra Lines */}
      <path d="M42 42 L58 42" strokeWidth="1.2" />
      <path d="M41 45 L59 45" strokeWidth="1.2" />
      <path d="M42 48 L58 48" strokeWidth="1.2" />
      {/* Third Eye (Trinetra) & Bindu */}
      <ellipse cx="50" cy="45" rx="1.5" ry="3" fill={color} />
      <circle cx="50" cy="50" r="1.2" fill={color} />

      {/* Eyebrows & Eyes */}
      <path d="M40 54 Q45 52 48 54" strokeWidth="1.5" />
      <path d="M52 54 Q55 52 60 54" strokeWidth="1.5" />
      <path d="M41 57 Q45 60 48 57" strokeWidth="1.2" />
      <path d="M52 57 Q55 60 59 57" strokeWidth="1.2" />

      {/* Nose */}
      <path d="M50 54 L50 64 Q48 66 50 67 Q52 66 50 64" />
      
      {/* Serene Lips / Smile */}
      <path d="M45 72 Q50 75 55 72" strokeWidth="1.5" />
      <path d="M47 75 Q50 77 53 75" />

      {/* Neck & Sacred Blue Throat / Snake (Vasuki) */}
      <path d="M42 80 C36 86 32 98 28 112" />
      <path d="M58 80 C64 86 68 98 72 112" />
      {/* Snake Coil around neck */}
      <path d="M38 85 Q50 92 62 85 Q50 82 38 85 Z" fill={color} fillOpacity="0.15" />
      <path d="M62 85 C66 82 70 80 68 76 C66 73 63 76 62 78" strokeWidth="1.8" />
      {/* Rudraksha Beads */}
      <path d="M36 92 Q50 102 64 92" strokeDasharray="1.5 2.5" strokeWidth="2.5" />
      <path d="M32 100 Q50 114 68 100" strokeDasharray="1.5 2.5" strokeWidth="2.5" />

      {/* Trishul (Trident) on side */}
      <path d="M82 15 L82 115" strokeWidth="2" />
      <path d="M74 24 Q82 32 90 24" strokeWidth="1.8" />
      <path d="M74 24 L74 15 Q75 12 77 15 L77 26" strokeWidth="1.4" fill={color} />
      <path d="M82 15 L82 5 Q83 2 85 5 L85 15" strokeWidth="1.4" fill={color} />
      <path d="M90 24 L90 15 Q89 12 87 15 L87 26" strokeWidth="1.4" fill={color} />
      {/* Damru tied to Trishul */}
      <path d="M78 40 L86 48 L78 48 L86 40 Z" fill={color} fillOpacity="0.2" strokeWidth="1.5" />
    </g>
  </svg>
);

export const BalajiEmblemSVG: React.FC<{ className?: string; color?: string }> = ({
  className = "w-14 h-16",
  color = "#1b357d",
}) => (
  <svg
    viewBox="0 0 100 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Lord Venkateswara / Balaji Traditional Temple Sanctum Arch & Idol */}
    <g stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
      {/* Temple Arch (Prabhavali) */}
      <path
        d="M15 115 L15 65 C15 30 30 10 50 10 C70 10 85 30 85 65 L85 115"
        strokeWidth="2.2"
      />
      <path
        d="M20 115 L20 66 C20 34 33 16 50 16 C67 16 80 34 80 66 L80 115"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      {/* Top Kirtimukha / Kalash on Arch */}
      <path d="M46 10 L50 4 L54 10 Z" fill={color} />
      <circle cx="50" cy="4" r="1.5" fill={color} />

      {/* Ornate Crown (Kireetam) */}
      <path
        d="M38 42 L42 20 L50 16 L58 20 L62 42 Z"
        fill={color}
        fillOpacity="0.12"
        strokeWidth="1.8"
      />
      <path d="M42 28 L58 28" strokeWidth="1.2" />
      <path d="M40 35 L60 35" strokeWidth="1.2" />
      <circle cx="50" cy="24" r="2" fill={color} />

      {/* Divine Thiruman Namam (Tilak covering forehead) */}
      <path
        d="M44 38 L44 54 Q50 58 56 54 L56 38 Q53 44 50 44 Q47 44 44 38 Z"
        fill={color}
        fillOpacity="0.25"
        strokeWidth="1.4"
      />
      {/* Center Kasturi Thilak (Srichurnam line) */}
      <path d="M50 42 L50 58" strokeWidth="2.2" stroke={color} />

      {/* Serene Face & Smile */}
      <path d="M40 46 C37 54 37 66 42 74 C46 80 54 80 58 74 C63 66 63 54 60 46" />
      <path d="M47 68 Q50 71 53 68" strokeWidth="1.5" />

      {/* Upper Hands: Shanka (Conch) on Left, Sudarshana Chakra on Right */}
      {/* Sudarshana Chakra (Top Right / Viewer Left) */}
      <circle cx="28" cy="42" r="6" fill={color} fillOpacity="0.15" strokeWidth="1.6" />
      <path d="M28 36 L28 48 M22 42 L34 42" strokeWidth="1.2" />
      <path d="M28 48 L36 62" strokeWidth="1.6" />

      {/* Shanka Conch (Top Left / Viewer Right) */}
      <ellipse cx="72" cy="42" rx="5" ry="6" fill={color} fillOpacity="0.15" strokeWidth="1.6" />
      <path d="M70 38 Q74 42 70 46" strokeWidth="1.2" />
      <path d="M72 48 L64 62" strokeWidth="1.6" />

      {/* Diamond Armor, Chest Ornaments & Garlands (Vanamala) */}
      <path d="M42 76 L32 90 L36 115" strokeWidth="1.6" />
      <path d="M58 76 L68 90 L64 115" strokeWidth="1.6" />
      {/* Kaustubha Jewel / Lakshmi on Chest */}
      <rect x="46" y="80" width="8" height="8" transform="rotate(45 50 84)" fill={color} />

      {/* Heavy Flower Garlands */}
      <path d="M35 84 Q50 96 65 84" strokeWidth="2" />
      <path d="M32 94 Q50 110 68 94" strokeWidth="2.2" />
      <path d="M30 104 Q50 120 70 104" strokeWidth="2.4" />

      {/* Lower Hands: Varada (Blessing) & Kati Hastha */}
      <path d="M36 78 Q42 86 46 90" strokeWidth="1.6" />
      <path d="M64 78 Q58 86 54 90" strokeWidth="1.6" />

      {/* Base Pedestal (Peedam) */}
      <rect x="22" y="112" width="56" height="5" fill={color} fillOpacity="0.2" strokeWidth="1.5" />
    </g>
  </svg>
);

export const getShivaSVGString = (color: string = "#1b357d"): string => `
<svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 58px; height: 72px;">
  <g stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M40 38 C35 30 35 15 50 12 C65 15 65 30 60 38" fill="${color}" fill-opacity="0.08" />
    <path d="M45 20 C42 16 58 16 55 20" />
    <path d="M42 26 C40 22 60 22 58 26" />
    <path d="M38 32 C36 28 64 28 62 32" />
    <path d="M34 16 C30 22 34 30 40 32 C37 28 36 22 38 18 C36 17 35 16 34 16 Z" fill="${color}" />
    <path d="M50 12 C52 6 56 6 58 10" />
    <path d="M38 38 C32 46 33 65 38 74 C44 84 56 86 62 74 C67 65 68 46 62 38" />
    <path d="M35 48 C32 52 32 58 35 62" />
    <path d="M65 48 C68 52 68 58 65 62" />
    <circle cx="33" cy="62" r="2.5" fill="${color}" />
    <circle cx="67" cy="62" r="2.5" fill="${color}" />
    <path d="M42 42 L58 42" stroke-width="1.2" />
    <path d="M41 45 L59 45" stroke-width="1.2" />
    <path d="M42 48 L58 48" stroke-width="1.2" />
    <ellipse cx="50" cy="45" rx="1.5" ry="3" fill="${color}" />
    <circle cx="50" cy="50" r="1.2" fill="${color}" />
    <path d="M40 54 Q45 52 48 54" stroke-width="1.5" />
    <path d="M52 54 Q55 52 60 54" stroke-width="1.5" />
    <path d="M41 57 Q45 60 48 57" stroke-width="1.2" />
    <path d="M52 57 Q55 60 59 57" stroke-width="1.2" />
    <path d="M50 54 L50 64 Q48 66 50 67 Q52 66 50 64" />
    <path d="M45 72 Q50 75 55 72" stroke-width="1.5" />
    <path d="M47 75 Q50 77 53 75" />
    <path d="M42 80 C36 86 32 98 28 112" />
    <path d="M58 80 C64 86 68 98 72 112" />
    <path d="M38 85 Q50 92 62 85 Q50 82 38 85 Z" fill="${color}" fill-opacity="0.15" />
    <path d="M62 85 C66 82 70 80 68 76 C66 73 63 76 62 78" stroke-width="1.8" />
    <path d="M36 92 Q50 102 64 92" stroke-dasharray="1.5 2.5" stroke-width="2.5" />
    <path d="M32 100 Q50 114 68 100" stroke-dasharray="1.5 2.5" stroke-width="2.5" />
    <path d="M82 15 L82 115" stroke-width="2" />
    <path d="M74 24 Q82 32 90 24" stroke-width="1.8" />
    <path d="M74 24 L74 15 Q75 12 77 15 L77 26" stroke-width="1.4" fill="${color}" />
    <path d="M82 15 L82 5 Q83 2 85 5 L85 15" stroke-width="1.4" fill="${color}" />
    <path d="M90 24 L90 15 Q89 12 87 15 L87 26" stroke-width="1.4" fill="${color}" />
    <path d="M78 40 L86 48 L78 48 L86 40 Z" fill="${color}" fill-opacity="0.2" stroke-width="1.5" />
  </g>
</svg>`;

export const getBalajiSVGString = (color: string = "#1b357d"): string => `
<svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 58px; height: 72px;">
  <g stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M15 115 L15 65 C15 30 30 10 50 10 C70 10 85 30 85 65 L85 115" stroke-width="2.2" />
    <path d="M20 115 L20 66 C20 34 33 16 50 16 C67 16 80 34 80 66 L80 115" stroke-width="1" stroke-dasharray="2 2" />
    <path d="M46 10 L50 4 L54 10 Z" fill="${color}" />
    <circle cx="50" cy="4" r="1.5" fill="${color}" />
    <path d="M38 42 L42 20 L50 16 L58 20 L62 42 Z" fill="${color}" fill-opacity="0.12" stroke-width="1.8" />
    <path d="M42 28 L58 28" stroke-width="1.2" />
    <path d="M40 35 L60 35" stroke-width="1.2" />
    <circle cx="50" cy="24" r="2" fill="${color}" />
    <path d="M44 38 L44 54 Q50 58 56 54 L56 38 Q53 44 50 44 Q47 44 44 38 Z" fill="${color}" fill-opacity="0.25" stroke-width="1.4" />
    <path d="M50 42 L50 58" stroke-width="2.2" stroke="${color}" />
    <path d="M40 46 C37 54 37 66 42 74 C46 80 54 80 58 74 C63 66 63 54 60 46" />
    <path d="M47 68 Q50 71 53 68" stroke-width="1.5" />
    <circle cx="28" cy="42" r="6" fill="${color}" fill-opacity="0.15" stroke-width="1.6" />
    <path d="M28 36 L28 48 M22 42 L34 42" stroke-width="1.2" />
    <path d="M28 48 L36 62" stroke-width="1.6" />
    <ellipse cx="72" cy="42" rx="5" ry="6" fill="${color}" fill-opacity="0.15" stroke-width="1.6" />
    <path d="M70 38 Q74 42 70 46" stroke-width="1.2" />
    <path d="M72 48 L64 62" stroke-width="1.6" />
    <path d="M42 76 L32 90 L36 115" stroke-width="1.6" />
    <path d="M58 76 L68 90 L64 115" stroke-width="1.6" />
    <rect x="46" y="80" width="8" height="8" transform="rotate(45 50 84)" fill="${color}" />
    <path d="M35 84 Q50 96 65 84" stroke-width="2" />
    <path d="M32 94 Q50 110 68 94" stroke-width="2.2" />
    <path d="M30 104 Q50 120 70 104" stroke-width="2.4" />
    <path d="M36 78 Q42 86 46 90" stroke-width="1.6" />
    <path d="M54 90 Q58 86 64 78" stroke-width="1.6" />
    <rect x="22" y="112" width="56" height="5" fill="${color}" fill-opacity="0.2" stroke-width="1.5" />
  </g>
</svg>`;
