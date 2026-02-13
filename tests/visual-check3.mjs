/**
 * Visual check v3: log in, navigate to existing session, wait for messages to load.
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
  await page.waitForTimeout(3000);
  await page.goto(`${BASE}/cowork`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(5000); // Wait for initial compile

  // 2. Click on existing session
  console.log("→ Looking for existing session with messages...");
  const sessions = page.locator('.cowork-sidebar__item');
  const count = await sessions.count();

  for (let i = 0; i < Math.min(count, 5); i++) {
    const text = await sessions.nth(i).textContent();
    if (text && text.includes("respond")) {
      await sessions.nth(i).click();
      console.log(`  ✓ Clicked: "${text.trim().slice(0, 60)}"`);
      break;
    }
  }

  // Wait longer for messages to load (network request + render)
  console.log("  Waiting for session to load...");
  await page.waitForTimeout(10000);
  await page.waitForLoadState("networkidle");
  
  // Check for messages appearing
  for (let i = 0; i < 10; i++) {
    const msgCount = await page.locator(".cowork-message").count();
    console.log(`  Poll ${i+1}: ${msgCount} messages`);
    if (msgCount > 0) break;
    await page.waitForTimeout(2000);
  }

  // 3. Screenshots
  await page.screenshot({ path: "/tmp/cowork-final-1.png", fullPage: true });
  console.log("  ✓ Screenshot: /tmp/cowork-final-1.png");

  // Scroll down
  await page.evaluate(() => {
    const el = document.querySelector(".cowork-messages");
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/cowork-final-2.png", fullPage: true });
  console.log("  ✓ Screenshot: /tmp/cowork-final-2.png");

  // 4. Element checks
  console.log("\n→ Rendered element counts:");
  const selectors = {
    "messages total": ".cowork-message",
    "assistant msgs": ".cowork-message--assistant",
    "user msgs": ".cowork-message--user",
    ".cowork-markdown": ".cowork-markdown",
    "h1": ".cowork-markdown h1",
    "h2": ".cowork-markdown h2",
    "h3": ".cowork-markdown h3",
    "strong": ".cowork-markdown strong",
    "em": ".cowork-markdown em",
    "inline code": ".cw-inline-code",
    "code blocks": ".cw-code-block-wrapper",
    "copy btns": ".cw-code-copy-btn",
    "blockquotes": ".cowork-markdown blockquote",
    "tables": ".cw-table-wrapper",
    "ul": ".cowork-markdown ul",
    "ol": ".cowork-markdown ol",
    "error fallback": ".cw-error-boundary",
  };

  for (const [label, sel] of Object.entries(selectors)) {
    const n = await page.locator(sel).count();
    console.log(`  ${n > 0 ? "✅" : "❌"} ${label}: ${n}`);
  }

  // 5. Debug: dump inner HTML of message area
  const messagesArea = page.locator(".cowork-messages");
  if (await messagesArea.count() > 0) {
    const html = await messagesArea.innerHTML();
    console.log("\n→ Messages area HTML (first 1000 chars):");
    console.log(html.slice(0, 1000));
  } else {
    console.log("\n→ No .cowork-messages area found");
    // Check what's in the centre panel
    const centre = page.locator(".cowork-centre");
    if (await centre.count() > 0) {
      const html = await centre.innerHTML();
      console.log("→ Centre panel HTML (first 1000 chars):");
      console.log(html.slice(0, 1000));
    }
  }

  await browser.close();
})();
