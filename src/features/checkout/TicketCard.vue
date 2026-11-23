<script setup lang="ts">
/** Entrada digital. El QR usa la credencial de acceso del servidor, no el folio. */
import type { Purchase } from '@/domain/models'
import QrCode from '@/shared/ui/QrCode.vue'
import { formatDateTime } from '@/shared/lib/datetime'
import { formatMoney } from '@/shared/lib/money'
import { PICKUP_LABELS } from '@/domain/labels'
import { useAppStore } from '@/app/stores/app'

defineProps<{ purchase: Purchase }>()
const app = useAppStore()
</script>

<template>
  <article class="ticket">
    <div v-if="purchase.admissionToken && purchase.status === 'confirmed'" class="qr">
      <QrCode :value="`CPA1:${purchase.admissionToken}`" :label="`Código de acceso de la compra ${purchase.ticketCode ?? ''}`" />
      <small>Muéstralo en la entrada</small>
    </div>
    <div class="detail">
      <span class="eyebrow">{{ purchase.screening ? 'Entrada digital' : 'Pedido de dulcería' }}</span>
      <h2>{{ purchase.screening?.movieTitle ?? purchase.complex.name }}</h2>
      <template v-if="purchase.screening">
        <p>{{ purchase.complex.name }}</p>
        <p>{{ formatDateTime(purchase.screening.startsAt, app.complexById(purchase.complex.id)?.timeZone) }}</p>
        <p>{{ purchase.screening.room }} · {{ purchase.screening.roomType }} · {{ purchase.screening.projection }} · {{ purchase.screening.language }}</p>
        <p class="seats">Asientos: <strong>{{ purchase.tickets.map(ticket => `${ticket.seatLabel} (${ticket.ticketType})`).join(', ') }}</strong></p>
      </template>
      <div v-if="purchase.items.length" class="items">
        <strong>Alimentos{{ purchase.pickup ? ` · ${PICKUP_LABELS[purchase.pickup]}` : '' }}</strong>
        <ul role="list">
          <li v-for="(item, index) in purchase.items" :key="index">{{ item.quantity }} × {{ item.name }}<small v-if="item.detail"> · {{ item.detail }}</small></li>
        </ul>
      </div>
      <p v-if="purchase.linkedTicketCode" class="muted">Vinculado al folio {{ purchase.linkedTicketCode }}.</p>
      <p class="total">Total: <strong>{{ formatMoney(purchase.totals.totalCents) }}</strong></p>
      <p v-if="purchase.ticketCode" class="code">Folio <strong>{{ purchase.ticketCode }}</strong></p>
      <p v-else-if="purchase.linkedTicketCode" class="muted small">Recoge mostrando el folio de tus boletos.</p>
      <p v-else class="muted small">Recoge con el nombre y correo de la compra.</p>
    </div>
  </article>
</template>

<style scoped>
.ticket { position: relative; display: flex; gap: 24px; padding: 22px; border: 1px solid var(--line); border-radius: var(--radius-l); background: #fff; box-shadow: var(--shadow-card); }
.ticket::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 6px; border-radius: var(--radius-l) 0 0 var(--radius-l); background: var(--grad-action); }
.qr { width: 170px; flex-shrink: 0; display: grid; gap: 6px; justify-items: center; text-align: center; }
.qr small { color: var(--muted); font-size: 12px; }
.detail { min-width: 0; display: grid; gap: 4px; align-content: start; }
.detail h2 { margin: 4px 0; font: 800 22px var(--font-title); }
.detail p { color: var(--muted); font-size: 14px; }
.seats strong { color: var(--ink); }
.items { margin-top: 8px; font-size: 14px; }
.items ul { margin-top: 4px; padding-left: 18px; color: var(--muted); }
.total { margin-top: 6px; }
.total strong { color: var(--ink); }
.code { margin-top: 6px; font-size: 15px !important; }
.code strong { color: var(--blue); font: 800 18px var(--font-title); letter-spacing: .04em; overflow-wrap: anywhere; }
.small { font-size: 13px; }
@media (max-width: 560px) {
  .ticket { flex-direction: column; align-items: center; text-align: center; }
  .items ul { padding-left: 0; list-style: none; }
}
</style>
