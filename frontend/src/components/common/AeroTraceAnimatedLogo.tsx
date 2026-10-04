"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";

export interface AeroTraceAnimatedLogoHandle {
  replay: () => void;
  reset: () => void;
  play: () => void;
  pause: () => void;
}

export interface AeroTraceAnimatedLogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  autoPlay?: boolean;
  speed?: number; // 1.0 = normal, 0.5 = slow motion
  onComplete?: () => void;
}

// ---- Geometry (viewBox 0 0 1292 352, exactly matching the original logo) ------------
const BLUE = "#1990f8";
const SW = 17; // line stroke width
const LINE_Y = 83.5; // top line centre
const X_TAIL0 = -50; // left end of the straight line (modest overhang past "A")
const X_HEAD0 = 1218; // right end of the straight line = right edge of text
const X_TAIL1 = 643; // final left end of the top line (original logo)
const X_TOUCH = 120; // where the main wheels touch the line, above the "A"
const PIV_X = -100; // plane wheel point (local x): the plane rotates about it
const FLARE_DEG = 6; // nose-up flare angle while landing
const TD_X = X_TOUCH - PIV_X; // plane origin x at the moment of touchdown = 220
const PLANE_FINAL_X = 1118; // final plane centre x (original logo)
const GLIDE = (3 * Math.PI) / 180; // 3 degree glide slope
const ENTRY_H = 45; // height above the line where the plane enters
const TURNS = 2; // full clockwise turns of the spinning letters
const GAP = 20; // half-width of the black gap behind the plane tail
const TAIL_CLIP = -95; // gap only applies to the tail side (plane local x)

// ---- Timing -------------------------------------------------------------------
const V_LAND = 420; // plane speed while landing (logo units / second), constant
const V_ROLL = 300; // plane speed after touchdown, constant and slower
const SPEED_BLEND = 0.35; // seconds to ease from landing speed to roll speed
const LEVEL_T = 0.35; // seconds for the nose to lower to level after touchdown
const STOP_T = 0.5; // seconds for the final smooth stop
const D_APPROACH = ENTRY_H / Math.tan(GLIDE); // horizontal distance flown before touchdown
const D_ROLLOUT = PLANE_FINAL_X - TD_X; // distance travelled after touchdown
const D_BLEND = ((V_LAND + V_ROLL) / 2) * SPEED_BLEND;
const D_STOP = (V_ROLL * STOP_T) / 2;
const T_CRUISE = (D_ROLLOUT - D_BLEND - D_STOP) / V_ROLL;
const T_TOUCH = D_APPROACH / V_LAND; // plane touches the line
const T_ROLL = SPEED_BLEND + T_CRUISE + STOP_T;
const T_END = T_TOUCH + T_ROLL; // logo reaches its final state

// Distance travelled `tau` seconds after touchdown. Used by the plane, line and
// spinning letters so everything stays locked together.
const rollout = (tau: number) => {
  if (tau <= 0) return 0;
  if (tau < SPEED_BLEND) {
    return V_LAND * tau + ((V_ROLL - V_LAND) * tau * tau) / (2 * SPEED_BLEND);
  }
  if (tau < SPEED_BLEND + T_CRUISE) return D_BLEND + V_ROLL * (tau - SPEED_BLEND);
  const k = Math.min(STOP_T, tau - SPEED_BLEND - T_CRUISE);
  return D_BLEND + V_ROLL * T_CRUISE + V_ROLL * k - (V_ROLL * k * k) / (2 * STOP_T);
};

const smooth = (x: number, a: number, b: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

// One continuous path: straight top line -> down the right side -> back along the bottom.
const LINE_D =
  "M -50 83.5 L 1230 83.5 C 1250 83.5 1281 114 1281 140 L 1281 278.5 " +
  "A 62 62 0 0 1 1219 340.5 L 0 340.5";

// Plane outline traced from the logo. Local origin = plane centre on the line.
const PLANE_D =
  "M-147.6 -79.9 L-146.4 -75.1 L-144.9 -71.9 L-140.9 -59.4 L-139.9 -57.6 L-138.9 -53.6 L-131.9 -34.6 L-130.9 -30.6 L-127.9 -23.4 L-122.9 -14.4 L-117.1 -7.4 L-109.4 -0.6 L-103.1 3.1 L-95.9 6.1 L-87.1 8.4 L-79.4 9.1 L107.6 9.1 L119.1 11.6 L119.6 12.4 L126.0 9.6 L131.0 6.2 L134.0 2.8 L135.3 -1.5 L135.6 -7.1 L135.6 -12.4 L133.6 -17.9 L130.6 -21.9 L125.1 -26.9 L112.9 -34.4 L106.4 -37.6 L93.6 -42.4 L79.4 -45.6 L-57.4 -45.9 L-65.9 -48.4 L-72.1 -51.6 L-75.1 -53.9 L-80.9 -59.4 L-88.6 -68.6 L-93.6 -73.6 L-97.9 -76.6 L-103.4 -79.1 L-109.6 -80.1ZM-123.4 -62.4 L-122.6 -62.9 L-113.1 -62.6 L-109.6 -62.1 L-106.9 -61.1 L-86.9 -41.1 L-81.4 -36.9 L-76.6 -33.9 L-71.6 -31.6 L-60.6 -28.6 L75.9 -28.4 L82.1 -27.4 L86.6 -25.9 L92.4 -24.6 L99.4 -21.9 L106.1 -18.4 L112.4 -14.4 L116.9 -10.6 L116.9 -9.6 L115.6 -8.4 L-81.1 -8.4 L-88.1 -9.6 L-95.4 -12.4 L-100.1 -15.1 L-103.9 -18.1 L-107.9 -23.1 L-112.9 -33.9 L-114.1 -37.9 L-115.9 -41.4 L-117.1 -45.4 L-117.9 -46.4 L-122.1 -58.9 L-123.1 -60.6Z";

// Letters traced from the logo. `spin` letters are a, c and both e's.
const LETTERS = [
  { ch: "A", cx: 109.0, cy: 212.5, spin: false, d: "M89.1 125.6 L88.4 126.4 L87.4 129.4 L86.1 131.4 L85.1 134.6 L83.4 137.9 L79.1 148.6 L78.1 150.1 L77.1 153.4 L73.1 161.9 L72.1 165.1 L70.1 168.9 L69.1 172.1 L68.1 173.4 L67.1 176.6 L63.1 185.1 L62.1 188.4 L60.1 192.1 L59.1 195.4 L58.1 196.9 L56.1 202.1 L55.1 203.6 L54.1 206.9 L53.1 208.4 L51.1 213.9 L47.1 222.4 L46.1 225.6 L45.1 227.1 L41.1 237.1 L40.1 238.6 L36.1 248.9 L32.1 257.4 L28.1 267.4 L27.1 268.9 L26.1 272.1 L22.1 280.6 L20.4 285.4 L19.1 287.4 L18.1 290.6 L14.6 298.4 L15.4 298.9 L53.4 298.6 L62.9 275.4 L63.9 273.9 L67.9 263.1 L68.9 261.9 L69.6 261.6 L148.4 261.6 L149.1 261.9 L149.9 262.9 L153.1 271.9 L154.1 273.4 L156.1 279.1 L157.1 280.6 L158.1 284.1 L159.1 285.6 L160.4 289.4 L164.6 298.6 L203.6 298.6 L203.9 298.1 L201.9 294.1 L200.9 290.9 L196.6 282.1 L194.9 277.4 L190.9 269.1 L190.1 266.6 L188.9 264.6 L187.6 260.9 L180.9 246.1 L179.9 242.9 L176.1 235.1 L171.9 224.4 L168.9 218.4 L168.9 217.6 L165.9 211.4 L164.6 207.6 L163.1 205.1 L161.9 201.4 L157.9 193.1 L156.9 189.9 L152.9 181.4 L151.6 177.6 L147.9 169.9 L146.9 166.6 L144.9 163.1 L143.9 159.9 L142.9 158.4 L140.9 152.9 L134.9 140.1 L133.9 136.9 L131.9 133.4 L131.6 131.9 L129.1 126.4 L128.4 125.6ZM108.4 162.4 L109.1 162.6 L110.1 164.6 L114.4 176.4 L116.1 179.9 L117.1 183.4 L118.1 184.9 L119.4 189.1 L120.9 191.9 L122.1 196.1 L123.1 197.6 L127.4 209.1 L128.1 210.1 L132.1 220.9 L134.1 224.9 L135.1 228.4 L136.6 231.1 L136.1 232.1 L81.6 232.4 L80.9 231.6 L84.9 222.1 L85.9 218.6 L86.9 217.1 L88.1 213.1 L89.9 209.6 L90.9 206.1 L92.9 202.1 L93.9 198.6 L94.9 197.4 L95.9 193.9 L97.6 190.4 L101.1 180.6 L102.9 177.1 L104.1 172.9 L104.9 171.9 L107.9 162.9Z" },
  { ch: "e", cx: 274.0, cy: 235.0, spin: true, d: "M248.9 173.1 L238.6 178.1 L234.4 180.9 L228.4 185.6 L220.1 194.6 L215.1 202.6 L212.1 209.4 L209.4 218.6 L208.4 225.4 L208.1 241.1 L209.1 249.1 L210.1 253.4 L212.4 260.4 L215.1 266.4 L218.1 271.4 L222.1 276.9 L228.6 283.6 L231.4 285.9 L239.6 291.4 L244.9 294.1 L247.4 294.9 L250.6 296.6 L257.6 298.9 L269.4 300.9 L290.1 300.9 L302.1 298.9 L304.1 297.9 L309.1 296.6 L315.6 293.6 L323.4 288.6 L332.4 280.1 L332.1 279.4 L313.1 259.9 L312.4 259.6 L308.1 263.4 L301.1 267.9 L293.4 271.1 L283.6 272.6 L276.4 272.6 L270.4 271.9 L267.1 271.1 L262.1 269.1 L257.6 266.6 L254.1 263.9 L248.1 257.4 L245.1 251.4 L243.4 245.4 L244.4 244.6 L340.1 244.6 L340.4 229.9 L339.9 222.4 L336.9 209.6 L335.9 208.1 L334.9 204.9 L332.9 200.6 L328.9 194.1 L326.1 190.6 L321.4 185.6 L317.4 182.1 L308.9 176.4 L302.1 173.1 L298.1 172.1 L296.1 171.1 L287.4 169.4 L274.4 168.6 L266.1 169.1 L259.4 170.1ZM243.6 221.1 L245.1 215.6 L247.9 209.6 L252.1 204.1 L255.9 200.9 L260.6 198.1 L266.1 196.1 L271.6 195.4 L279.6 195.4 L287.1 196.9 L291.9 199.1 L297.1 203.1 L301.1 207.4 L303.1 210.6 L306.1 217.6 L306.9 221.6 L306.1 222.6 L305.4 222.9 L244.6 222.9 L243.6 222.1Z" },
  { ch: "r", cx: 401.0, cy: 234.0, spin: false, d: "M438.4 168.9 L428.6 169.4 L420.4 171.1 L419.1 171.9 L414.6 173.1 L409.6 175.6 L405.9 178.1 L402.9 180.6 L396.6 187.1 L396.1 186.9 L396.1 171.1 L395.6 170.6 L363.1 170.6 L363.1 298.6 L397.4 298.9 L398.1 298.4 L398.1 232.4 L399.9 222.1 L402.1 216.9 L405.1 212.1 L410.4 206.9 L414.4 204.4 L420.4 201.9 L423.6 201.1 L438.6 200.4 L438.9 169.4Z" },
  { ch: "o", cx: 515.0, cy: 235.0, spin: false, d: "M499.6 170.1 L488.6 173.1 L481.6 176.1 L480.6 177.1 L477.6 178.4 L469.6 183.9 L462.4 190.9 L457.1 197.9 L454.4 202.6 L451.1 209.9 L450.1 213.9 L449.1 215.9 L447.4 224.9 L446.9 230.6 L446.9 239.6 L447.4 245.1 L449.1 254.1 L450.1 256.1 L451.1 260.1 L454.4 267.1 L458.1 273.1 L461.4 277.4 L467.1 283.4 L470.4 286.1 L475.6 289.9 L482.1 293.6 L488.9 296.6 L493.6 297.9 L495.6 298.9 L508.1 300.9 L522.4 300.9 L535.4 298.9 L537.4 297.9 L542.4 296.6 L552.1 291.9 L560.6 285.9 L569.1 277.4 L571.6 274.1 L576.9 265.4 L576.9 264.6 L578.9 260.9 L581.6 252.1 L582.9 243.9 L582.9 226.6 L581.9 219.1 L580.9 216.4 L580.9 215.1 L579.9 212.9 L578.9 208.6 L577.9 207.1 L575.6 201.6 L572.6 196.6 L569.1 191.9 L561.1 183.9 L557.6 181.1 L549.6 176.1 L543.4 173.4 L538.4 172.1 L536.1 171.1 L526.1 169.4 L520.1 168.9 L510.6 168.9ZM515.4 197.1 L522.4 197.9 L526.4 198.9 L532.4 201.9 L535.4 204.1 L539.4 208.1 L543.4 213.6 L546.1 219.9 L548.1 228.6 L548.4 233.6 L548.1 240.6 L546.1 249.6 L543.6 255.4 L540.4 260.1 L535.9 264.6 L530.4 268.4 L524.4 270.9 L517.4 271.9 L511.1 271.6 L507.6 271.1 L499.4 267.9 L493.6 263.9 L490.1 260.4 L487.9 257.4 L484.9 251.6 L482.9 245.4 L481.9 239.1 L481.9 230.4 L482.9 224.1 L484.9 217.6 L486.9 213.4 L489.1 210.1 L494.1 204.9 L499.9 200.9 L504.4 198.9 L507.4 198.1Z" },
  { ch: "T", cx: 645.0, cy: 212.5, spin: false, d: "M573.6 125.6 L572.9 126.6 L572.6 155.4 L573.1 155.9 L625.6 155.9 L626.4 156.4 L626.6 298.4 L627.6 298.9 L663.1 298.6 L663.4 156.6 L664.1 155.9 L716.6 155.9 L716.9 126.4 L716.4 125.9Z" },
  { ch: "r", cx: 752.0, cy: 233.5, spin: false, d: "M790.1 169.1 L785.6 168.9 L779.6 169.4 L771.4 171.1 L769.4 172.1 L765.4 173.1 L760.9 175.4 L755.4 179.1 L751.1 183.4 L747.6 187.9 L746.9 187.6 L746.9 171.1 L746.4 170.6 L714.1 170.9 L713.9 297.6 L714.4 298.6 L748.6 298.6 L748.9 231.4 L749.9 224.6 L751.9 218.9 L754.9 213.4 L760.6 207.1 L763.9 204.9 L770.4 201.9 L774.9 200.9 L780.1 200.4 L789.6 200.6 L790.4 200.1 L790.6 169.6Z" },
  { ch: "a", cx: 864.0, cy: 235.0, spin: true, d: "M814.6 186.6 L811.9 189.6 L807.1 196.4 L804.1 201.9 L801.4 208.6 L800.9 211.4 L799.1 216.4 L798.1 222.6 L797.4 230.1 L797.4 240.9 L799.1 254.4 L800.1 256.6 L801.4 261.6 L804.1 268.1 L810.1 277.4 L819.1 286.9 L825.1 291.6 L834.9 296.9 L841.6 299.1 L851.4 300.9 L865.6 300.9 L876.1 298.6 L877.1 297.9 L880.9 296.6 L888.9 291.6 L892.4 288.9 L896.4 284.4 L897.4 284.6 L897.4 298.1 L897.9 298.6 L930.1 298.4 L929.9 170.6 L897.4 170.6 L896.9 171.1 L896.9 184.1 L896.4 184.6 L892.1 180.4 L887.1 176.4 L882.1 173.4 L877.6 171.9 L876.6 171.1 L869.6 169.6 L863.1 168.9 L855.4 168.9 L849.6 169.4 L840.6 171.1 L839.4 171.9 L834.6 173.1 L829.6 175.4 L820.4 181.4ZM862.6 197.4 L870.4 197.9 L875.1 199.1 L880.6 201.9 L884.9 205.1 L890.1 211.4 L893.1 217.1 L895.1 224.4 L895.9 228.9 L896.1 237.1 L895.1 245.4 L893.1 252.4 L890.9 257.1 L888.1 261.1 L884.1 265.1 L880.4 267.9 L873.9 270.9 L867.6 272.1 L860.6 272.1 L854.9 271.1 L848.4 268.1 L844.9 265.6 L840.1 260.9 L836.9 256.1 L834.6 251.4 L832.9 245.4 L832.1 240.9 L831.9 232.9 L832.9 224.6 L835.1 216.6 L837.9 211.4 L839.9 208.6 L843.6 204.9 L847.9 201.6 L853.6 198.9 L857.9 197.9Z" },
  { ch: "c", cx: 1013.5, cy: 235.0, spin: true, d: "M999.1 171.1 L997.1 172.1 L992.6 173.1 L985.6 176.4 L977.6 181.1 L971.9 185.6 L963.9 194.1 L959.1 201.4 L956.4 206.9 L953.1 216.1 L951.1 226.1 L950.9 229.6 L951.1 243.1 L953.1 253.4 L956.1 261.9 L961.1 271.4 L964.1 275.6 L969.4 281.4 L974.4 285.9 L978.6 288.9 L986.6 293.6 L990.1 294.9 L993.4 296.6 L998.1 297.9 L1000.1 298.9 L1011.6 300.9 L1016.9 301.1 L1031.4 300.6 L1040.6 298.9 L1041.9 298.1 L1047.1 296.6 L1056.6 291.6 L1063.4 286.4 L1068.6 281.1 L1072.9 275.9 L1075.9 271.1 L1076.4 269.4 L1067.4 264.4 L1049.1 255.4 L1048.4 255.4 L1047.1 256.6 L1043.6 261.4 L1038.4 266.4 L1035.9 268.1 L1029.1 271.1 L1022.1 272.1 L1015.4 271.9 L1011.4 271.1 L1003.6 268.1 L1000.1 265.9 L994.1 260.4 L991.9 257.4 L989.1 252.4 L986.9 245.1 L986.1 239.6 L986.1 229.6 L987.1 223.4 L989.9 215.6 L994.4 208.9 L998.6 204.6 L1002.4 201.9 L1008.9 198.9 L1016.6 197.4 L1023.4 197.4 L1031.4 198.9 L1036.6 201.4 L1040.1 203.9 L1045.4 209.1 L1048.9 214.1 L1049.9 214.1 L1052.6 212.1 L1055.4 210.9 L1057.6 209.1 L1068.4 202.9 L1069.4 201.9 L1075.4 198.6 L1075.6 197.4 L1070.1 189.9 L1062.6 182.4 L1057.4 178.4 L1054.6 177.1 L1053.6 176.1 L1047.1 173.1 L1037.6 170.4 L1026.1 168.9 L1010.4 169.1Z" },
  { ch: "e", cx: 1152.0, cy: 235.0, spin: true, d: "M1121.1 175.4 L1111.1 181.4 L1105.6 185.9 L1100.1 191.6 L1098.1 194.1 L1093.1 202.1 L1090.1 208.4 L1088.1 214.4 L1086.4 222.6 L1085.4 232.6 L1085.4 237.6 L1086.1 245.1 L1087.4 252.1 L1090.1 260.9 L1095.1 270.6 L1098.4 275.4 L1102.6 280.4 L1106.6 284.1 L1112.9 288.9 L1117.4 291.6 L1120.4 292.9 L1121.1 293.6 L1124.6 294.9 L1126.1 295.9 L1131.9 297.9 L1132.9 297.9 L1134.9 298.9 L1146.4 300.9 L1162.4 301.1 L1169.1 300.6 L1179.4 298.9 L1181.4 297.9 L1185.6 296.9 L1189.6 294.9 L1190.4 294.9 L1196.4 291.6 L1203.4 286.4 L1209.4 280.6 L1209.9 279.4 L1190.6 259.9 L1189.6 259.9 L1185.9 263.1 L1180.4 266.9 L1171.4 270.9 L1165.1 272.1 L1158.4 272.6 L1148.1 271.9 L1143.9 270.9 L1140.4 269.1 L1139.6 269.1 L1134.4 266.1 L1130.9 263.4 L1127.9 260.4 L1124.4 255.4 L1122.9 252.4 L1120.6 245.6 L1121.6 244.6 L1217.6 244.6 L1218.1 244.1 L1217.9 225.1 L1216.9 218.6 L1215.9 215.9 L1214.9 210.6 L1212.9 206.4 L1212.6 204.9 L1209.9 199.4 L1206.9 194.6 L1202.6 189.4 L1196.9 183.6 L1190.9 179.1 L1186.1 176.1 L1180.4 173.4 L1170.6 170.4 L1159.6 168.9 L1143.4 169.1 L1131.6 171.4ZM1120.6 221.4 L1123.1 213.9 L1125.4 209.6 L1127.9 206.1 L1132.1 201.9 L1136.6 198.9 L1140.6 197.1 L1144.9 195.9 L1152.4 195.1 L1162.4 196.1 L1169.1 198.9 L1173.1 201.6 L1178.1 206.6 L1181.1 211.1 L1182.9 215.4 L1184.4 220.9 L1184.4 221.9 L1183.1 222.9 L1121.6 222.9 L1120.9 222.4Z" },
];

export const AeroTraceAnimatedLogo = forwardRef<
  AeroTraceAnimatedLogoHandle,
  AeroTraceAnimatedLogoProps
>(function AeroTraceAnimatedLogo(
  {
    className = "",
    width = "100%",
    height = "auto",
    autoPlay = true,
    speed = 1.0,
    onComplete,
  },
  ref
) {
  const lineRef = useRef<SVGPathElement>(null);
  const planeRef = useRef<SVGGElement>(null);
  const gapRef = useRef<SVGPathElement>(null);
  const letterRefs = useRef<(SVGPathElement | null)[]>([]);

  const [currentSpeed, setCurrentSpeed] = useState<number>(speed);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const speedRef = useRef<number>(speed);
  const animIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const totalLengthRef = useRef<number>(0);
  const onCompleteRef = useRef<(() => void) | undefined>(onComplete);

  // Keep refs in sync with props
  useEffect(() => {
    speedRef.current = speed;
    setCurrentSpeed(speed);
  }, [speed]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const place = useCallback((x: number, y: number, deg: number, opacity: number) => {
    if (planeRef.current) {
      planeRef.current.setAttribute("transform", `translate(${x} ${y}) rotate(${deg} ${PIV_X} 0)`);
      planeRef.current.style.opacity = String(opacity);
    }
  }, []);

  const renderAt = useCallback(
    (t: number) => {
      const line = lineRef.current;
      const plane = planeRef.current;
      const gap = gapRef.current;
      if (!line || !plane || !gap) return;

      const total = totalLengthRef.current || line.getTotalLength();
      if (!totalLengthRef.current) totalLengthRef.current = total;

      const sTail1 = X_TAIL1 - X_TAIL0;
      const sHead0 = X_HEAD0 - X_TAIL0;
      const sPlane0 = TD_X - X_TAIL0;
      const sPlane1 = PLANE_FINAL_X - X_TAIL0;
      const xStart = TD_X - ENTRY_H / Math.tan(GLIDE);

      let sTail = 0;
      let sHead = sHead0;
      let spin = 0;
      let touched = false;

      if (t < T_TOUCH) {
        // PHASE 1: straight 3 degree descent (linear, no easing), tiny flare at the end.
        const p = Math.max(0, t / T_TOUCH);
        const x = xStart + (TD_X - xStart) * p;
        const y = LINE_Y - (TD_X - x) * Math.tan(GLIDE);
        const deg = -FLARE_DEG; // nose up (flare) all the way to touchdown
        place(x, y, deg, Math.min(1, Math.max(0, t / 0.3)));
      } else {
        // PHASE 2: rollout & simultaneous formation
        touched = true;
        const tau = t - T_TOUCH;
        const e = Math.min(1, rollout(tau) / D_ROLLOUT);
        sTail = sTail1 * e;
        sHead = sHead0 + (total - sHead0) * e;
        spin = 360 * TURNS * e; // clockwise
        const sp = sPlane0 + (sPlane1 - sPlane0) * e;
        const a = line.getPointAtLength(sp);
        const b = line.getPointAtLength(sp + 1);
        const tangent = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        // nose lowers from flare to level, pivoting on the wheels
        const deg = tangent - FLARE_DEG * (1 - smooth(tau, 0, LEVEL_T));
        place(a.x, a.y, deg, 1);
      }

      // Small black gap behind plane tail appears the moment plane touches down
      gap.style.opacity = touched ? "1" : "0";

      // Visible part of the line = [sTail, sHead], always continuous
      line.style.strokeDasharray = `${sHead - sTail} ${total + 10}`;
      line.style.strokeDashoffset = String(-sTail);

      // Letter rotation: only during rollout when spin is between 0 and 720
      letterRefs.current.forEach((el, i) => {
        if (!el) return;
        const L = LETTERS[i];
        if (L.spin && spin > 0.01 && Math.abs(spin - 360 * TURNS) > 0.01) {
          el.setAttribute("transform", `rotate(${spin.toFixed(2)} ${L.cx} ${L.cy})`);
        } else {
          el.removeAttribute("transform");
        }
      });
    },
    [place]
  );

  const startAnimation = useCallback(
    (fromTime = 0) => {
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }

      setIsPlaying(true);
      setIsCompleted(false);

      const rate = Math.max(0.05, speedRef.current);
      const startWall = performance.now() - (fromTime / rate) * 1000;
      startTimeRef.current = startWall;

      const tick = (now: number) => {
        const currentRate = Math.max(0.05, speedRef.current);
        const elapsedSec = ((now - startWall) / 1000) * currentRate;
        const t = Math.min(T_END, elapsedSec);
        renderAt(t);

        if (t < T_END) {
          animIdRef.current = requestAnimationFrame(tick);
        } else {
          animIdRef.current = null;
          setIsPlaying(false);
          setIsCompleted(true);
          onCompleteRef.current?.();
        }
      };

      animIdRef.current = requestAnimationFrame(tick);
    },
    [renderAt]
  );

  const resetToStart = useCallback(() => {
    if (animIdRef.current) {
      cancelAnimationFrame(animIdRef.current);
      animIdRef.current = null;
    }
    setIsPlaying(false);
    setIsCompleted(false);
    pausedTimeRef.current = 0;
    renderAt(0);
  }, [renderAt]);

  const setToEnd = useCallback(() => {
    if (animIdRef.current) {
      cancelAnimationFrame(animIdRef.current);
      animIdRef.current = null;
    }
    setIsPlaying(false);
    setIsCompleted(true);
    pausedTimeRef.current = T_END;
    renderAt(T_END);
    onCompleteRef.current?.();
  }, [renderAt]);

  useImperativeHandle(
    ref,
    () => ({
      replay: () => {
        resetToStart();
        requestAnimationFrame(() => {
          startAnimation(0);
        });
      },
      reset: resetToStart,
      play: () => {
        if (!isPlaying) {
          startAnimation(pausedTimeRef.current);
        }
      },
      pause: () => {
        if (animIdRef.current) {
          cancelAnimationFrame(animIdRef.current);
          animIdRef.current = null;
        }
        setIsPlaying(false);
      },
    }),
    [isPlaying, resetToStart, startAnimation]
  );

  useEffect(() => {
    if (lineRef.current) {
      totalLengthRef.current = lineRef.current.getTotalLength();
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setToEnd();
      return;
    }

    if (autoPlay) {
      startAnimation(0);
    } else {
      setToEnd();
    }

    return () => {
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }
    };
  }, [autoPlay, startAnimation, setToEnd]);

  return (
    <div
      className={`relative flex flex-col items-center select-none bg-[#000000] ${className}`}
      style={{ backgroundColor: "#000000" }}
    >
      <svg
        viewBox="0 0 1292 352"
        width={width}
        height={height}
        style={{
          width: typeof width === "number" ? `${width}px` : width,
          height: typeof height === "number" ? `${height}px` : height,
          overflow: "visible",
          backgroundColor: "#000000",
        }}
        role="img"
        aria-label="AeroTrace"
      >
        <defs>
          <clipPath id="aerotrace-tail-clip">
            <rect x={-600} y={-200} width={600 + TAIL_CLIP} height={400} />
          </clipPath>
          <clipPath id="aerotrace-body-clip">
            <rect x={-400} y={-200} width={800} height={209} />
          </clipPath>
        </defs>

        {/* Wordmark Letters (All exact vector coordinates traced from original logo) */}
        <g fill="#ffffff" fillRule="evenodd">
          {LETTERS.map((L, i) => (
            <path
              key={i}
              ref={(el) => {
                letterRefs.current[i] = el;
              }}
              d={L.d}
            />
          ))}
        </g>

        {/* Blue Perimeter Line: Starts straight across top, curves down & around bottom */}
        <path
          ref={lineRef}
          d={LINE_D}
          fill="none"
          stroke={BLUE}
          strokeWidth={SW}
          strokeLinecap="butt"
          strokeLinejoin="round"
          style={{
            strokeDasharray: "1268 5000",
            strokeDashoffset: "0",
          }}
        />

        {/* Stylized Airplane with Tail Gap Masking */}
        <g ref={planeRef} style={{ opacity: 0 }}>
          <g clipPath="url(#aerotrace-tail-clip)">
            <path
              ref={gapRef}
              d={PLANE_D}
              fill="#000000"
              fillRule="evenodd"
              stroke="#000000"
              strokeWidth={GAP * 2}
              strokeLinejoin="round"
              style={{ opacity: 0 }}
            />
          </g>
          <path
            d={PLANE_D}
            fill={BLUE}
            fillRule="evenodd"
            clipPath="url(#aerotrace-body-clip)"
          />
        </g>
      </svg>
    </div>
  );
});

AeroTraceAnimatedLogo.displayName = "AeroTraceAnimatedLogo";

export default AeroTraceAnimatedLogo;
