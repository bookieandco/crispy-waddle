export type FeedItemType =
  | 'approval'
  | 'opportunity'
  | 'video'
  | 'social_post'
  | 'research'
  | 'tv'
  | 'alert'
  | 'sponsored';

export type FeedState = 'unread' | 'engaged' | 'pending' | 'executed' | 'deferred' | 'archived';

export type FeedAction = {
  id: string;
  label: string;
  kind: 'primary' | 'secondary' | 'danger' | 'neutral';
};

export type FeedMedia = {
  provider: 'youtube' | 'facebook' | 'jhadina_tv' | 'upload';
  videoId?: string;
  url?: string;
  thumbnailUrl?: string;
  duration?: string;
  live?: boolean;
};

export type JhadinaFeedItem = {
  id: string;
  type: FeedItemType;
  title: string;
  summary: string;
  reason: string;
  source: string;
  timestamp: string;
  score: number;
  state: FeedState;
  impact?: {
    label: string;
    value: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  };
  media?: FeedMedia;
  actions: FeedAction[];
  tags?: string[];
};
