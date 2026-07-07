import { Sparkline } from "truesight-platform";

export const CostTrendRising = () => (
  <div className="flex flex-col gap-2">
    <div className="flex items-baseline justify-between">
      <span className="text-[12px] text-mute">Daily spend — trending up</span>
      <span className="font-mono text-[12px] tabular-nums text-accent-red">+18.4%</span>
    </div>
    <Sparkline data={[132, 138, 135, 144, 151, 149, 158, 163, 171, 176]} width={220} height={40} />
  </div>
);

export const CostTrendFalling = () => (
  <div className="flex flex-col gap-2">
    <div className="flex items-baseline justify-between">
      <span className="text-[12px] text-mute">Idle instance hours — after rightsizing</span>
      <span className="font-mono text-[12px] tabular-nums text-accent-green">-42.1%</span>
    </div>
    <Sparkline data={[96, 91, 88, 84, 74, 69, 66, 61, 58, 55]} width={220} height={40} />
  </div>
);

export const VolatileSeries = () => (
  <div className="flex flex-col gap-2">
    <span className="text-[12px] text-mute">API error rate — last 24h</span>
    <Sparkline data={[2, 14, 4, 22, 7, 31, 9, 5, 18, 3, 26, 6]} width={220} height={40} strokeWidth={1.5} />
  </div>
);

export const FlatSeries = () => (
  <div className="flex flex-col gap-2">
    <span className="text-[12px] text-mute">Reserved capacity — steady state</span>
    <Sparkline data={[64, 64, 64, 64, 64, 64, 64, 64]} width={220} height={40} />
  </div>
);

export const InlineSizes = () => (
  <div className="flex items-end gap-6">
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-mute">80×24</span>
      <Sparkline data={[12, 18, 15, 24, 21, 28, 26, 33]} width={80} height={24} strokeWidth={1.25} />
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-mute">120×32 (default)</span>
      <Sparkline data={[12, 18, 15, 24, 21, 28, 26, 33]} />
    </div>
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-mute">240×48 · thicker stroke</span>
      <Sparkline data={[12, 18, 15, 24, 21, 28, 26, 33]} width={240} height={48} strokeWidth={2} />
    </div>
  </div>
);
