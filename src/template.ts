import { OmekaConfig } from "./config";
import { Factory, Property } from "./factory";
import { Item } from "./thing";
import { findNextUrl, getLoggerFor } from "./utils";

const logger = getLoggerFor("template");
export type Template = {
  id: number;
  label: string;
  class?: number;

  properties: Property[];
};
export type DataType = "uri" | "resource:item";
export type TemplateResponse = {
  "o:id": number;
  "o:label": string;
  "o:resource_class"?: {
    "@id": string;
    "o:id": number;
  };
  "o:resource_template_property": {
    "o:property": {
      "@id": string;
      "o:id": number;
    };
    "o:data_type"?: DataType[];
    "o:is_required": boolean;
  }[];
};

export class OmekaTemplates {
  private readonly config: OmekaConfig;
  readonly templates: {
    [id: number]: Template;
  } = {};
  private partial_loaded = false;
  readonly partial_templates: { [id: number]: TemplateResponse } = {};
  readonly properties: {
    [id: number]: Property;
  } = {};

  readonly items: {
    [id: number]: Item<any>;
  } = {};
  constructor(config: OmekaConfig) {
    this.config = config;
  }

  async preload_property(url: string): Promise<void> {
    logger.info("Preloading properties: " + url);
    const resp = await this.config.fetch_f(url);
    const next = findNextUrl(resp);
    const promise = next ? this.preload_property(next) : Promise.resolve();
    const json: Property[] = await resp.json();
    for (const prop of json) {
      this.properties[prop["o:id"]] = prop;
    }
    await promise;
  }

  async preload_properties(): Promise<void> {
    await this.preload_property(this.config.url("properties"));
  }

  async get_property(id: number): Promise<Property> {
    logger.debug("Get property " + id);
    if (this.properties[id]) return this.properties[id];
    const resp = await this.config.get(`properties/${id}`);
    const prop: Property = await resp.json();
    this.properties[prop["o:id"]] = prop;
    return prop;
  }

  async transform_template(temp: TemplateResponse): Promise<Template> {
    const classObj = temp["o:resource_class"];
    const template: Template = {
      id: temp["o:id"],
      label: temp["o:label"],
      class: classObj ? classObj["o:id"] : undefined,
      properties: [],
    };

    for (const prop of temp["o:resource_template_property"]) {
      logger.info("Finding property " + JSON.stringify(prop));
      const newProp = await this.get_property(prop["o:property"]["o:id"]);
      newProp.dataTypes = prop["o:data_type"];
      template.properties.push(newProp);
    }
    return template;
  }

  async preload_partial_templates(): Promise<void> {
    this.partial_loaded = true;
    let url: string | undefined = this.config.url("resource_templates");
    while (!!url) {
      const resp = await this.config.fetch_f(url);
      url = findNextUrl(resp);
      const json: TemplateResponse[] = await resp.json();

      for (const temp of json) {
        this.partial_templates[temp["o:id"]] = temp;
      }
    }
  }

  async preload_templates(): Promise<void> {
    this.partial_loaded = true;
    logger.info("Preloading templates");
    let url: string | undefined = this.config.url("resource_templates");
    while (!!url) {
      const resp = await this.config.fetch_f(url);
      url = findNextUrl(resp);
      const json: TemplateResponse[] = await resp.json();

      for (const temp of json) {
        this.partial_templates[temp["o:id"]] = temp;
        logger.info("Preloading template " + JSON.stringify(temp));
        const template = await this.transform_template(temp);
        this.templates[template.id] = template;
      }
    }
  }

  async get_template(id: number): Promise<Template> {
    logger.info("Get template " + id);
    if (this.templates[id]) return this.templates[id];
    const resp = await this.config.get(`resource_templates/${id}`);
    const temp: TemplateResponse = await resp.json();
    const template = await this.transform_template(temp);
    this.templates[template.id] = template;
    return template;
  }

  async get_template_by_name(name: string): Promise<Template | undefined> {
    if (!this.partial_loaded) {
      throw "Can only get template by name if the templates are at least partially loaded";
    }

    for (const partial of Object.values(this.partial_templates)) {
      if (partial["o:label"] == name) {
        return await this.get_template(partial["o:id"]);
      }
    }
  }

  async get_item(id: number, deep = false): Promise<Item<any>> {
    if (this.items[id]) return this.items[id];
    const item = new Item("", 0, <Factory<any>>(<unknown>undefined), {});
    this.items[id] = item;

    const resp = await this.config.get(`items/${id}`);
    const json = await resp.json();

    const template = await this.get_template(
      json["o:resource_template"]["o:id"],
    );

    const factory = new Factory(template, this.config);
    await factory.fill_item(json, deep, this, item);
    return item;
  }

  set_item(item: Item<any>) {
    this.items[item.idx] = item;
  }
}
