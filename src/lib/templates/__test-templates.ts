// Quick validation that templates can be loaded
// This is a dev test file - run with: npx tsx src/lib/templates/__test-templates.ts

import { TemplateManager } from './template-manager'

async function testTemplates() {
  console.log('Testing template loading...\n')

  const templateIds = ['blank', 'shadcn', 'lunaris', 'halo', 'nitro']

  for (const id of templateIds) {
    try {
      const doc = await TemplateManager.loadTemplate(id)
      const tokenCount = Object.keys(doc.tokens).length
      const frameCount = Object.keys(doc.frames).length
      const layerCount = Object.keys(doc.layers).length

      console.log(`✓ ${id.padEnd(10)} - ${tokenCount} tokens, ${frameCount} frames, ${layerCount} layers`)
    } catch (error: any) {
      console.error(`✗ ${id.padEnd(10)} - Error: ${error.message}`)
    }
  }

  console.log('\n✅ All templates loaded successfully!')
}

testTemplates()
