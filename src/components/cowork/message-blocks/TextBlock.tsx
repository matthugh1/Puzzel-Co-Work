"use client";

import React, { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { IconCopy, IconCheckCircle } from "@/components/cowork/icons";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      type="button"
      className="cw-code-copy-btn"
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy code"}
      aria-label={copied ? "Copied!" : "Copy code"}
    >
      {copied ? <IconCheckCircle size={14} /> : <IconCopy size={14} />}
    </button>
  );
}

export function TextBlock({ text }: { text: string }) {
  return (
    <div className="cowork-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Fenced code blocks with syntax highlighting + copy button
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");

            if (match) {
              return (
                <div className="cw-code-block-wrapper">
                  <div className="cw-code-block-header">
                    <span className="cw-code-block-lang">{match[1]}</span>
                    <CopyButton text={codeString} />
                  </div>
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: "0 0 8px 8px",
                      fontSize: "13px",
                      lineHeight: "1.6",
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              );
            }

            // Inline code
            return (
              <code className="cw-inline-code" {...props}>
                {children}
              </code>
            );
          },

          // Code blocks without a language still get copy button
          pre({ children }) {
            // If the child is already a syntax-highlighted block, pass through
            const child = React.Children.only(children) as React.ReactElement<{
              className?: string;
              children?: string;
            }>;
            if (child?.props?.className?.includes("language-")) {
              return <>{children}</>;
            }
            // Plain code block
            const codeText =
              typeof child?.props?.children === "string"
                ? child.props.children
                : "";
            return (
              <div className="cw-code-block-wrapper">
                <div className="cw-code-block-header">
                  <span className="cw-code-block-lang">text</span>
                  {codeText && <CopyButton text={codeText} />}
                </div>
                <pre className="cw-code-block-plain">{children}</pre>
              </div>
            );
          },

          // Links open in new tab
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },

          // Tables get a wrapper for horizontal scrolling
          table({ children }) {
            return (
              <div className="cw-table-wrapper">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
