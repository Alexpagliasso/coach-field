import { useNavigate as useRouterNavigate, useParams } from 'react-router-dom'
export function useNavigate() {
  const navigate = useRouterNavigate(); const { groupId } = useParams()
  return (to: string | number) => typeof to === 'number' ? navigate(to) : navigate(to.startsWith('/') && !to.startsWith('/app/') ? `/app/${groupId}${to === '/' ? '/today' : to}` : to)
}
