import 'dotenv/config'

import { seedDemoContent } from '@/endpoints/seedDemoContent'

const result = await seedDemoContent()

console.log(
  `Seeded ${result.sections} sections, ${result.authors} authors, and ${result.articles} published articles.`,
)
process.exit(0)
