/**
 * Visual check v4: log in, create session via "New Task", send message with Enter key.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3002";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Enable console logging
  page.on("console", msg => {
    if (msg.type() === "error") console.log(`  [CONSOLE ERROR] ${msg.text()}`);
  });

  // 1. Login
  console.log("→ Logging in...");
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"], input[type="email"]', "admin@puzzel.com");
  await page.fill('input[name="password"], input[type="password"]', "TestPass123!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);

  // Navigate to cowork
  await page.goto(`${BASE}/cowork`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(8000); // Wait for webpack compile

  await page.screenshot({ path: "/tmp/cowork-v4-1-loaded.png", fullPage: true });
  console.log("  ✓ Page loaded");

  // 2. Click New Task
  console.log("→ Creating new task...");
  const newTaskBtn = page.locator("button", { hasText: "New Task" }).first();
  await newTaskBtn.click();
  await page.waitForTimeout(5000);

  await page.screenshot({ path: "/tmp/cowork-v4-2-newtask.png", fullPage: true });
  console.log("  ✓ New task created");

  // 3. Check if textarea is now enabled
  const textarea = page.locator("textarea").first();
  const isDisabled = await textarea.isDisabled();
  console.log(`  Textarea disabled: ${isDisabled}`);

  // 4. Type a simple message and press Enter
  console.log("→ Typing test message...");
  await textarea.click();
  await textarea.fill("Say hello world");
  await page.waitForTimeout(500);

  await page.screenshot({ path: "/tmp/cowork-v4-3-typed.png", fullPage: true });
  console.log("  ✓ Message typed");

  // Press Enter to send
  console.log("→ Pressing Enter to send...");
  await textarea.press("Enter");
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "/tmp/cowork-v4-4-sent.png", fullPage: true });

  // Wait for response
  console.log("→ Waiting for response...");
  for (let i = 0; i < 20; i++) {
    const msgCount = await page.locator(".cowork-message").count();
    const assistantCount = await page.locator(".cowork-message--assistant").count();
    console.log(`  Poll ${i+1}: ${msgCount} messages (${assistantCount} assistant)`);
    if (assistantCount > 0) {
      console.log("  ✓ Got assistant response!");
      break;
    }
    await page.waitForTimeout(2000);
  }

  // 5. Final screenshots
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/tmp/cowork-v4-5-final.png", fullPage: true });
  console.log("  ✓ Final screenshot");

  // Scroll to bottom
  await page.evaluate(() => {
    const el = document.querySelector(".cowork-messages");
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/cowork-v4-6-scrolled.png", fullPage: true });

  // 6. Element audit
  console.log("\n→ Rendered elements:");
  const selectors = {
    "messages": ".cowork-message",
    "assistant": ".cowork-message--assistant",
    "user": ".cowork-message--user",
    ".cowork-markdown": ".cowork-markdown",
    "paragraphs in markdown": ".cowork-markdown p",
  };

  for (const [label, sel] of Object.entries(selectors)) {
    const n = await page.locator(sel).count();
    console.log(`  ${n > 0 ? "✅" : "❌"} ${label}: ${n}`);
  }

  // Dump assistant message HTML
  const assistant = page.locator(".cowork-message--assistant .cowork-message__content").first();
  if (await assistant.count() > 0) {
    const html = await assistant.innerHTML();
    console.log("\n→ Assistant message HTML:");
    console.log(html.slice(0, 500));
  }

  await browser.close();
  console.log("\n✓ Done!");
})();
