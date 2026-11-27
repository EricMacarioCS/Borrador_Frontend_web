import { useMemo } from 'react'
import { useAppStore } from '@/app/stores/app'
import { serverNow } from '@/shared/lib/clock'
import { addDays, dateInZone, DEFAULT_TIME_ZONE } from '@/shared/lib/datetime'

/** Días de cartelera según el reloj del servidor y la zona del complejo, no del dispositivo. */
export function useScheduleDays() {
  const timeZone = useAppStore(state => state.primaryComplex?.timeZone ?? DEFAULT_TIME_ZONE)
  const scheduleDays = useAppStore(state => state.limits.scheduleDays)
  const today = dateInZone(new Date(serverNow()), timeZone)
  const days = useMemo(() => Array.from({ length: scheduleDays }, (_, i) => addDays(today, i)), [today, scheduleDays])
  return { today, days, timeZone }
}
