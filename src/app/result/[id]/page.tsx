import Shell from '../../_ui/shell';
import Result from '../../_ui/result';
export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <Shell back><Result id={id} /></Shell>; }
