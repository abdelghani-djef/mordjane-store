import { type APIRequestContext, expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@mordjane.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "choco-admin-dev";
const PHONE = "+216 98 765 432";
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:8025";

type MailpitMessage = { ID: string; Subject: string; To: { Address: string }[] };

/** Subjects Mailpit caught for an address (emails are sent right after the response). */
async function inbox(request: APIRequestContext, address: string): Promise<string[]> {
  const res = await request.get(`${MAILPIT}/api/v1/search`, {
    params: { query: `to:${address}` },
  });
  expect(res.ok(), "Mailpit must be running (devenv up)").toBeTruthy();
  const body = (await res.json()) as { messages: MailpitMessage[] };
  return body.messages.map((m) => m.Subject);
}

test("customer orders, admin fulfils, customer tracks delivery", async ({ page, request }) => {
  // A fresh address per run, so this run's emails are easy to find in Mailpit.
  const customerEmail = `yasmine+${Date.now()}@example.com`;
  // --- shop: pick sizes and add them to the cart --------------------------------------------
  await page.goto("/en/products?category=rocher");
  await expect(
    page.getByRole("heading", { level: 1, name: "Crunchy rocher spreads" }),
  ).toBeVisible();
  const rocher = page.getByRole("article").filter({ hasText: "Crunchy hazelnut cream" });
  await rocher.getByRole("link", { name: "Choose a size" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Crunchy hazelnut cream" }),
  ).toBeVisible();
  // The smallest size in stock is preselected; pick the 600 g size instead.
  await expect(page.getByRole("radio", { name: /^200 g/ })).toBeChecked();
  // The radio itself is visually hidden inside its size card; click the card like a shopper.
  await page.locator("label", { hasText: "600 g" }).click();
  await expect(page.getByRole("radio", { name: /^600 g/ })).toBeChecked();
  // Price and stock follow the chosen size.
  await expect(page.locator(".price", { hasText: "22.500 DT" })).toBeVisible();
  // First match is the main product; related-product cards below have their own buttons.
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await expect(page.getByText("Added to cart").first()).toBeVisible();

  await page.goto("/en/products/creme-noisettes");
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await page.getByRole("button", { name: "Add to cart" }).first().click();

  // --- cart → checkout ----------------------------------------------------------------------
  await page.goto("/en/cart");
  await expect(page.getByRole("link", { name: "Crunchy hazelnut cream" })).toBeVisible();
  await expect(page.getByText("22.500 DT / 600 g")).toBeVisible();
  await expect(page.getByRole("link", { name: "Hazelnut cream", exact: true })).toBeVisible();
  await expect(page.getByText("7.900 DT / 200 g")).toBeVisible();
  // 22.500 + 2 × 7.900; delivery depends on the city, chosen at checkout
  await expect(page.getByText("Calculated at checkout")).toBeVisible();
  await expect(page.getByText("38.300 DT").first()).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Checkout" }).click();

  await expect(page).toHaveURL(/\/en\/checkout$/);
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Please enter your full name.")).toBeVisible();

  await page.getByLabel("Full name").fill("Yasmine Haddad");
  await page.getByLabel("Phone number").fill(PHONE);
  await page.getByLabel("Email", { exact: true }).fill(customerEmail);
  await page.getByLabel(/^Address/).fill("5 Rue de Marseille, Sousse 4000");
  await expect(page.getByText("Please choose your governorate.")).toBeVisible();
  // The delegation list opens once a governorate is chosen, and lists only its delegations.
  await expect(page.getByRole("combobox", { name: "Delegation" })).toBeDisabled();
  await page.getByRole("combobox", { name: "Governorate" }).click();
  await page.getByRole("option", { name: /^Sousse/ }).click();
  // Sousse delivers for 8.000 DT → 38.300 + 8.000
  await expect(page.getByText("46.300 DT")).toBeVisible();
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Please choose your delegation.")).toBeVisible();
  await page.getByRole("combobox", { name: "Delegation" }).click();
  await expect(page.getByRole("option", { name: "La Marsa" })).toHaveCount(0);
  await page.getByRole("option", { name: "Hammam Sousse" }).click();
  await page.getByRole("button", { name: "Place order" }).click();

  // --- confirmation lands on tracking -------------------------------------------------------
  await expect(page).toHaveURL(/\/en\/track\?code=MJ-/);
  await expect(page.getByText("Thank you! Your order is placed.")).toBeVisible();
  const code = new URL(page.url()).searchParams.get("code")!;
  expect(code).toMatch(/^MJ-[A-Z2-9]{6}$/);
  await expect(page.getByRole("heading", { name: code })).toBeVisible();

  // The confirmation email (with the code) reached the customer's inbox.
  await expect.poll(() => inbox(request, customerEmail)).toContain(`Order ${code} received`);

  // --- admin validates, ships, delivers -----------------------------------------------------
  await page.goto("/en/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto(`/en/admin/orders?q=${code}`);
  await page.getByRole("link", { name: code }).click();
  await expect(page.getByText("Yasmine Haddad")).toBeVisible();
  await expect(page.getByText("Hammam Sousse, Sousse").first()).toBeVisible();

  await page.getByLabel(/^Internal note/).fill("Confirmed by phone");
  await page.getByRole("button", { name: "Mark as Validated" }).click();
  await expect(page.getByText("Order marked as Validated")).toBeVisible();
  await page.getByRole("button", { name: "Mark as Shipped" }).click();
  await expect(page.getByText("Order marked as Shipped")).toBeVisible();
  await page.getByRole("button", { name: "Mark as Delivered" }).click();
  await expect(page.getByText("This order is closed.")).toBeVisible();

  // --- customer sees the delivered timeline (in French) -------------------------------------
  await page.goto(`/fr/track?code=${code}&phone=${encodeURIComponent(PHONE)}`);
  await expect(page.getByText("Livrée. Bonne dégustation !")).toBeVisible();
  await expect(page.getByText(/Hammam Sousse, Sousse/)).toBeVisible();

  // …and was emailed when the order arrived (in English, the language they ordered in).
  await expect.poll(() => inbox(request, customerEmail)).toContain(`Order ${code} delivered`);
  await expect(page.getByText(/Crème de noisettes rocher, 600 g/)).toBeVisible();
});

test("the Arabic shop reads right to left, through checkout and email", async ({
  page,
  request,
}) => {
  const customerEmail = `amine+${Date.now()}@example.com`;
  await page.goto("/ar/products/creme-noisettes-rocher");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(
    page.getByRole("heading", { level: 1, name: "كريمة البندق المحمص المقرمشة" }),
  ).toBeVisible();
  // Western digits, Tunisian separators, Arabic currency and units.
  await expect(page.locator(".price", { hasText: "8,900 د.ت" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^200 غ/ })).toBeChecked();
  await page.getByRole("button", { name: "أضف إلى السلة" }).first().click();
  await expect(page.getByText("أُضيف إلى السلة").first()).toBeVisible();

  await page.goto("/ar/checkout");
  await page.getByLabel("الاسم الكامل").fill("أمين الطرابلسي");
  await page.getByLabel("رقم الهاتف").fill("+216 55 111 222");
  await page.getByLabel("البريد الإلكتروني", { exact: true }).fill(customerEmail);
  await page.getByLabel(/^العنوان/).fill("12 نهج الحبيب بورقيبة، سوسة");
  await page.getByRole("combobox", { name: "الولاية" }).click();
  await page.getByRole("option", { name: /^سوسة/ }).click();
  await page.getByRole("combobox", { name: "المعتمدية" }).click();
  await page.getByRole("option", { name: "حمام سوسة" }).click();
  // 8.900 + 8.000 delivery to Sousse
  await expect(page.getByText("16,900 د.ت").first()).toBeVisible();
  await page.getByRole("button", { name: "تأكيد الطلب" }).click();

  await expect(page).toHaveURL(/\/ar\/track\?code=MJ-/);
  await expect(page.getByText("شكرًا! تم تسجيل طلبك.")).toBeVisible();
  const code = new URL(page.url()).searchParams.get("code")!;
  // The confirmation email is in Arabic too.
  await expect.poll(() => inbox(request, customerEmail)).toContain(`تم استلام طلبك ${code}`);
});

test("the admin panel stays in English and French", async ({ page }) => {
  await page.goto("/ar/admin/orders");
  await expect(page).toHaveURL(/\/fr\/admin\/login$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("tracking with the wrong phone reveals nothing", async ({ page }) => {
  await page.goto("/en/track?code=MJ-AAAAAA&phone=0000000000");
  await expect(page.getByText("We couldn't find an order")).toBeVisible();
});

test("admin area redirects anonymous visitors to login", async ({ page }) => {
  await page.goto("/en/admin/orders");
  await expect(page).toHaveURL(/\/en\/admin\/login$/);
});

test("a product switched off while in the cart can't be checked out", async ({ page }) => {
  const api = page.request;
  const login = await api.post("/api/admin/auth/login", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  const res = await api.get("/api/products/creme-cacahuetes");
  expect(res.ok()).toBeTruthy();
  const product = await res.json();

  try {
    await page.goto("/en/products/creme-cacahuetes");
    await page.getByRole("button", { name: "Add to cart" }).first().click();
    await expect(page.getByText("Added to cart").first()).toBeVisible();

    // Staff switch the product off before the customer checks out.
    const off = await api.patch(`/api/admin/products/${product.id}`, {
      data: { is_available: false },
    });
    expect(off.ok()).toBeTruthy();

    await page.goto("/en/checkout");
    await page.getByLabel("Full name").fill("Sami Trabelsi");
    await page.getByLabel("Phone number").fill("+216 22 333 444");
    await page.getByLabel("Email", { exact: true }).fill("sami@example.com");
    await page.getByLabel(/^Address/).fill("3 Rue de Rome, Tunis 1000");
    await page.getByRole("combobox", { name: "Governorate" }).click();
    await page.getByRole("option", { name: /^Tunis/ }).click();
    await page.getByRole("combobox", { name: "Delegation" }).click();
    await page.getByRole("option", { name: "La Marsa" }).click();
    await page.getByRole("button", { name: "Place order" }).click();

    // Sent back to the cart, which says what's wrong and blocks checkout.
    await expect(page).toHaveURL(/\/en\/cart$/);
    await expect(page.getByText("This product is currently unavailable")).toBeVisible();

    // The header drawer no longer offers a way around it…
    await page.getByRole("button", { name: /^Cart \(/ }).click();
    await expect(page.getByRole("link", { name: "Review cart" })).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("link", { name: "Checkout" })).toHaveCount(0);

    // …and neither does typing the checkout URL.
    await page.goto("/en/checkout");
    await expect(page).toHaveURL(/\/en\/cart$/);
  } finally {
    await api.patch(`/api/admin/products/${product.id}`, { data: { is_available: true } });
  }
});
