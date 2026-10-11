import Link from "next/link";

/** The large-title screen header (M-01): title 28/34 bold, optional subtitle, actions on the right. */
export function ScreenHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex items-end pb-3 pl-4 pr-2 pt-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center">{actions}</div>
      ) : null}
    </header>
  );
}

/** A 44px header icon button; with `href` it renders as a link. */
export function HeaderIconButton({
  label,
  href,
  onClick,
  children,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const className = "flex size-11 items-center justify-center text-icon";
  if (href) {
    return (
      <Link href={href} aria-label={label} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className={className}>
      {children}
    </button>
  );
}
