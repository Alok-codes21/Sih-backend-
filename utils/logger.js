/**
 * Structured JSON logger with Error instance serialization.
 */
export const logger = {
  log: (level, message, metadata = {}) => {
    // Serialize Error instances in metadata so stack/message aren't lost
    const safeMeta = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value instanceof Error) {
        safeMeta[key] = { message: value.message, stack: value.stack, name: value.name };
      } else {
        safeMeta[key] = value;
      }
    }

    const logObj = {
      timestamp: new Date().toISOString(),
      level,
      message,
      pid: process.pid,
      ...safeMeta
    };
    process.stdout.write(JSON.stringify(logObj) + '\n');
  },
  info: (message, metadata) => logger.log('info', message, metadata),
  warn: (message, metadata) => logger.log('warn', message, metadata),
  error: (message, metadata) => logger.log('error', message, metadata),
  debug: (message, metadata) => {
    if (process.env.NODE_ENV === 'development') {
      logger.log('debug', message, metadata);
    }
  }
};
