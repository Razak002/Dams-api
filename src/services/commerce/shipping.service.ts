import { ShippingSettings } from '../../models/shipping-settings.model.js'

export const FREE_SHIPPING_THRESHOLD = 150_000

const normalizeState = (state: string) => state.trim().toLowerCase()

const isAbujaAlias = (normalized: string) =>
  normalized === 'abuja' || normalized === 'abuja (fct)' || normalized === 'fct'

export const getShippingSettings = async () => {
  return ShippingSettings.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { new: true, upsert: true }
  )
}

export const updateShippingSettings = async (input: {
  freeShippingThreshold?: number
  defaultNationwideFee?: number
  defaultNationwideEta?: string
  stateRates?: { state: string; fee: number; estimatedDelivery: string }[]
}) => {
  const settings = await getShippingSettings()

  if (input.freeShippingThreshold !== undefined) {
    settings.freeShippingThreshold = input.freeShippingThreshold
  }
  if (input.defaultNationwideFee !== undefined) {
    settings.defaultNationwideFee = input.defaultNationwideFee
  }
  if (input.defaultNationwideEta !== undefined) {
    settings.defaultNationwideEta = input.defaultNationwideEta
  }
  if (input.stateRates !== undefined) {
    settings.set('stateRates', input.stateRates)
  }

  await settings.save()
  return settings
}

export const calculateShippingRate = async (state: string, subtotal: number) => {
  const settings = await getShippingSettings()
  const normalized = normalizeState(state)

  const matchedState = settings.stateRates.find((entry) => {
    const entryNorm = normalizeState(entry.state)
    if (entryNorm === normalized) return true
    return isAbujaAlias(normalized) && isAbujaAlias(entryNorm)
  })

  const isComplimentary = subtotal >= settings.freeShippingThreshold
  const baseFee = matchedState ? matchedState.fee : settings.defaultNationwideFee
  const estimatedDelivery = matchedState
    ? matchedState.estimatedDelivery
    : settings.defaultNationwideEta

  return {
    state,
    shippingFee: isComplimentary ? 0 : baseFee,
    freeShippingThreshold: settings.freeShippingThreshold,
    isComplimentary,
    estimatedDelivery,
  }
}
