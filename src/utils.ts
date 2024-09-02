export interface Link {
  target: string;
  url: string;
}

export function extract_links(headers: Headers): Link[] {
  // link = </ingest/?index=1514>; rel="next", </ingest/?index=1512>; rel="prev"
  const link = headers.get("link");
  if (!link) return [];

  const out: Link[] = [];

  for (let l of link.split(",")) {
    let [key, val] = l.split(";");
    if (!key || !val) continue;

    const url = key.trim().slice(1, -1);
    const [val_key, val_val] = val.split("=");

    if (!val_key || !val_val) continue;
    if (val_key.trim().toLowerCase() !== "rel") continue;
    const target = val_val.trim().slice(1, -1);

    out.push({ target, url });
  }

  return out;
}

export function findNextUrl(resp: Response): string | undefined {
  const startingUrl = new URL(resp.url);
  const links = extract_links(resp.headers);

  const next = links.find((x) => x.target === "next");
  if (next) {
    // Found next url
    const url_url = new URL(
      next.url,
      `${startingUrl.protocol}//${startingUrl.host}`,
    );
    return url_url.href;
  }
}

import winston, { format, Logger } from "winston";

const PROCESSOR_NAME = "omeka-s";

const consoleTransport = new winston.transports.Console();
consoleTransport.level =
  process.env.LOG_LEVEL ||
  process.env.DEBUG?.includes(PROCESSOR_NAME) ||
  process.env.DEBUG === "*"
    ? "debug"
    : "info";

const classLoggers = new WeakMap<Instance, Logger>();

export function getLoggerFor(loggable: string | Instance): Logger {
  let logger: Logger;
  if (typeof loggable === "string") {
    logger = createLogger(loggable);
  } else {
    const { constructor } = loggable;
    if (classLoggers.has(loggable)) {
      logger = classLoggers.get(loggable)!;
    } else {
      logger = createLogger(constructor.name);
      classLoggers.set(loggable, logger);
    }
  }
  return logger;
}

function createLogger(label: string): Logger {
  return winston.createLogger({
    format: format.combine(
      format.label({ label }),
      format.colorize(),
      format.timestamp(),
      format.metadata({
        fillExcept: ["level", "timestamp", "label", "message"],
      }),
      format.printf(
        ({
          level: levelInner,
          message,
          label: labelInner,
          timestamp,
        }): string =>
          `${timestamp} {${PROCESSOR_NAME}} [${labelInner}] ${levelInner}: ${message}`,
      ),
    ),
    transports: [consoleTransport],
  });
}

/**
 * Any class constructor.
 */
interface Constructor {
  name: string;
}

/**
 * Any class instance.
 */
interface Instance {
  constructor: Constructor;
}
