import { OmekaConfig } from "./config";
import { DataType, OmekaTemplates, Template } from "./template";
import { Item, Payload, Thing } from "./thing";
import { getLoggerFor } from "./utils";

const logger = getLoggerFor("factory");


export type Property = {
  "@id": string;
  "o:id": number;
  "o:local_name"?: string;
  "o:label": string;
  "o:comment": string;
  "o:term": string;
  dataTypes?: DataType[];
};



export class Factory<T extends Thing> {
  private readonly template: Template;
  readonly config: OmekaConfig;

  constructor(template: Template, config: OmekaConfig) {
    this.template = template;
    this.config = config;
  }

  async get_all(
    templates: OmekaTemplates,
    deep: boolean = false,
  ): Promise<Item<T>[]> {
    const resp = await this.config.get("items", {
      "resource_template_id[]": this.template.id,
    });
    const items = await resp.json();

    const out: Item<T>[] = [];

    for (const item of items) {
      const i = new Item(
        "",
        item["o:id"],
        <Factory<any>>(<unknown>undefined),
        {},
      );
      templates.set_item(i);
      await this.fill_item(item, deep, templates, i);
      out.push(i);
    }

    return out;
  }

  async fill_item(
    json: Thing,
    deep: boolean,
    templates: OmekaTemplates,
    item: Item<T>,
  ): Promise<void> {
    const out: any = <any>{};

    for (const prop of this.template.properties) {
      const values = <Array<Thing>>json[prop["o:term"]];
      if (values === undefined) {
        logger.info("No values defined");
        continue;
      }
      const vs: any[] = [];

      for (let v of values) {
        if (v.type == "literal") {
          vs.push(v["@value"]);
        } else if (v.type == "uri") {
          vs.push(v["@id"]);
        } else if (v.type === "resource:item") {
          if (deep) {
            logger.debug("Deeply looking for value " + v["value_resource_id"]);
            vs.push(await templates.get_item(v["value_resource_id"], deep));
          } else {
            vs.push(v["value_resource_id"]);
          }
        } else {
          logger.error("unsupported type " + v.type, v);
          vs.push(v["@value"]);
        }
      }

      if (vs.length > 1) {
        out[prop["o:term"]] = vs;
      } else {
        out[prop["o:term"]] = vs[0];
      }
    }

    const [item_set_obj ] = json["o:item_set"];
    item.id = json["@id"];
    item.idx = json["o:id"];
    item.factory = this;
    item.item_set = item_set_obj ? item_set_obj["o:id"] : undefined;
    item.item = out;
  }

  async create(item: T, item_set?: number): Promise<Item<T>> {
    const resp = await this.config.post(
      "items",
      this.transformItem(item, item_set),
    );

    const json = <{ [label: string]: any }>await resp.json();

    const [ item_set_obj ] = json["o:item_set"];
    return new Item(
      json["@id"],
      json["o:id"],
      this,
      item,
      item_set_obj ? item_set_obj["o:id"] : undefined,
    );
  }

  transformItem(item: T, item_set?: number): Payload {
    const payload: { [key: string]: any } = {
      "o:resource_template": {
        "o:id": this.template.id,
      },
    };

    if (this.template.class) {
      payload["o:resource_class"] = {
        "o:id": this.template.class,
      };
    }

    if (item_set) {
      payload["o:item_set"] = [item_set];
    }

    for (const prop of this.template.properties) {
      const values = item[prop["o:term"]];
      if (values === undefined) {
        logger.info("No values defined");
        continue;
      }
      const target: any[] = [];
      const isUri = (prop.dataTypes || []).includes("uri");
      const isResource = (prop.dataTypes || []).includes("resource:item");

      for (const value of Array.isArray(values) ? values : [values]) {
        const pay: any = {
          property_id: prop["o:id"],
          type: (prop.dataTypes || [])[0] || "literal",
        };
        if (isResource) {
          if (value instanceof Item) {
            pay.value_resource_id = value.idx;
          } else {
            pay.value_resource_id = value;
          }
        } else if (isUri) {
            pay["@id"] = value;
        } else {
          pay["@value"] = value;
        }

        target.push(pay);
      }

      payload[prop["o:term"]] = target;
    }

    return JSON.stringify(payload);
  }
}
