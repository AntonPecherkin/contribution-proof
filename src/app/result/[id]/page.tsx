import Shell from '../../_ui/shell';
import Result from '../../_ui/result';
export default async function ResultPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  return <Shell back><Result id={id} view={view === 'trends' ? 'trends' : 'card'} /></Shell>;
}
