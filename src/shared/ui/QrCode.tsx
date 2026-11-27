import { useMemo } from 'react'
import { QR_SIZE, qrPath } from '@/shared/lib/qr'

const box = QR_SIZE + 8

export default function QrCode({ value, label }: { value: string; label: string }) {
  const path = useMemo(() => qrPath(value), [value])
  return (
    <svg viewBox={`0 0 ${box} ${box}`} role="img" aria-label={label} shapeRendering="crispEdges"
      style={{ width: '100%', height: 'auto', aspectRatio: 1, borderRadius: 8 }}>
      <rect width={box} height={box} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}
