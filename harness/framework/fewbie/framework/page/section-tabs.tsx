export type SectionTabItem = {
  href: string;
  label: string;
};

/**
 * Minimal section-tabs double: renders one anchor per route so the harness can
 * assert navigation targets without Next's router.
 */
export default function SectionTabs({
  items,
  ariaLabel,
  className,
}: {
  items: readonly SectionTabItem[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <nav aria-label={ariaLabel} className={className}>
      {items.map((item) => (
        <a key={item.href} href={item.href}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
