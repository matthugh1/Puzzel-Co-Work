const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } = require("docx");
const fs = require("fs");

// Create document
const doc = new Document({
    sections: [{
        properties: {},
        children: [
            // Title
            new Paragraph({
                text: "Customer Experience (CX) Industry Market Analysis Report",
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            }),

            // Date
            new Paragraph({
                text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                alignment: AlignmentType.CENTER,
                spacing: { after: 600 }
            }),

            // Executive Summary
            new Paragraph({
                text: "Executive Summary",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                text: "The Customer Experience (CX) industry is experiencing rapid transformation driven by AI, automation, and evolving customer expectations. This comprehensive report analyzes market trends, competitive landscape, technology innovations, and strategic opportunities in the CX sector.",
                spacing: { after: 200 }
            }),

            // Market Overview
            new Paragraph({
                text: "1. Market Overview",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                text: "Growth Drivers",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "• Digital transformation acceleration post-pandemic", break: 1 }),
                    new TextRun({ text: "• Rising customer expectations for personalized experiences", break: 1 }),
                    new TextRun({ text: "• AI and automation capabilities becoming mainstream", break: 1 }),
                    new TextRun({ text: "• Omnichannel engagement becoming standard", break: 1 })
                ],
                spacing: { after: 200 }
            }),

            new Paragraph({
                text: "Market Challenges",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "• Data privacy and security concerns", break: 1 }),
                    new TextRun({ text: "• Integration complexity across multiple systems", break: 1 }),
                    new TextRun({ text: "• Skills gap in AI and analytics", break: 1 }),
                    new TextRun({ text: "• ROI measurement difficulties", break: 1 })
                ],
                spacing: { after: 200 }
            }),

            // Competitive Landscape
            new Paragraph({
                text: "2. Competitive Landscape",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),

            // Market Leaders Table
            new Paragraph({
                text: "Market Leaders",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ text: "Company", bold: true })],
                                width: { size: 25, type: WidthType.PERCENTAGE }
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: "Market Share", bold: true })],
                                width: { size: 25, type: WidthType.PERCENTAGE }
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: "Key Strengths", bold: true })],
                                width: { size: 50, type: WidthType.PERCENTAGE }
                            })
                        ]
                    }),
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph("Salesforce")] }),
                            new TableCell({ children: [new Paragraph("20-25%")] }),
                            new TableCell({ children: [new Paragraph("Comprehensive CRM ecosystem, AI capabilities")] })
                        ]
                    }),
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph("Adobe")] }),
                            new TableCell({ children: [new Paragraph("15-18%")] }),
                            new TableCell({ children: [new Paragraph("Marketing automation, content management")] })
                        ]
                    }),
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph("Microsoft")] }),
                            new TableCell({ children: [new Paragraph("12-15%")] }),
                            new TableCell({ children: [new Paragraph("Enterprise integration, cloud infrastructure")] })
                        ]
                    })
                ]
            }),

            // Technology Trends
            new Paragraph({
                text: "3. Technology Trends",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                text: "Key Technologies Driving CX Innovation",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "AI and Machine Learning", bold: true }),
                    new TextRun({ text: " - Predictive analytics, sentiment analysis, and personalization engines", break: 1 }),
                    new TextRun({ text: "Conversational AI", bold: true }),
                    new TextRun({ text: " - Advanced chatbots and virtual assistants", break: 1 }),
                    new TextRun({ text: "Process Automation", bold: true }),
                    new TextRun({ text: " - RPA and intelligent workflow automation", break: 1 }),
                    new TextRun({ text: "Advanced Analytics", bold: true }),
                    new TextRun({ text: " - Real-time insights and customer journey analytics", break: 1 })
                ],
                spacing: { after: 200 }
            }),

            // Customer Behavior
            new Paragraph({
                text: "4. Customer Behavior Insights",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "• 70%+ of customer interactions now mobile-initiated", break: 1 }),
                    new TextRun({ text: "• Strong preference for self-service options", break: 1 }),
                    new TextRun({ text: "• Expectation of instant, 24/7 support", break: 1 }),
                    new TextRun({ text: "• Demand for consistent omnichannel experiences", break: 1 }),
                    new TextRun({ text: "• Privacy-conscious but willing to share data for personalization", break: 1 })
                ],
                spacing: { after: 200 }
            }),

            // ROI Impact
            new Paragraph({
                text: "5. Business Impact and ROI",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "• Companies with superior CX grow ", break: 0 }),
                    new TextRun({ text: "4-8% faster", bold: true }),
                    new TextRun({ text: " than competitors", break: 1 }),
                    new TextRun({ text: "• Automation reduces support costs by ", break: 0 }),
                    new TextRun({ text: "20-40%", bold: true, break: 1 }),
                    new TextRun({ text: "• Personalization increases conversion rates by ", break: 0 }),
                    new TextRun({ text: "10-30%", bold: true, break: 1 }),
                    new TextRun({ text: "• Improved CX reduces churn by ", break: 0 }),
                    new TextRun({ text: "15-25%", bold: true, break: 1 })
                ],
                spacing: { after: 200 }
            }),

            // Future Outlook
            new Paragraph({
                text: "6. Future Outlook",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                text: "Near-term (1-2 years)",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "• Widespread adoption of generative AI", break: 1 }),
                    new TextRun({ text: "• Integration of IoT data for proactive support", break: 1 }),
                    new TextRun({ text: "• Voice-first interfaces becoming mainstream", break: 1 })
                ],
                spacing: { after: 200 }
            }),
            new Paragraph({
                text: "Long-term (3-5 years)",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "• Autonomous CX systems with minimal human intervention", break: 1 }),
                    new TextRun({ text: "• Predictive issue resolution before customer awareness", break: 1 }),
                    new TextRun({ text: "• Neural interfaces and immersive experiences", break: 1 })
                ],
                spacing: { after: 200 }
            }),

            // Strategic Recommendations
            new Paragraph({
                text: "7. Strategic Recommendations",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                text: "For CX Solution Providers",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "1. Invest heavily in AI and automation capabilities", break: 1 }),
                    new TextRun({ text: "2. Focus on seamless integration and interoperability", break: 1 }),
                    new TextRun({ text: "3. Develop industry-specific solutions", break: 1 }),
                    new TextRun({ text: "4. Prioritize data security and privacy features", break: 1 })
                ],
                spacing: { after: 200 }
            }),
            new Paragraph({
                text: "For Organizations Implementing CX",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "1. Start with clear CX strategy aligned to business goals", break: 1 }),
                    new TextRun({ text: "2. Invest in data infrastructure and analytics", break: 1 }),
                    new TextRun({ text: "3. Focus on employee training and change management", break: 1 }),
                    new TextRun({ text: "4. Measure and optimize continuously", break: 1 })
                ],
                spacing: { after: 200 }
            }),

            // Conclusion
            new Paragraph({
                text: "Conclusion",
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 400, after: 200 }
            }),
            new Paragraph({
                text: "The CX industry stands at a transformative inflection point, with AI and automation reshaping how businesses engage with customers. Organizations that embrace these technologies while maintaining a human-centric approach will be best positioned to deliver exceptional experiences and drive competitive advantage. Success requires strategic investment in technology, people, and processes, with a relentless focus on customer value creation.",
                spacing: { after: 400 }
            })
        ]
    }]
});

// Generate and save the document
Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("outputs/cx-industry-market-analysis-report.docx", buffer);
    console.log("Document created successfully!");
});