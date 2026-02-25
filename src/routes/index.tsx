import { createFileRoute } from '@tanstack/react-router'

import ScannerPage from '@/pages/ScannerPage'
import type { ScannerPageProps } from '@/pages/ScannerPage'
import { getCodes, postCode } from '@/server/codes'
import type { SubmitResponse } from '@/server/codes'

type PostCodeArgs = Parameters<typeof postCode>[0]
type PostCodeData = { data: { code: string } }

const submitCodeClient = async (code: string): Promise<SubmitResponse> => {
  const res = await postCode({ data: { code } } as PostCodeArgs & PostCodeData)
  const payload = res instanceof Response ? await res.json() : res
  return payload as SubmitResponse
}

const fetchCodesClient = async () => {
  const res = await getCodes()
  const payload = res instanceof Response ? await res.json() : res
  return payload as { code: string; ts: number }[]
}

export const Route = createFileRoute('/')({
  component: () => {
    const props: ScannerPageProps = {
      submitCode: submitCodeClient,
      fetchCodes: fetchCodesClient,
    }
    return <ScannerPage {...props} />
  },
})
