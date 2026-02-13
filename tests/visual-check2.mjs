/**
 * Visual check: log in, open existing session, screenshot the rendered markdown.
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
  await page.waitForTimeout(2000);

  // 2. Click on existing session "Please respond with the foll..."
  console.log("→ Looking for existing session...");
  const sessions = page.locator('.cowork-sidebar__item');
  const count = await sessions.count();
  console.log(`  Found ${count} sessions in sidebar`);

  // Click the first session that has "respond" or just the second one (first non-selected)
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const text = await sessions.nth(i).textContent();
    console.log(`  Session ${i}: ${text?.trim().slice(0, 50)}`);
    if (text && text.includes("respond")) {
      await sessions.nth(i).click();
      clicked = true;
      console.log(`  ✓ Clicked session: "${text.trim().slice(0, 50)}"`);
      break;
    }
  }

  // If no "respond" session found, click the first available one
  if (!clicked && count > 0) {
    for (let i = 0; i < count; i++) {
      const text = await sessions.nth(i).textContent();
      if (text && !text.includes("New Task")) {
        await sessions.nth(i).click();
        console.log(`  ✓ Clicked first available session: "${text?.trim().slice(0, 50)}"`);
        clicked = true;
        break;
      }
    }
  }

  await page.waitForTimeout(3000);
  await page.waitForLoadState("networkidle");

  // 3. Screenshot the chat with messages
  await page.screenshot({ path: "/tmp/cowork-chat-1.png", fullPage: true });
  console.log("  ✓ Screenshot: /tmp/cowork-chat-1.png");

  // 4. Scroll down in the messages area to see the full response
  await page.evaluate(() => {
    const el = document.querySelector(".cowork-messages");
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/cowork-chat-2.png", fullPage: true });
  console.log("  ✓ Screenshot: /tmp/cowork-chat-2.png");

  // 5. Check rendered elements
  console.log("\n→ Checking rendered elements...");
  const checks = {
    "cowork-markdown div": await page.locator(".cowork-markdown").count(),
    "h1 headings": await page.locator(".cowork-markdown h1").count(),
    "h2 headings": await page.locator(".cowork-markdown h2").count(),
    "h3 headings": await page.locator(".cowork-markdown h3").count(),
    "strong (bold)": await page.locator(".cowork-markdown strong").count(),
    "em (italic)": await page.locator(".cowork-markdown em").count(),
    "inline code (.cw-inline-code)": await page.locator(".cw-inline-code").count(),
    "code block wrapper": await page.locator(".cw-code-block-wrapper").count(),
    "copy buttons": await page.locator(".cw-code-copy-btn").count(),
    "blockquotes": await page.locator(".cowork-markdown blockquote").count(),
    "table wrappers": await page.locator(".cw-table-wrapper").count(),
    "lists (ul)": await page.locator(".cowork-markdown ul").count(),
    "lists (ol)": await page.locator(".cowork-markdown ol").count(),
    "cowork-message divs": await page.locator(".cowork-message").count(),
    "assistant messages": await page.locator(".cowork-message--assistant").count(),
    "user messages": await page.locator(".cowork-message--user").count(),
    "error boundary fallbacks": await page.locator(".cw-error-boundary").count(),
  };

  let allGood = true;
  for (const [name, ct] of Object.entries(checks)) {
    if (name === "error boundary fallbacks") {
      const icon = ct === 0 ? "✅" : "⚠️";
      console.log(`  ${icon} ${name}: ${ct}`);
    } else if (name.startsWith("cowork-message") || name.startsWith("user") || name.startsWith("assistant")) {
      console.log(`  📊 ${name}: ${ct}`);
    } else {
      const icon = ct > 0 ? "✅" : "❌";
      if (ct === 0) allGood = false;
      console.log(`  ${icon} ${name}: ${ct}`);
    }
  }

  // 6. Get the actual HTML of the first assistant message for debugging
  const firstAssistant = page.locator(".cowork-message--assistant .cowork-message__content").first();
  if (await firstAssistant.count() > 0) {
    const html = await firstAssistant.innerHTML();
    console.log("\n→ First assistant message HTML (first 500 chars):");
    console.log(html.slice(0, 500));
  } else {
    console.log("\n→ No assistant messages found in DOM");
    // Debug: dump the page content
    const bodyText = await page.locator("body").innerText();
    console.log("Page text (first 500 chars):", bodyText.slice(0, 500));
  }

  console.log(allGood ? "\n✅ ALL CHECKS PASSED" : "\n⚠️  Some checks failed - see above");

  await browser.close();
})();
