/**
 * Visual check v5: wait for streaming to fully complete before screenshotting.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3002";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  page.on("console", msg => {
    if (msg.type() === "error") console.log(`  [CONSOLE] ${msg.text().slice(0, 150)}`);
  });

  // 1. Login
  console.log("→ Logging in...");
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"], input[type="email"]', "admin@puzzel.com");
  await page.fill('input[name="password"], input[type="password"]', "TestPass123!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  await page.goto(`${BASE}/cowork`);
  await page.waitForTimeout(10000); // Wait for full compile

  // 2. Create session and send message
  console.log("→ Creating task and sending message...");
  const newTaskBtn = page.locator("button", { hasText: "New Task" }).first();
  await newTaskBtn.click();
  await page.waitForTimeout(3000);

  const textarea = page.locator("textarea").first();
  await textarea.click();
  await textarea.fill("Respond with exactly: Hello **bold** and *italic* world");
  await page.waitForTimeout(300);
  await textarea.press("Enter");
  console.log("  ✓ Message sent");

  // 3. Wait for streaming to COMPLETE (send button returns, stop button gone)
  console.log("→ Waiting for streaming to complete...");
  for (let i = 0; i < 30; i++) {
    // Check if the send button is back (not the stop button)
    const sendBtn = page.locator('button[aria-label="Send message"]');
    const stopBtn = page.locator('button[aria-label="Stop"]');
    const hasSend = await sendBtn.count() > 0;
    const hasStop = await stopBtn.count() > 0;
    
    // Alternative: check if textarea placeholder is back
    const placeholder = await textarea.getAttribute("placeholder");
    const isStreaming = placeholder?.includes("Cowork is") || hasStop;
    
    const msgCount = await page.locator(".cowork-message").count();
    const mdCount = await page.locator(".cowork-markdown p").count();
    console.log(`  Poll ${i+1}: msgs=${msgCount} mdParagraphs=${mdCount} streaming=${isStreaming}`);
    
    if (msgCount >= 2 && !isStreaming) {
      console.log("  ✓ Streaming complete!");
      break;
    }
    if (msgCount >= 2 && mdCount > 1) {
      // We have rendered paragraphs in both messages
      console.log("  ✓ Content rendered!");
      break;
    }
    await page.waitForTimeout(2000);
  }

  // Extra wait for render
  await page.waitForTimeout(3000);

  // 4. Screenshots
  await page.screenshot({ path: "/tmp/cowork-v5-final.png", fullPage: true });
  console.log("  ✓ Screenshot: /tmp/cowork-v5-final.png");

  // 5. Element audit
  console.log("\n→ Rendered elements:");
  const checks = [
    [".cowork-message", "messages"],
    [".cowork-message--assistant", "assistant msgs"],
    [".cowork-message--user", "user msgs"],
    [".cowork-markdown", "markdown wrappers"],
    [".cowork-markdown p", "paragraphs"],
    [".cowork-markdown strong", "bold"],
    [".cowork-markdown em", "italic"],
    [".cw-inline-code", "inline code"],
    [".cw-code-block-wrapper", "code blocks"],
  ];

  for (const [sel, label] of checks) {
    const n = await page.locator(sel).count();
    console.log(`  ${n > 0 ? "✅" : "❌"} ${label}: ${n}`);
  }

  // 6. Dump all message content HTML
  const messages = page.locator(".cowork-message__content");
  const msgCount = await messages.count();
  for (let i = 0; i < msgCount; i++) {
    const html = await messages.nth(i).innerHTML();
    console.log(`\n→ Message ${i} HTML (${html.length} chars):`);
    console.log(html.slice(0, 600));
  }

  // Also check: what text does the assistant message actually contain?
  const assistantBody = page.locator(".cowork-message--assistant .cowork-message__body");
  if (await assistantBody.count() > 0) {
    const text = await assistantBody.innerText();
    console.log(`\n→ Assistant message text: "${text}"`);
  }

  await browser.close();
  console.log("\n✓ Done!");
})();
