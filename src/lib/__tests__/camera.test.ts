import { describe, expect, it } from 'vitest'
import { pickRearDeviceIndex } from '../camera'

const makeDevice = (deviceId: string, label: string): MediaDeviceInfo =>
  ({
    deviceId,
    label,
    kind: 'videoinput' as const,
    groupId: '',
    toJSON: () => ({}),
  }) as MediaDeviceInfo

describe('pickRearDeviceIndex', () => {
  const front = makeDevice('front-id', 'Front Camera')
  const rear = makeDevice('rear-id', 'Back Camera (environment)')
  const extra = makeDevice('extra-id', 'Extra Camera')

  it('prefers the device matching preferredDeviceId', () => {
    expect(pickRearDeviceIndex([front, rear, extra], 'rear-id')).toBe(1)
  })

  it('falls back to label search when preferredDeviceId is empty', () => {
    expect(pickRearDeviceIndex([front, rear, extra], '')).toBe(1)
  })

  it('falls back to index 0 when no rear label and no preferred id', () => {
    const devices = [makeDevice('a', 'Camera A'), makeDevice('b', 'Camera B')]
    expect(pickRearDeviceIndex(devices, '')).toBe(0)
  })

  it('matches "back" label case-insensitively', () => {
    const devices = [makeDevice('x', 'BACK CAM'), makeDevice('y', 'Front')]
    expect(pickRearDeviceIndex(devices, '')).toBe(0)
  })

  it('matches "environment" label case-insensitively', () => {
    const devices = [makeDevice('x', 'Front'), makeDevice('y', 'Environment')]
    expect(pickRearDeviceIndex(devices, '')).toBe(1)
  })

  it('matches "rear" label case-insensitively', () => {
    const devices = [makeDevice('x', 'Front'), makeDevice('y', 'Rear Wide')]
    expect(pickRearDeviceIndex(devices, '')).toBe(1)
  })

  it('preferredDeviceId takes priority over label match', () => {
    // front matches by id, rear matches by label — id wins
    expect(pickRearDeviceIndex([front, rear, extra], 'front-id')).toBe(0)
  })
})
