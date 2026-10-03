import { probeUsacPublicVerticalFeeds } from '../src/lib/opportunities/public-usac-vertical-runtime'

probeUsacPublicVerticalFeeds().then(result=>{
  console.log(JSON.stringify(result))
}).catch(error=>{
  console.error(error instanceof Error?error.stack??error.message:String(error))
  process.exitCode=1
})
