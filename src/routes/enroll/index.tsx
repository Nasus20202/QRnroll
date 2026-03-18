import { createFileRoute } from '@tanstack/react-router'

import type { CodesResponse } from '@/server/codes'
import EnrollPage from '@/pages/EnrollPage'
import { getCodes } from '@/server/codes'

const fetchCodesClient = async (): Promise<CodesResponse> => {
  const res = await getCodes()
  const payload = res instanceof Response ? await res.json() : res
  return payload as CodesResponse
}

export const Route = createFileRoute('/enroll/')({
  component: () => <EnrollPage fetchCodes={fetchCodesClient} />,
})
