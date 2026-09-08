import Shell from '../../_ui/shell';
import Journey from '../../_ui/journey';
export default async function Analyzing({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <Shell back><Journey id={id} /></Shell>; }
