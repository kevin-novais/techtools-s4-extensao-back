import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { inspect } from "node:util";
import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { ElasticsearchTransport } from "winston-elasticsearch";
import { format as formatTz } from "date-fns-tz";
import { BRAZIL_TIMEZONE, toBrazilianTimezone } from "@/util/date";
import { Config } from "@/config/config";

const { combine, timestamp, printf, colorize, errors, splat, json } = format;

const LOGS_DIR = path.resolve(process.cwd(), "logs");

function ensureLogsDir(): void {
  if (existsSync(LOGS_DIR)) {
    return;
  }

  mkdirSync(LOGS_DIR, { recursive: true });
}

function formatTimestampInBrazil(): string {
  const zonedDate = toBrazilianTimezone(new Date());
  return formatTz(zonedDate, "yyyy-MM-dd HH:mm:ss", { timeZone: BRAZIL_TIMEZONE });
}

function serializeMeta(meta: Record<string, unknown>): string {
  const metaKeys = Object.keys(meta);
  if (!metaKeys.length) {
    return "";
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ` ${inspect(meta, { depth: 5 })}`;
  }
}

function toText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return inspect(value, { depth: 5 });
}

const baseFormat = combine(errors({ stack: true }), splat(), timestamp({ format: formatTimestampInBrazil }));

const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaText = serializeMeta(meta);
  const messageText = stack ? toText(stack) : toText(message);
  return `[${timestamp}] ${level}: ${messageText}${metaText}`;
});

ensureLogsDir();

const rotateTransport = new DailyRotateFile({
  filename: path.join(LOGS_DIR, "application-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  level: Config.LOG_LEVEL,
  maxSize: Config.LOG_MAX_SIZE,
  maxFiles: Config.LOG_MAX_FILES,
  zippedArchive: Config.LOG_ZIPPED_ARCHIVE,
  auditFile: path.join(LOGS_DIR, ".audit.json"),
  format: combine(baseFormat, json()),
});

rotateTransport.on("error", (error) => {
  process.stderr.write(`[logger] rotate transport error: ${String(error)}\n`);
});

const logTransports: any[] = [
  new transports.Console({
    format: combine(baseFormat, colorize(), consoleFormat),
  }),
  rotateTransport,
];

if (Config.ELASTICSEARCH_NODE) {
  const clientOpts: Record<string, unknown> = { node: Config.ELASTICSEARCH_NODE };

  if (Config.ELASTICSEARCH_API_KEY) {
    clientOpts.auth = { apiKey: Config.ELASTICSEARCH_API_KEY };
  } else if (Config.ELASTICSEARCH_USERNAME && Config.ELASTICSEARCH_PASSWORD) {
    clientOpts.auth = { username: Config.ELASTICSEARCH_USERNAME, password: Config.ELASTICSEARCH_PASSWORD };
  }

  const esTransport = new ElasticsearchTransport({
    level: Config.LOG_LEVEL,
    indexPrefix: Config.ELASTICSEARCH_INDEX_PREFIX,
    dataStream: true,
    clientOpts,
  });

  esTransport.on("error", (error) => {
    process.stderr.write(`[logger] elasticsearch transport error: ${String(error)}\n`);
  });

  logTransports.push(esTransport);
}

const log = createLogger({
  level: Config.LOG_LEVEL,
  transports: logTransports,
});

log.on("error", (error) => {
  process.stderr.write(`[logger] internal error: ${String(error)}\n`);
});

export default log;
