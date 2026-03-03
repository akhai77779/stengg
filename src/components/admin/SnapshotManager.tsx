import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Save,
  RotateCcw,
  Trash2,
  Pencil,
  Check,
  X,
  Database,
  Clock,
} from 'lucide-react';
import { NamedSnapshot } from '@/lib/market-engine/types';
import { MAX_NAMED_SNAPSHOTS } from '@/lib/market-engine/types';
import { toast } from 'sonner';

interface SnapshotManagerProps {
  namedSnapshots: NamedSnapshot[];
  onSave: (name: string) => unknown;
  onRestore: (id: string) => boolean;
  onDelete: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

export function SnapshotManager({
  namedSnapshots,
  onSave,
  onRestore,
  onDelete,
  onRename,
}: SnapshotManagerProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleSave = () => {
    const name = newName.trim();
    if (!name) {
      toast.error('Vui lòng nhập tên snapshot');
      return;
    }
    const result = onSave(name);
    if (result) {
      toast.success(`Đã lưu snapshot "${name}"`);
      setNewName('');
    } else {
      toast.error('Lưu snapshot thất bại');
    }
  };

  const handleRestore = (snap: NamedSnapshot) => {
    if (!confirm(`Khôi phục snapshot "${snap.name}"? Dữ liệu hiện tại sẽ bị thay thế.`)) return;
    const ok = onRestore(snap.id);
    if (ok) {
      toast.success(`Đã khôi phục "${snap.name}"`);
    } else {
      toast.error('Khôi phục thất bại');
    }
  };

  const handleDelete = (snap: NamedSnapshot) => {
    if (!confirm(`Xóa snapshot "${snap.name}"?`)) return;
    onDelete(snap.id);
    toast.success(`Đã xóa "${snap.name}"`);
  };

  const startEdit = (snap: NamedSnapshot) => {
    setEditingId(snap.id);
    setEditName(snap.name);
  };

  const confirmEdit = () => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
      toast.success('Đã đổi tên snapshot');
    }
    setEditingId(null);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="border rounded-lg bg-card">
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Snapshots</h3>
        </div>
        <Badge variant="outline" className="text-xs">
          {namedSnapshots.length}/{MAX_NAMED_SNAPSHOTS}
        </Badge>
      </div>

      {/* Save new */}
      <div className="p-3 border-b flex gap-2">
        <Input
          placeholder="Tên snapshot..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="h-8 text-sm"
        />
        <Button size="sm" className="h-8 gap-1.5 shrink-0" onClick={handleSave}>
          <Save className="w-3.5 h-3.5" />
          Lưu
        </Button>
      </div>

      {/* List */}
      <ScrollArea className="max-h-60">
        {namedSnapshots.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Chưa có snapshot nào
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {namedSnapshots.map(snap => (
              <div
                key={snap.id}
                className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  {editingId === snap.id ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && confirmEdit()}
                        className="h-6 text-xs"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={confirmEdit}>
                        <Check className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground truncate">{snap.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(snap.createdAt)}
                      </p>
                    </>
                  )}
                </div>
                {editingId !== snap.id && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-primary hover:text-primary"
                      onClick={() => handleRestore(snap)}
                      title="Khôi phục"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7"
                      onClick={() => startEdit(snap)}
                      title="Đổi tên"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(snap)}
                      title="Xóa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
