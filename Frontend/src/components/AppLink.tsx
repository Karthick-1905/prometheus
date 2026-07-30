import type { AnchorHTMLAttributes, PropsWithChildren } from 'react';

type AppLinkProps = PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }>;

export default function AppLink({ to, children, ...props }: AppLinkProps) {
  return (
    <a href={to} {...props}>
      {children}
    </a>
  );
}
