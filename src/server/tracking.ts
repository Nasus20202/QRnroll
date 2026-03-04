import { createServerFn } from '@tanstack/react-start'

export const getTrackingScript = createServerFn({ method: 'GET' }).handler(
  async () => {
    const script = process.env.TRACKING_SCRIPT

    if (!script) {
      return { script: null }
    }

    return { script }
  },
)

export type TrackingScriptPayload = Awaited<
  ReturnType<typeof getTrackingScript>
>
