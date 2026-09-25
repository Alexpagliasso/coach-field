import { Link as RouterLink, NavLink as RouterNavLink, useParams, type LinkProps, type NavLinkProps } from 'react-router-dom'
function scoped(groupId: string | undefined, to: LinkProps['to']) {
  if (typeof to !== 'string' || !to.startsWith('/') || to.startsWith('/app/') || to === '/admin' || to === '/login') return to
  return `/app/${groupId}${to === '/' ? '/today' : to}`
}
export function Link(props: LinkProps) { const { groupId } = useParams(); return <RouterLink {...props} to={scoped(groupId, props.to)} /> }
export function NavLink(props: NavLinkProps) { const { groupId } = useParams(); return <RouterNavLink {...props} to={scoped(groupId, props.to)} /> }
