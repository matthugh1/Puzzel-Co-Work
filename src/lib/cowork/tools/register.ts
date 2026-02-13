/**
 * Tool Registration
 * Import and register all available tools
 */

import { registerTool } from "./index";
import { todoWriteTool } from "./todo-write";
import {
  readTool,
  writeTool,
  editTool,
  globTool,
  grepTool,
} from "./file-tools";
import { bashTool } from "./bash";
import { webSearchTool } from "./web-search";
import { webFetchTool } from "./web-fetch";
import { enterPlanModeTool, exitPlanModeTool } from "./plan-mode";
import { askUserQuestionTool } from "./ask-user";
import { taskTool } from "./task";
import { getSubAgentResultsTool } from "./get-sub-agent-results";
import { createDocumentTool } from "./create-document";
import { createSpreadsheetTool } from "./create-spreadsheet";
import { skillTool } from "./skill";
import { createSkillTool } from "./create-skill";

// Register all tools
registerTool(todoWriteTool);
registerTool(readTool);
registerTool(writeTool);
registerTool(editTool);
registerTool(globTool);
registerTool(grepTool);
registerTool(bashTool);
registerTool(webSearchTool);
registerTool(webFetchTool);
registerTool(enterPlanModeTool);
registerTool(exitPlanModeTool);
registerTool(askUserQuestionTool);
registerTool(taskTool);
registerTool(getSubAgentResultsTool);
registerTool(createDocumentTool);
registerTool(createSpreadsheetTool);
registerTool(skillTool);
registerTool(createSkillTool);
