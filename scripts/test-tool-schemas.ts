/**
 * Test Tool Schemas for OpenAI Strict Mode
 * 
 * Run: npx tsx scripts/test-tool-schemas.ts
 */

import { getCanonicalTools } from '../src/lib/cowork/tools';
import { enforceStrictSchema } from '../src/lib/cowork/llm/utils';

function validateStrictSchema(name: string, schema: any): boolean {
  const issues: string[] = [];
  
  if (schema.type !== 'object') {
    issues.push(`type is "${schema.type}" (must be "object")`);
  }
  
  if (schema.additionalProperties !== false) {
    issues.push(`additionalProperties is ${schema.additionalProperties} (must be false)`);
  }
  
  if (!Array.isArray(schema.required)) {
    issues.push(`required is not an array`);
  }
  
  if (!schema.properties || typeof schema.properties !== 'object') {
    issues.push(`properties is missing or invalid`);
  }
  
  // Check all properties are in required array
  if (schema.properties && schema.required) {
    const propNames = Object.keys(schema.properties);
    for (const propName of propNames) {
      if (!schema.required.includes(propName)) {
        issues.push(`property "${propName}" not in required array`);
      }
    }
  }
  
  if (issues.length > 0) {
    console.log(`\n❌ ${name}:`);
    issues.forEach(issue => console.log(`   - ${issue}`));
    console.log(`   Original:`, JSON.stringify(schema, null, 2));
    return false;
  }
  
  return true;
}

async function main() {
  console.log('Testing tool schemas for OpenAI strict mode...\n');
  
  const tools = getCanonicalTools();
  console.log(`Found ${tools.length} tools\n`);
  
  let passCount = 0;
  let failCount = 0;
  
  for (const tool of tools) {
    try {
      const strictSchema = enforceStrictSchema(tool.inputSchema);
      const valid = validateStrictSchema(tool.name, strictSchema);
      
      if (valid) {
        passCount++;
        console.log(`✅ ${tool.name}`);
      } else {
        failCount++;
      }
    } catch (error) {
      failCount++;
      console.log(`\n❌ ${tool.name}: ERROR`);
      console.error(error);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  
  if (failCount > 0) {
    console.log('\n⚠️  Some schemas are not compatible with OpenAI strict mode.');
    console.log('Review the errors above and fix the tool definitions.');
    process.exit(1);
  } else {
    console.log('\n✅ All tool schemas are compatible with OpenAI strict mode!');
  }
}

main().catch(console.error);
