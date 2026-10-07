"use client";

import type { CSSProperties } from "react";
import styles from "./SpinningFan.module.css";

type Props = {
  size?: number;
  color?: string;
  background?: string;
  duration?: number;
  className?: string;
};

const BLADE =
  "M -20.5 -34.4 C -36.8 -62.4 -19.8 -104.6 0 -109.5 " +
  "C 19.8 -104.6 36.8 -62.4 20.5 -34.4 Q 0 -37.4 -20.5 -34.4 Z";

const HUB_X = 151;
const HUB_Y = 157.5;

export default function SpinningFan({
  size = 220,
  color = "#000",
  background = "#fff",
  duration = 2.25,
  className,
}: Props) {
  const style = {
    "--fan-duration": `${duration}s`,
    "--fan-origin": `${HUB_X}px ${HUB_Y}px`,
  } as CSSProperties;

  return (
    <svg
      role="img"
      aria-label="Spinning fan"
      viewBox="0 0 302 326"
      width={size}
      height={(size * 326) / 302}
      className={className}
      style={style}
      fill="none"
      stroke={color}
      strokeWidth={12}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M 175.4 286 A 137 137 0 1 0 126.6 286 A 24.4 24.4 0 0 0 175.4 286" />
      <circle cx={151.5} cy={288} r={6.4} fill={color} stroke="none" />
      <circle cx={HUB_X} cy={HUB_Y} r={94} fill={background} />

      <g className={styles.spin}>
        <g transform={`translate(${HUB_X} ${HUB_Y})`} fill={background}>
          <path d={BLADE} />
          <path d={BLADE} transform="rotate(120)" />
          <path d={BLADE} transform="rotate(240)" />
          <circle r={38} />
          <circle r={13} />
        </g>
      </g>
    </svg>
  );
}
