import { describe, expect, it } from 'vitest';
import { addCinematicNote, createCinematicNotebook, searchCinematicNotes } from './cinematic-notebook.js';
import { addWatchBookmark, createWatchSession } from './watch-session.js';

describe('Watch + Cinematic Notebook', () => {
  it('attaches bookmarks to the watched source timecode', () => {
    const session = createWatchSession({ id: 'film-1', title: 'Study', kind: 'authorized-stream', url: 'https://example.test/stream.m3u8' }, 'session-1');
    const next = addWatchBookmark(session, { id: 'b1', startSeconds: 42.5, note: 'Hold the reaction.' });
    expect(next.bookmarks[0]).toMatchObject({ sourceId: 'film-1', startSeconds: 42.5, note: 'Hold the reaction.' });
  });

  it('searches cinematic notes without losing the original note text', () => {
    let notebook = createCinematicNotebook('book-1');
    notebook = addCinematicNote(notebook, { id: 'n1', sourceId: 'film-1', body: 'Slow push-in makes the reveal land.', kind: 'camera', tags: ['push-in', 'reveal'] });
    notebook = addCinematicNote(notebook, { id: 'n2', sourceId: 'film-1', body: 'Music enters before the cut.', kind: 'sound', tags: ['music'] });
    expect(searchCinematicNotes(notebook, 'reveal')).toHaveLength(1);
    expect(searchCinematicNotes(notebook, 'reveal')[0].body).toContain('reveal land');
  });
});
