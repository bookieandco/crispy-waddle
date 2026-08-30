export interface WebScoutRequest {
  query: string;
  domains?: string[];
  maxResults?: number;
}

export interface WebScoutDocument {
  url: string;
  title?: string;
  content: string;
  publishedAt?: string;
  fetchedAt: string;
  source: string;
}

export interface WebScout {
  search(request: WebScoutRequest): Promise<string[]>;
  crawl(url: string): Promise<WebScoutDocument>;
}

/** Boundary for a governed web-research implementation such as Crawl4AI. */
export class DelegatingWebScout implements WebScout {
  constructor(
    private readonly searcher: (request: WebScoutRequest) => Promise<string[]>,
    private readonly crawler: (url: string) => Promise<WebScoutDocument>,
  ) {}

  search(request: WebScoutRequest): Promise<string[]> {
    return this.searcher(request);
  }

  crawl(url: string): Promise<WebScoutDocument> {
    return this.crawler(url);
  }
}
