import Shell from '../../_ui/shell';
import EntryForm from '../../_ui/forms';
export default async function Register({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <Shell back><EntryForm id={id} /></Shell>; }
