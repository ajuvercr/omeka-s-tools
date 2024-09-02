import { getLoggerFor } from "./utils";

const logger = getLoggerFor("config");

export class OmekaConfig {
  api: string;
  fetch_f: typeof fetch;
  key_identity?: string;
  key_credential?: string;

  constructor(things: {
    api: string;
    fetch_f?: typeof fetch;
    key_identity?: string;
    key_credential?: string;
  }) {
    this.api = things.api;
    this.fetch_f = things.fetch_f || fetch;
    this.key_identity = things.key_identity;
    this.key_credential = things.key_credential;
  }

  url(path: string, query?: {}): string {
    const theseHeaders = Object.assign({}, query, {
      key_identity: this.key_identity,
      key_credential: this.key_credential,
    });
    const search = Object.entries(theseHeaders)
      .map(([key, header]) => `${key}=${header}`)
      .join("&");

    if (search) {
      return `${this.api}/${path}?${search}`;
    } else {
      return `${this.api}/${path}`;
    }
  }

  async get(path: string, query?: {}): ReturnType<typeof fetch> {
    const url = this.url(path, query);
    logger.debug(`GET ${url}`);
    const resp = await this.fetch_f(url);
    logger.debug(`Response ${resp.status} ${resp.statusText}`);
    return resp;
  }

  async post(
    path: string,
    content: string,
    query?: {},
  ): ReturnType<typeof fetch> {
    const url = this.url(path, query);
    logger.debug(`POST to ${url} (payload ${content})`);
    const resp = await this.fetch_f(url, {
      body: content,
      method: "POST",
      headers: { "Content-Type": "application/ld+json" },
    });
    logger.debug(`Response ${resp.status} ${resp.statusText}`);
    return resp;
  }

  async put(
    path: string,
    content: string,
    query?: {},
  ): ReturnType<typeof fetch> {
    const url = this.url(path, query);
    logger.debug(`PUT to ${url}\n(payload ${content})`);
    const resp = await this.fetch_f(url, {
      body: content,
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    });
    logger.debug(`Response ${resp.status} ${resp.statusText}`);
    return resp;
  }
}
