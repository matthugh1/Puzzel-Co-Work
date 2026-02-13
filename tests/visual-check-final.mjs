/**
 * Final visual check: full markdown test with headings, code blocks, tables.
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
  await page.waitForTimeout(5000);
  await page.goto(`${BASE}/cowork`);
  await page.waitForTimeout(8000);

  // 2. Create session
  console.log("→ Creating task...");
  await page.locator("button", { hasText: "New Task" }).first().click();
  await page.waitForTimeout(3000);

  // 3. Send markdown test message
  console.log("→ Sending markdown test...");
  const textarea = page.locator("textarea").first();
  await textarea.click();

  // Ask the LLM to respond with specific markdown
  const msg = `Reply with ONLY the following text, no other words:

# Heading 1

## Heading 2

### Heading 3

This has **bold**, *italic*, and \`inline code\`.

- Bullet one
- Bullet two

> A blockquote

| Name | Value |
|------|-------|
| Foo  | 42    |
| Bar  | 99    |

\`\`\`python
def hello():
    print("world")
\`\`\``;

  await textarea.fill(msg);
  await page.waitForTimeout(300);
  await textarea.press("Enter");
  console.log("  ✓ Sent");

  // 4. Wait for streaming to complete
  console.log("→ Waiting for complete response...");
  for (let i = 0; i < 30; i++) {
    const mdParagraphs = await page.locator(".cowork-markdown p").count();
    const assistantMsgs = await page.locator(".cowork-message--assistant").count();
    const codeBlocks = await page.locator(".cw-code-block-wrapper").count();
    console.log(`  Poll ${i+1}: assistant=${assistantMsgs} paragraphs=${mdParagraphs} codeBlocks=${codeBlocks}`);
    
    // Wait for response with some markdown content
    if (assistantMsgs > 0 && mdParagraphs >= 2) {
      // Check if streaming is done
      await page.waitForTimeout(3000);
      const newParagraphs = await page.locator(".cowork-markdown p").count();
      if (newParagraphs === mdParagraphs) {
        console.log("  ✓ Response complete!");
        break;
      }
    }
    await page.waitForTimeout(2000);
  }

  // Extra settle time
  await page.waitForTimeout(2000);

  // 5. Screenshots - top of chat
  await page.screenshot({ path: "/tmp/cowork-md-1-top.png", fullPage: true });
  console.log("  ✓ Screenshot: /tmp/cowork-md-1-top.png");

  // Scroll down to see more
  await page.evaluate(() => {
    const el = document.querySelector(".cowork-messages");
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/cowork-md-2-bottom.png", fullPage: true });
  console.log("  ✓ Screenshot: /tmp/cowork-md-2-bottom.png");

  // 6. Full element audit
  console.log("\n═══════════════════════════════════");
  console.log("  MARKDOWN RENDERING AUDIT");
  console.log("═══════════════════════════════════\n");

  const checks = [
    [".cowork-markdown", "Markdown wrapper"],
    [".cowork-markdown h1", "H1 heading"],
    [".cowork-markdown h2", "H2 heading"],
    [".cowork-markdown h3", "H3 heading"],
    [".cowork-markdown p", "Paragraphs"],
    [".cowork-markdown strong", "Bold text"],
    [".cowork-markdown em", "Italic text"],
    [".cw-inline-code", "Inline code"],
    [".cw-code-block-wrapper", "Code block"],
    [".cw-code-block-header", "Code block header"],
    [".cw-code-block-lang", "Language label"],
    [".cw-code-copy-btn", "Copy button"],
    [".cowork-markdown blockquote", "Blockquote"],
    [".cw-table-wrapper", "Table wrapper"],
    [".cowork-markdown table", "Table"],
    [".cowork-markdown th", "Table headers"],
    [".cowork-markdown td", "Table cells"],
    [".cowork-markdown ul", "Unordered list"],
    [".cowork-markdown li", "List items"],
    [".cw-error-boundary", "Error fallbacks (should be 0)"],
  ];

  let passed = 0;
  let failed = 0;
  for (const [sel, label] of checks) {
    const n = await page.locator(sel).count();
    if (label.includes("should be 0")) {
      const ok = n === 0;
      console.log(`  ${ok ? "✅" : "⚠️"} ${label}: ${n}`);
      if (ok) passed++; else failed++;
    } else {
      console.log(`  ${n > 0 ? "✅" : "❌"} ${label}: ${n}`);
      if (n > 0) passed++; else failed++;
    }
  }

  console.log(`\n  Result: ${passed}/${passed + failed} checks passed`);

  // 7. Dump assistant HTML for debugging
  const assistantContent = page.locator(".cowork-message--assistant .cowork-message__content").first();
  if (await assistantContent.count() > 0) {
    const html = await assistantContent.innerHTML();
    console.log(`\n→ Assistant HTML (${html.length} chars):`);
    console.log(html.slice(0, 1500));
  }

  await browser.close();
  console.log("\n✓ All done!");
})();
