import fs from 'fs';
import path from 'path';

const LOG_DIR = path.resolve(process.cwd(), 'logs');

export const ensureLogDir = () => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
};

export const createConversationLogger = (conversationId) => {
  ensureLogDir();

  const entries = [];
  const timestamp = new Date().toISOString().replace(/[:]/g, '-');
  const safeConversationId = conversationId?.replace(/[^a-zA-Z0-9-_]/g, '_');
  const fileName = `${timestamp}-${safeConversationId || 'unknown'}.txt`;
  const filePath = path.join(LOG_DIR, fileName);

  return {
    push(entry) {
      entries.push({
        speaker: entry.speaker ?? 'unknown',
        text: entry.text ?? '',
        timestamp: entry.timestamp ?? Date.now(),
      });
    },
    async persist() {
      if (!entries.length) {
        return null;
      }

      const lines = entries.map((entry) => {
        const lineTs =
          typeof entry.timestamp === 'string'
            ? entry.timestamp
            : new Date(entry.timestamp).toISOString();
        return `[${lineTs}] ${entry.speaker}: ${entry.text}`;
      });

      await fs.promises.writeFile(filePath, lines.join('\n') + '\n', 'utf8');
      return filePath;
    },
  };
};
