export interface JellyfinConnectionConfig {
  serverUrl: string;
  accessToken: string;
  userId: string;
  clientName?: string;
  clientVersion?: string;
  deviceId?: string;
}

export interface JellyfinItem {
  Id?: string;
  Name?: string;
  Overview?: string;
  ProductionYear?: number;
  RunTimeTicks?: number;
  Genres?: string[];
  CommunityRating?: number;
  Type?: string;
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  UserData?: JellyfinUserData;
}

export interface JellyfinUserData {
  Played?: boolean;
  PlaybackPositionTicks?: number;
  IsFavorite?: boolean;
  PlayCount?: number;
  LastPlayedDate?: string;
  PlayedPercentage?: number;
}

export interface JellyfinItemsResponse {
  Items?: JellyfinItem[];
  TotalRecordCount?: number;
}

export interface JellyfinMediaSource {
  Id?: string;
  Name?: string;
  Container?: string;
  Path?: string;
  Protocol?: string;
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  SupportsTranscoding?: boolean;
  RunTimeTicks?: number;
  Bitrate?: number;
  TranscodingUrl?: string;
  DirectStreamUrl?: string;
  SupportsProbing?: boolean;
  MediaStreams?: JellyfinMediaStream[];
}

export interface JellyfinMediaStream {
  Index?: number;
  Type?: string;
  Language?: string;
  DisplayTitle?: string;
  Codec?: string;
}

export interface JellyfinPlaybackInfoResponse {
  MediaSources?: JellyfinMediaSource[];
}

export interface JellyfinApiTransport {
  get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T>;
  post<T>(path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<T>;
}
