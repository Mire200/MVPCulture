'use client';

export type BgIntensity = 'full' | 'medium' | 'minimal';

export function BackgroundStage({ intensity = 'full' }: { intensity?: BgIntensity }) {
  return (
    <div className="bg-stage" aria-hidden="true">
      {intensity !== 'minimal' && <div className="bg-grid" />}
      {intensity === 'full' && (
        <>
          <div className="bg-blob b1" />
          <div className="bg-blob b2" />
          <div className="bg-blob b3" />
        </>
      )}
      {intensity === 'full' && <div className="bg-scan" />}
      {intensity !== 'minimal' && <div className="bg-noise" />}
      <div className="bg-vignette" />
    </div>
  );
}
