/**
 * Given a list of video input devices and the deviceId the browser chose for
 * the 'environment' facing mode, returns the index of the best device to start
 * with. Preference order:
 *   1. Device whose deviceId matches the browser's environment-facing choice.
 *   2. First device whose label contains "back", "rear", or "environment".
 *   3. Index 0 (fallback).
 */
export function pickRearDeviceIndex(
  devices: Array<MediaDeviceInfo>,
  preferredDeviceId: string,
): number {
  let index = preferredDeviceId
    ? devices.findIndex((d) => d.deviceId === preferredDeviceId)
    : -1
  if (index < 0)
    index = devices.findIndex((d) => /back|rear|environment/i.test(d.label))
  if (index < 0) index = 0
  return index
}
