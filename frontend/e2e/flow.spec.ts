import { expect, test } from "@playwright/test";

// The E2E flow from docs/todos.md Phase 3:
// sign up → search → add to library → mark progress → log out → log back in → data still there.
// Runs against the full compose stack (FastAPI :8000 + Next :3000). Uses a unique
// email per run so the test is repeatable against a live database.

const uniqueEmail = `e2e-${Date.now()}@test.dev`;
const password = "supersecret123";

test("full user journey: signup → search → library → progress → session persists", async ({
  page,
}) => {
  // --- 1. Sign up (Create Account button auto-logs-in) ---
  await page.goto("/login");
  await page.getByPlaceholder("Email address").fill(uniqueEmail);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.waitForURL("**/library", { timeout: 15_000 });
  await expect(page.getByTestId("library-page")).toBeVisible();

  // --- 2. Search (keyless sources: AniList serves "naruto") ---
  await page.goto("/search");
  const searchInput = page.getByRole("textbox", { name: "Search titles" });
  await searchInput.fill("naruto");
  await expect(page.getByTestId("search-result").first()).toBeVisible({ timeout: 20_000 });

  // --- 3. Open the first episode-capable result (TV/Anime/Manga) ---
  // TMDB ordering is upstream-controlled: for "naruto" the first result has
  // been a movie (no episode list) — so pick the first card whose badge is an
  // episode-capable media type rather than blindly the first card.
  const episodeResult = page
    .getByTestId("search-result")
    .filter({ has: page.getByText(/^(TV|Anime|Manga)$/, { exact: true }) })
    .first();
  await expect(episodeResult).toBeVisible({ timeout: 20_000 });
  await episodeResult.click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
  const titleText = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
  expect(titleText.length).toBeGreaterThan(0);

  // --- 4. Add to library — clicking a non-default status auto-saves and creates the entry ---
  const statusSelector = page.getByTestId("status-selector");
  await expect(statusSelector).toBeVisible();
  // "Watching" is the default-selected status, so click a different one to trigger the change
  await statusSelector.getByRole("button", { name: "Completed" }).click();
  await expect(page.getByText("Added to library")).toBeVisible({ timeout: 15_000 });

  // --- 5. Load episodes (only if not already synced) and mark the first watched ---
  const syncButton = page.getByTestId("sync-episodes");
  if (await syncButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await syncButton.click();
  }
  const firstCheckbox = page.getByTestId("episode-checkbox-1");
  await expect(firstCheckbox).toBeVisible({ timeout: 20_000 });
  // Controlled React input: state flips after the mutation round-trip, not
  // synchronously on click — so click() + assert the count, not check().
  await firstCheckbox.click();
  await expect(page.getByText(/^1 \//)).toBeVisible({ timeout: 15_000 });
  await expect(firstCheckbox).toBeChecked();

  // --- 6. Log out ---
  await page.getByTestId("user-menu").click();
  await page.getByTestId("logout-button").click();
  await page.waitForURL("**/login");

  // --- 7. Log back in — session ends, data persists ---
  await page.getByPlaceholder("Email address").fill(uniqueEmail);
  await page.getByPlaceholder("Password").fill(password);
  // Switch to Login mode, then submit
  await page.getByRole("button", { name: "Switch to log in" }).click();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/library", { timeout: 15_000 });
  await expect(page.getByTestId("library-entry").first()).toBeVisible();
  await expect(page.getByTestId("library-entry").first()).toContainText(titleText);

  // --- 8. Progress data survived the round trip ---
  await page.getByTestId("library-entry").first().getByRole("link").first().click();
  await expect(page.getByTestId("progress-tracker")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/^1 \//)).toBeVisible();
});
