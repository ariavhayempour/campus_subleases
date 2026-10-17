import type { MessageView } from '@/lib/messaging-options';

export function mergeMessages(current: MessageView[], incoming: MessageView[]): MessageView[] {
  const known = new Set(current.map((message) => message.id));
  const added = incoming.filter((message) => {
    if (known.has(message.id)) return false;
    known.add(message.id);
    return true;
  });
  if (added.length === 0) return current;
  return [...current, ...added].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}
