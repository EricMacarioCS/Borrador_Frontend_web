import { useEffect } from 'react'
import { useParams } from 'react-router'
import StateView from '@/shared/ui/StateView'
import { usePage } from '@/app/queries'
import styles from './InfoPageView.module.css'

export default function InfoPageView() {
  const { slug = '' } = useParams()
  const page = usePage(slug)
  const title = page.data?.title
  useEffect(() => {
    if (title) document.title = `${title} · Cinépolis`
  }, [title])

  return (
    <div className={`container page ${styles.narrow}`}>
      <StateView loading={page.isPending} error={page.error} skeleton="rows" onRetry={() => void page.refetch()}>
        {page.data && (
          <>
            <h1 className="page-title">{page.data.title}</h1>
            {page.data.paragraphs.map((paragraph, index) => <p key={index} className={styles.paragraph}>{paragraph}</p>)}
          </>
        )}
      </StateView>
    </div>
  )
}
