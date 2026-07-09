import { test, expect, type Page, type Route } from "@playwright/test";

type AdminOrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

interface AdminOrderRecord {
  id: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  total: number;
  status: AdminOrderStatus;
  source: "WEB" | "POS";
  originator: "CUSTOMER" | "SELLER";
  createdAt: string;
  updatedAt: string;
  trackingCode?: string;
  trackingCarrier?: string;
}

interface ResendRequestContract {
  method: string;
  orderId: string;
  emailTypes: string[];
  idempotencyKey: string;
  csrfToken: string | undefined;
  tenant: string | null;
}

interface MockAdminOrdersState {
  resendRequests: ResendRequestContract[];
  getTimelineRequestCount: (orderId: string) => number;
  getLastOrdersQuery: () => { search: string; status: string };
}

const ADMIN_ORDERS_URL = "/admin/orders?tenant=test";
const ADMIN_LOGIN_URL = "/admin/login?tenant=test";
const TEST_CSRF_VALUE = ["playwright", "admin", "orders", "test"].join("-");
const E2E_ORIGIN = process.env.PLAYWRIGHT_E2E_ORIGIN ?? "http://localhost:3000";

test.describe("Admin orders API contract zonder mocks", () => {
  test("GET /api/admin/orders blijft fail-closed zonder admin sessie", async ({
    request,
  }) => {
    const response = await request.get(
      `${E2E_ORIGIN}/api/admin/orders?tenant=test`,
      {
        failOnStatusCode: false,
        headers: {
          "X-Tenant-ID": "test",
        },
      },
    );

    expect([401, 403]).toContain(response.status());
  });
});

function createOrders(): AdminOrderRecord[] {
  return [
    {
      id: "db-order-1",
      orderId: "ORD-1001",
      customerName: "Sjoerd Overdiep",
      customerEmail: "sjoerd@example.com",
      total: 4595,
      status: "pending",
      source: "WEB",
      originator: "CUSTOMER",
      createdAt: "2026-03-21T09:00:00.000Z",
      updatedAt: "2026-03-21T09:00:00.000Z",
    },
    {
      id: "db-order-2",
      orderId: "ORD-1002",
      customerName: "Mila Jansen",
      customerEmail: "mila@example.com",
      total: 12995,
      status: "processing",
      source: "POS",
      originator: "SELLER",
      createdAt: "2026-03-20T15:30:00.000Z",
      updatedAt: "2026-03-20T15:30:00.000Z",
      trackingCode: "3SPLAYWRIGHT1002",
      trackingCarrier: "PostNL",
    },
  ];
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockAdminOrders(page: Page): Promise<MockAdminOrdersState> {
  const orders = createOrders();
  const resendRequests: ResendRequestContract[] = [];
  const timelineRequestCountByOrder = new Map<string, number>();
  let lastOrdersQuery = { search: "", status: "" };

  await page.context().addCookies([
    {
      name: "csrf_token",
      value: TEST_CSRF_VALUE,
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
  ]);

  await page.route("**/api/admin/session**", async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        authenticated: true,
        csrfToken: TEST_CSRF_VALUE,
        user: {
          id: "admin-1",
          email: "admin@example.com",
          firstName: "Admin",
          lastName: "Tester",
          role: "owner",
        },
      },
      requestId: "req-admin-session",
    });
  });

  await page.route("**/api/admin/csrf**", async (route) => {
    await fulfillJson(route, {
      success: true,
      data: { csrfToken: TEST_CSRF_VALUE },
      requestId: "req-admin-csrf",
    });
  });

  await page.route("**/api/admin/invoices**", async (route) => {
    await fulfillJson(route, {
      success: true,
      data: { invoices: [] },
      requestId: "req-admin-invoices",
    });
  });

  await page.route("**/api/admin/stats**", async (route) => {
    await fulfillJson(route, {
      success: true,
      data: { recentOrders: [] },
      requestId: "req-admin-stats",
    });
  });

  await page.route("**/api/admin/cache-version**", async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {
        version: 1,
        resourceType:
          new URL(route.request().url()).searchParams.get("resourceType") ||
          "orders",
      },
      requestId: "req-admin-cache-version",
    });
  });

  await page.route("**/api/admin/orders/*/timeline**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathSegments = url.pathname.split("/");
    const orderId = pathSegments[pathSegments.length - 2] ?? "unknown";
    const nextRequestCount =
      (timelineRequestCountByOrder.get(orderId) ?? 0) + 1;
    timelineRequestCountByOrder.set(orderId, nextRequestCount);

    const timelineEvents = [
      {
        id: 1,
        type: "order_created",
        title: "Bestelling aangemaakt",
        actor: "Webshop",
        createdAt: "2026-03-21T09:00:00.000Z",
      },
    ];

    if (orderId === "ORD-1001" && nextRequestCount >= 2) {
      timelineEvents.unshift({
        id: 2,
        type: "email_sent",
        title: "E-mails opnieuw verstuurd",
        actor: "Admin Tester",
        createdAt: "2026-03-22T10:00:00.000Z",
      });
    }

    await fulfillJson(route, {
      success: true,
      data: timelineEvents,
      requestId: "req-admin-order-timeline",
    });
  });

  await page.route("**/api/admin/orders/*/notes**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      await fulfillJson(route, {
        success: true,
        data: { id: 10 },
        requestId: "req-admin-order-note-create",
      });
      return;
    }

    await fulfillJson(route, {
      success: true,
      data: [],
      requestId: "req-admin-order-notes",
    });
  });

  await page.route("**/api/admin/orders/*/notes/*", async (route) => {
    await fulfillJson(route, {
      success: true,
      data: {},
      requestId: "req-admin-order-note-delete",
    });
  });

  await page.route("**/api/admin/orders/*/resend-emails**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathSegments = url.pathname.split("/");
    const orderId = pathSegments[pathSegments.length - 2] ?? "unknown";

    const payload = (request.postDataJSON() ?? {
      emailTypes: [],
      idempotencyKey: "",
    }) as {
      emailTypes?: string[];
      idempotencyKey?: string;
    };
    const emailTypes = payload.emailTypes ?? [];
    const requested = emailTypes.length;
    const sent = requested > 0 ? 1 : 0;
    const skipped = requested > 1 ? requested - 1 : 0;
    const primaryType = emailTypes[0] ?? "order_confirmation";
    const secondaryType = emailTypes[1] ?? primaryType;

    resendRequests.push({
      method: request.method(),
      orderId,
      emailTypes,
      idempotencyKey: payload.idempotencyKey ?? "",
      csrfToken: request.headers()["x-csrf-token"],
      tenant: url.searchParams.get("tenant"),
    });

    await fulfillJson(route, {
      success: true,
      data: {
        orderId,
        summary: {
          requested,
          sent,
          skipped,
          failed: 0,
        },
        results: [
          {
            type: primaryType,
            recipient: "sjoerd@example.com",
            status: "sent",
            messageId: "msg-resend-order-confirmation",
          },
          {
            type: secondaryType,
            recipient: "sjoerd@example.com",
            status: "skipped",
            errorCode: "ALREADY_SENT",
            errorMessage: "Al eerder verzonden, opnieuw overgeslagen",
          },
        ],
        idempotentReplay: false,
      },
      requestId: "req-admin-order-resend-emails",
    });
  });

  await page.route("**/api/admin/orders/batch/status**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname !== "/api/admin/orders/batch/status") {
      await route.fallback();
      return;
    }

    expect(request.method()).toBe("PUT");
    expect(request.headers()["x-csrf-token"]).toBe(TEST_CSRF_VALUE);

    const payload = request.postDataJSON() as {
      orderIds: string[];
      status: AdminOrderStatus;
    };

    for (const order of orders) {
      if (payload.orderIds.includes(order.orderId)) {
        order.status = payload.status;
        order.updatedAt = "2026-03-22T08:00:00.000Z";
      }
    }

    await fulfillJson(route, {
      success: true,
      data: {
        updated: payload.orderIds.length,
        status: payload.status,
      },
      requestId: "req-admin-order-batch-status",
    });
  });

  await page.route("**/api/admin/orders**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== "/api/admin/orders") {
      await route.fallback();
      return;
    }

    const search = (url.searchParams.get("search") || "").toLowerCase();
    const status = url.searchParams.get("status") || "";

    lastOrdersQuery = {
      search,
      status,
    };

    const filtered = orders.filter((order) => {
      const matchesSearch =
        !search ||
        order.orderId.toLowerCase().includes(search) ||
        order.customerName.toLowerCase().includes(search) ||
        order.customerEmail.toLowerCase().includes(search);

      const matchesStatus = !status || order.status === status;
      return matchesSearch && matchesStatus;
    });

    await fulfillJson(route, {
      success: true,
      data: {
        orders: filtered.map(
          ({
            updatedAt: _updatedAt,
            trackingCarrier: _trackingCarrier,
            trackingCode: _trackingCode,
            ...order
          }) => order,
        ),
        total: filtered.length,
      },
      total: filtered.length,
      requestId: "req-admin-orders-list",
    });
  });

  await page.route("**/api/admin/orders/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 4) {
      await route.fallback();
      return;
    }

    const orderId = segments[3];
    const order = orders.find((item) => item.orderId === orderId);

    if (!order) {
      await fulfillJson(
        route,
        {
          success: false,
          error: {
            code: "ORDER_NOT_FOUND",
            message: "Bestelling niet gevonden",
          },
          requestId: "req-admin-order-missing",
        },
        404,
      );
      return;
    }

    if (request.method() === "PUT") {
      expect(request.headers()["x-csrf-token"]).toBe(TEST_CSRF_VALUE);
      const payload = request.postDataJSON() as {
        status?: AdminOrderStatus;
        trackingCode?: string;
        trackingCarrier?: string;
      };

      if (payload.status) {
        order.status = payload.status;
      }
      if (payload.trackingCode) {
        order.trackingCode = payload.trackingCode;
      }
      if (payload.trackingCarrier) {
        order.trackingCarrier = payload.trackingCarrier;
      }
      order.updatedAt = "2026-03-22T08:05:00.000Z";

      await fulfillJson(route, {
        success: true,
        data: { order },
        requestId: "req-admin-order-update",
      });
      return;
    }

    await fulfillJson(route, {
      success: true,
      data: {
        order: {
          id: order.id,
          orderId: order.orderId,
          status: order.status,
          source: order.source,
          originator: order.originator,
          payment: { status: "paid" },
          user: {
            email: order.customerEmail,
            firstName: order.customerName.split(" ")[0],
            lastName: order.customerName.split(" ").slice(1).join(" "),
            phone: "+31612345678",
          },
          shipping: {
            street: "Voorbeeldstraat",
            houseNumber: "12",
            zipcode: "1234AB",
            city: "Amsterdam",
            country: "NL",
          },
          items: [
            {
              id: "item-1",
              productId: "prod-1",
              productTitle: "Pagayo Test Product",
              quantity: 1,
              unitPriceCents: order.total,
              totalPriceCents: order.total,
            },
          ],
          subtotalCents: order.total,
          discountCents: 0,
          shippingCostCents: 0,
          totalCents: order.total,
          trackingCode: order.trackingCode,
          trackingCarrier: order.trackingCarrier,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        },
      },
      requestId: "req-admin-order-detail",
    });
  });

  return {
    resendRequests,
    getTimelineRequestCount: (orderId: string) =>
      timelineRequestCountByOrder.get(orderId) ?? 0,
    getLastOrdersQuery: () => lastOrdersQuery,
  };
}

async function openOrdersPage(page: Page) {
  await page.goto(ADMIN_LOGIN_URL);
  await expect(page.locator(".admin-shell")).toBeVisible();

  await page.evaluate((targetUrl) => {
    window.history.pushState({}, "", targetUrl);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, ADMIN_ORDERS_URL);

  await expect(page).toHaveURL(/\/admin\/orders/);
  await expect(
    page.locator(".orders-workspace-list-card .product-workspace-row"),
  ).toHaveCount(2);
}

test.describe("Admin order management", () => {
  let mockState: MockAdminOrdersState;

  test.beforeEach(async ({ page }) => {
    mockState = await mockAdminOrders(page);
  });

  test("opent de orderlijst en ondersteunt zoeken en filteren", async ({
    page,
  }) => {
    await openOrdersPage(page);

    const listRows = page.locator(
      ".orders-workspace-list-card .product-workspace-row",
    );
    await expect(listRows.first()).toContainText("ORD-1001");
    await expect(listRows.nth(1)).toContainText("ORD-1002");

    await page
      .locator('[data-workspace-filter-intent="search"]')
      .first()
      .click();

    await page.locator("#orders-workspace-search").fill("1002");
    await expect.poll(() => mockState.getLastOrdersQuery().search).toBe("1002");
    await expect(listRows).toHaveCount(1);
    await expect(listRows.first()).toContainText("ORD-1002");

    await page.locator("#orders-workspace-search").fill("");
    await expect(listRows).toHaveCount(2);

    await page
      .locator(".products-filter-chips--panel .workspace-filter-chip")
      .first()
      .click();
    await expect
      .poll(() => mockState.getLastOrdersQuery().status)
      .toBe("pending");
    await expect(listRows).toHaveCount(1);
    await expect(listRows.first()).toContainText("ORD-1001");
  });

  test("bekijkt orderdetail in de workspace", async ({ page }) => {
    await openOrdersPage(page);

    const firstRow = page
      .locator(".orders-workspace-list-card .product-workspace-row")
      .filter({ hasText: "ORD-1001" });
    await expect(firstRow).toHaveCount(1);

    await firstRow.click();

    await expect(page).toHaveURL(/\/admin\/orders\/ORD-1001/);
    await expect(page.locator(".products-workspace-hero__title")).toContainText(
      "ORD-1001",
    );
    await expect(page.locator(".order-lines-table")).toContainText(
      "Pagayo Test Product",
    );
    await expect(page.locator(".status-flow-card")).toContainText(
      /Processing|In behandeling/,
    );
  });

  test("voert resend uit op orderdetail met contractvalidatie en timeline refresh", async ({
    page,
  }) => {
    await openOrdersPage(page);

    const targetRow = page
      .locator(".orders-workspace-list-card .product-workspace-row")
      .filter({ hasText: "ORD-1001" });
    await expect(targetRow).toHaveCount(1);
    await targetRow.click();

    await expect(page).toHaveURL(/\/admin\/orders\/ORD-1001/);

    const resendResponse = await page.evaluate(
      async ({ csrfToken }) => {
        const response = await fetch(
          "/api/admin/orders/ORD-1001/resend-emails?tenant=test",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken,
            },
            credentials: "include",
            body: JSON.stringify({
              emailTypes: ["order_confirmation", "order_shipped"],
              idempotencyKey: `admin-resend-ORD-1001-${Date.now()}-playwright`,
            }),
          },
        );

        return {
          ok: response.ok,
          status: response.status,
        };
      },
      { csrfToken: TEST_CSRF_VALUE },
    );

    expect(resendResponse.ok).toBe(true);
    expect(resendResponse.status).toBe(200);

    await expect.poll(() => mockState.resendRequests.length).toBe(1);

    const resendRequest = mockState.resendRequests[0];
    expect(resendRequest.method).toBe("POST");
    expect(resendRequest.orderId).toBe("ORD-1001");
    expect(resendRequest.tenant).toBe("test");
    expect(resendRequest.emailTypes).toEqual([
      "order_confirmation",
      "order_shipped",
    ]);
    expect(resendRequest.idempotencyKey).toMatch(
      /^admin-resend-ORD-1001-\d+-[a-z0-9-]+$/,
    );
    expect(resendRequest.csrfToken).toBe(TEST_CSRF_VALUE);

    await page.getByRole("button", { name: "Refresh" }).click();

    await expect
      .poll(() => mockState.getTimelineRequestCount("ORD-1001"))
      .toBeGreaterThanOrEqual(2);
    await expect(page.locator(".order-timeline")).toContainText(
      "E-mails opnieuw verstuurd",
    );
  });
});
