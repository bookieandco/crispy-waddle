import { describe, expect, it } from 'vitest';
import { InMemoryGameLibrary } from './game-library.js';
import { syncGameSources } from './game-library-sync.js';
const source={sourceId:'homebase:steam',source:'moonlight' as const,title:'Steam',platform:'pc' as const,contentUri:'steam://open/main',hostId:'homebase'};
describe('syncGameSources',()=>{
 it('adds then leaves unchanged on repeat discovery',async()=>{const repo=new InMemoryGameLibrary();expect(await syncGameSources(repo,[source])).toMatchObject({added:1});expect(await syncGameSources(repo,[source])).toMatchObject({unchanged:1,added:0});expect((await repo.list()).length).toBe(1);});
 it('updates metadata without losing user favorite state',async()=>{const repo=new InMemoryGameLibrary();await syncGameSources(repo,[source]);await repo.save({...await repo.get('moonlight:homebase:steam')!,favorite:true});const result=await syncGameSources(repo,[{...source,contentUri:'steam://updated'}]);expect(result.updated).toBe(1);expect((await repo.get('moonlight:homebase:steam'))?.favorite).toBe(true);});
});
