import { Factory, Item, OmekaConfig, OmekaTemplates } from "../src";
import { describe, expect, test } from "vitest";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

describe("log", () => {
  test("successful", { timeout: 20000 }, async () => {
    const config = new OmekaConfig({
      api: "https://heron.libis.be/momu-test/api",
      fetch_f: fetch,
    });
    const templates = new OmekaTemplates(config);

    await templates.preload_properties();
    await templates.preload_templates();

    expect(Object.keys(templates.templates).length).toBeGreaterThan(0);
  });

  test("partial load", { timeout: 20000 }, async () => {
    const config = new OmekaConfig({
      api: "https://heron.libis.be/momu-test/api",
      fetch_f: fetch,
      key_credential: process.env.OMEKA_KEY,
      key_identity: process.env.OMEKA_ID,
    });
    const templates = new OmekaTemplates(config);
    await templates.preload_partial_templates();

    // Fetch the templates
    const deviceTemplate = await templates.get_template_by_name(
      "datalogger (sensor device)",
    );
    const channelTemplate = await templates.get_template_by_name(
      "datalogger (sensor channel)",
    );

    // Create a factory based on the templates
    const deviceFactory = new Factory(deviceTemplate!, config);
    // Create a device with the factory
    const newDevice = await deviceFactory.create(
      {
        "dcterms:title": "epic newest device",
      },
      34042, // item set
    );
    expect(newDevice).toBeDefined();

    const sensorFactory = new Factory(channelTemplate!, config);
    const newSensor = await sensorFactory.create(
      {
        "dcterms:title": "epic newest title",
        "dcterms:isPartOf": newDevice, // Link to this new device
      },
      34042, // item set
    );

    expect(newSensor).toBeDefined();
  });

  test("Get single item", { timeout: 20000 }, async () => {
    const config = new OmekaConfig({
      api: "https://heron.libis.be/momu-test/api",
      fetch_f: fetch,
    });
    const templates = new OmekaTemplates(config);
    const o = await templates.get_item(34009, true);
    expect(o.item["dcterms:title"]).toEqual("node-007-temp");
    expect(o.item["sosa:isHostedBy"]).toBeInstanceOf(Item);
  });

  test("Get items of template", { timeout: 20000 }, async () => {
    const config = new OmekaConfig({
      api: "https://heron.libis.be/momu-test/api",
      fetch_f: fetch,
    });
    const templates = new OmekaTemplates(config);
    await templates.preload_partial_templates();
    const channelTemplate = await templates.get_template_by_name(
      "datalogger (sensor channel)",
    );

    const factory = new Factory(channelTemplate!, config);
    const items = await factory.get_all(templates, false);

    expect(items.length).toBeGreaterThan(0);
  });

  test("Save single item", { timeout: 20000 }, async () => {
    const config = new OmekaConfig({
      api: "https://heron.libis.be/momu-test/api",
      fetch_f: fetch,
      key_credential: process.env.OMEKA_KEY,
      key_identity: process.env.OMEKA_ID,
    });
    const templates = new OmekaTemplates(config);
    await templates.preload_partial_templates();

    const deviceTemplate = await templates.get_template_by_name(
      "datalogger (sensor device)",
    );
    const deviceFactory = new Factory(deviceTemplate!, config);
    // Create a device with the factory
    const newDevice = await deviceFactory.create(
      {
        "dcterms:title": "epic new device",
      },
      34042, // item set
    );

    newDevice.item["dcterms:title"] = "epic newest device!";
    await newDevice.save();

    delete templates.items[newDevice.idx];
    const deviceCheck = await templates.get_item(newDevice.idx, false);
    expect(deviceCheck.item["dcterms:title"]).toEqual("epic newest device!");
    expect(deviceCheck.item_set).toBeDefined();
  });

  test("env works", () => {
    const config = new OmekaConfig({
      api: "https://heron.libis.be/momu-test/api",
      fetch_f: fetch,
      key_credential: process.env.OMEKA_KEY,
      key_identity: process.env.OMEKA_ID,
    });
    console.log(config);
    expect(config.key_identity).toBeDefined();
  });
});
