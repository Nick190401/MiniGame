/** Transparent vector MR mark, with no background or embedded bitmap. */
export function BrandLogo({ className = '' }: { className?: string }) {
  return <img className={`brand-logo ${className}`} src="/assets/mr-logo.svg?v=vector-2" alt="MR" width={150} height={96} draggable={false} />;
}
