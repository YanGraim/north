import { useWorkspaceHref } from '@renderer/hooks/use-workspaces'
import { Link, type LinkProps, NavLink, type NavLinkProps } from 'react-router-dom'

/** `<Link>` whose absolute string `to` stays inside the current workspace (`/w/:id/…`). */
export function WorkspaceLink({ to, ...props }: LinkProps & { to: string }): React.JSX.Element {
  const href = useWorkspaceHref()
  return <Link to={to.startsWith('/') ? href(to) : to} {...props} />
}

export function WorkspaceNavLink({
  to,
  ...props
}: NavLinkProps & { to: string }): React.JSX.Element {
  const href = useWorkspaceHref()
  return <NavLink to={to.startsWith('/') ? href(to) : to} {...props} />
}
