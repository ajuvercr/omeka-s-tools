import { Factory } from "./factory";

export type Payload = string;
export type Thing = { [label: string]: any };
export class Item<T extends Thing> {
  id: string;
  idx: number;
  item_set?: number;
  factory: Factory<T>;
  item: T;

  constructor(
    id: string,
    idx: number,
    factory: Factory<T>,
    item: T,
    item_set?: number,
  ) {
    this.id = id;
    this.idx = idx;
    this.factory = factory;
    this.item = item;
    this.item_set = item_set;
  }

  async save() {
    const payload = this.factory.transformItem(this.item, this.item_set);
    const resp = await this.factory.config.put("items/" + this.idx, payload);
    <{ [label: string]: any }>await resp.json();
  }
}
