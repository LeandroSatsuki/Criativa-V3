
type LogEntry = {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warn';
};

class LogService {
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];

  addLog(message: string, type: 'info' | 'error' | 'success' | 'warn' = 'info') {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      message,
      type
    };
    this.logs = [entry, ...this.logs].slice(0, 50); // Keep last 50 logs
    this.notify();
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  getLogs() {
    return this.logs;
  }

  subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l(this.logs));
  }

  clear() {
    this.logs = [];
    this.notify();
  }
}

export const logService = new LogService();
