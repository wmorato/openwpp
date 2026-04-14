export function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'WA';
}

export function formatChatListTime(timestamp: number) {
  if (!timestamp) return '';

  const date = new Date(timestamp * 1000);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

export function formatMessageDateTime(timestamp: number) {
  if (!timestamp) return 'Sem data';

  return new Date(timestamp * 1000).toLocaleString([], {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateDivider(timestamp: number) {
  if (!timestamp) return 'Sem data';

  return new Date(timestamp * 1000).toLocaleDateString([], {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export const EMOJIS = Array.from(new Set([
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😮',
  '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢',
  '😭', '😱', '😖', '😣', '😓', '😩', '😫', '🥱', '😤',
  '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹',
  '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼',
  '😽', '🙀', '😿', '😾', '🙈', '🙉', '🙊', '💋', '💌', '💘',
  '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️',
  '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💯', '💢',
  '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️',
  '💭', '💤'
]));
