import { readFileSync } from 'node:fs'

const scoreCenter = readFileSync('src/components/ScoreCenter.vue', 'utf8')
const issueBlockMatch = scoreCenter.match(/<div v-if="issue\.location" class="issue-location">[\s\S]*?<\/div>/)
const issueBlock = issueBlockMatch?.[0] || ''

console.log(JSON.stringify({
  issueLocationBlockFound: Boolean(issueBlock),
  issueLocationBlockHasClick: issueBlock.includes('@click'),
  issueLocationBlockHasButton: issueBlock.includes('<NButton') || issueBlock.includes('<button'),
  issueLocationBlockHasScrollIntoView: issueBlock.includes('scrollIntoView'),
}, null, 2))
