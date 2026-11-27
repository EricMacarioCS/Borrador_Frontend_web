/** Buscador en ventana para pantallas angostas. Usa el mismo componente que el encabezado. */
import BaseDialog from '@/shared/ui/BaseDialog'
import SearchBox from './SearchBox'

export default function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BaseDialog open={open} label="Buscar películas o cines" onClose={onClose} header={<h2>Buscar</h2>}>
      {open && <SearchBox mode="panel" onDone={onClose} />}
    </BaseDialog>
  )
}
