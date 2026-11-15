import { expect, test } from "@playwright/test";

test("scenario and evidence preserve selections without backend requests", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      requests.push(request.url());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: /Mars Habitat Partial gravity/ })
    .click();
  await expect(
    page.getByRole("slider", { name: "Oxygen", exact: true }),
  ).toHaveValue("26.5");
  await page.getByRole("button", { name: /Nomex \(flame-resistant\)/ }).click();
  await page
    .getByRole("button", { name: "See ranked evidence & alerts" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Evidence for Mars Habitat" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show all 8" }).click();
  await expect(
    page.getByRole("heading", { name: "Partial gravity evidence gap" }),
  ).toBeVisible();
  await page.getByLabel("Fuel type").selectOption("Gas");
  await expect(page.getByRole("button", { name: /ACME CFI-G/ })).toBeVisible();
  await page.getByRole("button", { name: "Suppression", exact: true }).click();
  await expect(
    page.getByText("No investigations match these filters."),
  ).toBeVisible();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Fuel type").selectOption("All fuels");
  await page
    .getByRole("button", { name: "Inside one investigation", exact: true })
    .click();
  await expect(page.getByText("MOCK RUN 01")).toBeVisible();
  await page.getByRole("button", { name: "Edit scenario" }).click();
  await expect(
    page.getByRole("slider", { name: "Oxygen", exact: true }),
  ).toHaveValue("26.5");
  await expect(
    page.getByRole("button", { name: /Nomex \(flame-resistant\)/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(requests).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("Predict & Ask uses scientific APIs, exports observations and displays sourced answers", async ({
  page,
}) => {
  const coverage = {
    spread_mm_s: {
      observations: 4,
      gravity_levels: [0, 1],
      prediction_eligible: true,
      folds: [],
    },
  };
  const dataset = {
    schema_version: 1,
    observations: [
      {
        experiment_id: "software-fixture",
        reviewed: false,
        citation: "Source citation fixture",
        outputs: { spread_mm_s: 1.234 },
      },
    ],
  };
  let received: Record<string, unknown> | undefined;
  await page.route("**/api/ood/status", (route) =>
    route.fulfill({
      json: {
        reason: null,
        reviewed_direct_observations: 4,
        dependencies_ready: true,
        cohorts: [
          {
            fuel: "Fixture fuel",
            configuration: "Fixture configuration",
            temperature_available: false,
            coverage,
          },
        ],
        dataset_sha256: "fixture-hash",
        provenance_counts: { ground: 4 },
      },
    }),
  );
  await page.route("**/api/ood/gravity-sweep", (route) =>
    route.fulfill({
      json: {
        status: "unavailable",
        reason: "Fixture has no curve",
        points: [],
        observations: [],
        unit: "mm/s",
        training_n: 0,
        warning: "Software fixture",
      },
    }),
  );
  await page.route("**/api/ood/predict", (route) => {
    received = route.request().postDataJSON();
    return route.fulfill({
      json: {
        status: "available",
        reason: null,
        model: "gpr",
        dataset_sha256: "fixture-hash",
        results: {
          spread_mm_s: {
            unit: "mm/s",
            mean: 1.234,
            interval: [1, 1.5],
            training_n: 4,
            outside_features: [],
            sources: ["Source citation fixture"],
          },
        },
        unavailable_outputs: {},
      },
    });
  });
  await page.route("**/api/ood/dataset", (route) =>
    route.fulfill({ json: dataset }),
  );
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      json: {
        answer: "Answer returned by the research API.",
        citations: [
          {
            id: "S1",
            title: "A source paper",
            page: 12,
            text: "Source excerpt returned by the API.",
          },
        ],
        limitations: ["Only tested conditions are supported."],
        conflicts: [],
        insufficient_evidence: false,
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Predecir y preguntar/ }).first().click();
  const panel = page.getByRole("region", {
    name: "Predict fire behaviour at gravities never tested",
  });
  await expect(panel.getByText("Reviewed observations loaded")).toBeVisible();
  await expect(panel.getByLabel("Oxygen (%)")).toHaveValue("30");
  await expect(panel.getByLabel("Pressure (kPa)")).toHaveValue("70.3265");
  await expect(panel.getByLabel("Airflow (cm/s)", { exact: true })).toHaveValue(
    "10",
  );
  await panel
    .getByRole("button", { name: "Estimate supported properties" })
    .click();
  await expect(panel.locator(".ood-estimate-value")).toContainText("1.23");
  expect(received).toMatchObject({
    gravity_g: 0.17,
    oxygen_pct: 30,
    pressure_kpa: 70.3265,
    airflow_cm_s: 10,
    fuel: "Fixture fuel",
    configuration: "Fixture configuration",
    data_mode: "reviewed",
  });
  await page
    .getByRole("button", { name: "Extract clean data", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download observations JSON" })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("combustion-observations.json");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(dataset);
  await page.getByRole("button", { name: "Ask Copilot", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Ask Copilot" })
    .fill("Why does gravity matter?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(
    page.getByText("Answer returned by the research API."),
  ).toBeVisible();
  await page.getByText("S1 · A source paper · p. 12").click();
  await expect(
    page.getByText("Source excerpt returned by the API."),
  ).toBeVisible();
  await expect(
    page.getByText("Only tested conditions are supported."),
  ).toBeVisible();
  await expect(
    page.getByText(/Mock Copilot|MOCK PREDICTION|Download mock CSV/),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("Predict & Ask reports service failures without fabricating data", async ({
  page,
}) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { message: "Scientific backend unavailable" } },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /Predecir y preguntar/ }).first().click();
  await expect(page.locator(".ood-panel").getByRole("alert")).toContainText(
    "Scientific backend unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Estimate supported properties" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Ask Copilot", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Ask Copilot" })
    .fill("Explain flame spread");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.locator(".sf-predict > .alert")).toContainText(
    "Scientific backend unavailable",
  );
  await expect(page.locator(".sf-answer")).toHaveCount(0);
});
