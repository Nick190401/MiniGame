/** Shared, transparent vector rendition of the supplied MR mark. */
export function BrandLogo({ className = '' }: { className?: string }) {
  return <img className={`brand-logo ${className}`} src="/assets/mr-logo.svg" alt="MR" width={150} height={96} draggable={false} />;
}
