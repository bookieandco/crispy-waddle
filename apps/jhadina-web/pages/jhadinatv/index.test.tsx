import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import JhadinaTVHome from './index';

describe('JhadinaTV private iPhone home shell', () => {
  it('offers reachable 44px primary navigation and a wrapping iPhone header', () => {
    const html = renderToStaticMarkup(React.createElement(JhadinaTVHome));
    for (const destination of ['/jhadinatv/live', '/jhadinatv/movies', '/jhadinatv/tv']) {
      expect(html).toContain(`href="${destination}"`);
    }
    expect(html).toContain('flex-wrap:wrap');
    expect(html).toContain('min-height:44px');
    expect(html).toContain('Private TV locked or unavailable');
    expect(html).toContain('Owner sign-in');
  });

  it('does not claim a configured provider or certified live playback before server evidence', () => {
    const html = renderToStaticMarkup(React.createElement(JhadinaTVHome));
    expect(html).not.toContain('Live certified: yes');
    expect(html).not.toContain('configured, device test required');
    expect(html).toContain('Private TV readiness');
    expect(html).toContain('Your library is empty');
  });
});
