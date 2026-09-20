import { describe,expect,it } from 'vitest'
import { parseSamRouteSearch } from './sam-route-input'
describe('SAM route input',()=>{
  it('rejects caller identity and unknown parameters',()=>expect(()=>parseSamRouteSearch(new URLSearchParams('userId=someone'))).toThrow(/Unsupported/))
  it('bounds pagination',()=>expect(()=>parseSamRouteSearch(new URLSearchParams('limit=1000'))).toThrow(/limit/))
  it('accepts known filters',()=>expect(parseSamRouteSearch(new URLSearchParams('limit=10&keyword=cloud')).limit).toBe(10))
})
