import { ShieldCheck } from 'lucide-react';

interface GlyphProps {
  size?: number;
}

// Stripe wordmark "S" glyph (official mark outline).
export function StripeGlyph({ size = 22 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
    </svg>
  );
}

// Langfuse — observability trace waterfall (token-cost spans).
export function LangfuseGlyph({ size = 22 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="3" y="4" width="13" height="2.6" rx="1.3" />
      <rect x="6" y="9" width="15" height="2.6" rx="1.3" />
      <rect x="3" y="14" width="9" height="2.6" rx="1.3" />
      <rect x="9" y="19" width="10" height="2.6" rx="1.3" />
    </svg>
  );
}

// PostHog — clickstream cursor (feature action logs).
export function PostHogGlyph({ size = 22 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 2l16 7-6.6 2.4L9.6 20 4 2z" />
    </svg>
  );
}

export function SentinelGlyph({ size = 22 }: GlyphProps) {
  return <ShieldCheck size={size} strokeWidth={2.2} aria-hidden="true" />;
}

type Brand = 'stripe' | 'langfuse' | 'posthog';

const BRAND_GLYPH: Record<Brand, (props: GlyphProps) => JSX.Element> = {
  stripe: StripeGlyph,
  langfuse: LangfuseGlyph,
  posthog: PostHogGlyph,
};

interface BrandLockupProps {
  brand: Brand;
  name: string;
  role?: string;
}

// Tile + glyph + wordmark — reused in the hero stack strip and footer.
export function BrandLockup({ brand, name, role }: BrandLockupProps) {
  const Glyph = BRAND_GLYPH[brand];
  return (
    <span className="brand-lockup">
      <span className={`brand-tile ${brand}`}>
        <Glyph size={17} />
      </span>
      <span className="brand-wm">
        <span className="name">{name}</span>
        {role && <span className="role">{role}</span>}
      </span>
    </span>
  );
}
