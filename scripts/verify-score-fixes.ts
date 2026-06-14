import { readFileSync } from 'node:fs'

const scoreCenter = readFileSync('src/components/ScoreCenter.vue', 'utf8')
const homePage = readFileSync('src/pages/HomePage.vue', 'utf8')
const types = readFileSync('src/types/weave.ts', 'utf8')

console.log(JSON.stringify({
  issueLocationFixed: scoreCenter.includes('@click="issue.location && navigateToIssue(issue)"') && scoreCenter.includes('点击定位:') && scoreCenter.includes('navigateToIssue('),
  treadleAnalysisFixed: scoreCenter.includes('tab="踏序分析"') && scoreCenter.includes('踏序步详情（点击可定位）') && types.includes('export interface TreadleAnalysis'),
  compareStructureFixed: scoreCenter.includes('结构变化详情') && scoreCenter.includes('经线穿线变化') && scoreCenter.includes('踏板关联变化') && scoreCenter.includes('共 {{ designChanges.length }} 处变更'),
}, null, 2))
