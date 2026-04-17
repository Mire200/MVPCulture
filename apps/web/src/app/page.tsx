import { LandingAvatars } from '@/features/landing/LandingAvatars';
import { LandingHeroCta } from '@/features/landing/LandingHeroCta';
import { TastyLogo } from '@/features/landing/TastyLogo';

export default function HomePage() {
  return (
    <div className="landing-root">
      <TastyLogo />
      <LandingAvatars />

      <div className="landing-stage">
        <div className="landing-hero">
          <div className="landing-chip">◉ party game · sans compte</div>
          <h1 className="landing-wordmark">
            CACA
            <span className="accent">Culture</span>
          </h1>
          <LandingHeroCta />
        </div>
      </div>

      <div className="landing-footer">
        <span>v0.9 · beta</span>
        <span className="landing-dot" />
        <span>serveur en ligne</span>
      </div>
    </div>
  );
}
