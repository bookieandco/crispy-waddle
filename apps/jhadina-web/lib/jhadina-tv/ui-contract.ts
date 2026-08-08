export const JHADINA_TV_NAV = [
  { id: 'home', label: 'Home' },
  { id: 'live', label: 'Live TV' },
  { id: 'movies', label: 'Movies' },
  { id: 'shows', label: 'Shows' },
  { id: 'guide', label: 'Guide' },
  { id: 'watchlist', label: 'My List' },
] as const

export const JHADINA_TV_ROUTES = {
  home: '/jhadina-tv',
  live: '/jhadina-tv/live',
  movies: '/jhadina-tv/movies',
  shows: '/jhadina-tv/shows',
  guide: '/jhadina-tv/guide',
  watchlist: '/jhadina-tv/watchlist',
} as const

export type JhadinaTVNavId = (typeof JHADINA_TV_NAV)[number]['id']
