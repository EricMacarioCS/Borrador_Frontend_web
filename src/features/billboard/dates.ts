import { computed } from 'vue'
import { useAppStore } from '@/app/stores/app'
import { serverNow } from '@/shared/lib/clock'
import { addDays, dateInZone, DEFAULT_TIME_ZONE } from '@/shared/lib/datetime'

/** Días de cartelera según el reloj del servidor y la zona del complejo, no del dispositivo. */
export function useScheduleDays() {
  const app = useAppStore()
  const timeZone = computed(() => app.primaryComplex?.timeZone ?? DEFAULT_TIME_ZONE)
  const today = computed(() => dateInZone(new Date(serverNow()), timeZone.value))
  const days = computed(() => Array.from({ length: app.limits.scheduleDays }, (_, i) => addDays(today.value, i)))
  return { today, days, timeZone }
}
