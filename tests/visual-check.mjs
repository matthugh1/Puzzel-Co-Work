/**
 * Quick visual check: logs in, sends a markdown message, screenshots the result.
 * Run: node tests/visual-check.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3002";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // 1. Login
  console.log("→ Logging in...");
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"], input[type="email"]', "admin@puzzel.com");
  await page.fill('input[name="password"], input[type="password"]', "TestPass123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/cowork**", { timeout: 15000 }).catch(() => {
    console.log("  (did not redirect to /cowork, navigating manually)");
  });
  await page.goto(`${BASE}/cowork`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "/tmp/cowork-1-loggedin.png", fullPage: true });
  console.log("  ✓ Screenshot: /tmp/cowork-1-loggedin.png");

  // 2. Create a new session
  console.log("→ Creating new session...");
  const newTaskBtn = page.locator("text=New Task").first();
  if (await newTaskBtn.isVisible()) {
    await newTaskBtn.click();
    await page.waitForTimeout(2000);
  }

  // 3. Send a markdown test message
  console.log("→ Sending markdown test message...");
  const textarea = page.locator("textarea").first();
  await textarea.waitFor({ state: "visible", timeout: 10000 });

  const testMessage = [
    "Please respond with EXACTLY the following markdown (nothing else):",
    "",
    "# Heading 1",
    "## Heading 2",
    "### Heading 3",
    "",
    "This has **bold**, *italic*, and `inline code`.",
    "",
    "- Bullet one",
    "- Bullet two",
    "",
    "> A blockquote",
    "",
    "| Name | Value |",
    "|------|-------|",
    "| Foo  | 42    |",
    "",
    "```python",
    "def hello():",
    '    print("world")',
    "```",
  ].join("\n");

  await textarea.fill(testMessage);
  await page.waitForTimeout(500);

  // Click send button
  const sendBtn = page.locator('button[aria-label*="Send"], button:has(svg)').last();
  await sendBtn.click();
  console.log("  ✓ Message sent, waiting for response...");

  // 4. Wait for assistant response (up to 30s)
  await page.waitForTimeout(3000);

  // Poll for assistant message to appear
  for (let i = 0; i < 15; i++) {
    const assistantMessages = await page.locator(".cowork-message--assistant").count();
    if (assistantMessages > 0) {
      console.log(`  ✓ Assistant responded (${assistantMessages} message(s))`);
      break;
    }
    await page.waitForTimeout(2000);
  }

  // 5. Final screenshot
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/tmp/cowork-2-response.png", fullPage: true });
  console.log("  ✓ Screenshot: /tmp/cowork-2-response.png");

  // 6. Scroll to bottom and screenshot just the messages area
  await page.evaluate(() => {
    const el = document.querySelector(".cowork-messages");
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/cowork-3-scrolled.png", fullPage: true });
  console.log("  ✓ Screenshot: /tmp/cowork-3-scrolled.png");

  // 7. Check what rendered
  console.log("\n→ Checking rendered elements...");
  const checks = {
    "cowork-markdown div": await page.locator(".cowork-markdown").count(),
    "h1 headings": await page.locator(".cowork-markdown h1").count(),
    "h2 headings": await page.locator(".cowork-markdown h2").count(),
    "h3 headings": await page.locator(".cowork-markdown h3").count(),
    "strong (bold)": await page.locator(".cowork-markdown strong").count(),
    "em (italic)": await page.locator(".cowork-markdown em").count(),
    "inline code": await page.locator(".cw-inline-code").count(),
    "code block wrapper": await page.locator(".cw-code-block-wrapper").count(),
    "copy buttons": await page.locator(".cw-code-copy-btn").count(),
    "blockquotes": await page.locator(".cowork-markdown blockquote").count(),
    "tables": await page.locator(".cw-table-wrapper").count(),
    "lists (ul)": await page.locator(".cowork-markdown ul").count(),
    "error boundaries": await page.locator(".cw-error-boundary").count(),
  };

  for (const [name, count] of Object.entries(checks)) {
    const icon = count > 0 ? "✅" : "❌";
    console.log(`  ${icon} ${name}: ${count}`);
  }

  // Special: check error boundary rendered as 0 (meaning no crashes)
  if (checks["error boundaries"] === 0) {
    console.log("  ✅ No error boundary fallbacks triggered (no crashes)");
  }

  await browser.close();
  console.log("\n✓ Done! Check screenshots in /tmp/cowork-*.png");
})();
