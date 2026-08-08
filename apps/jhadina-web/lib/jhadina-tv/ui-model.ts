import type { MediaItem, TVDevice } from './types'

export interface JhadinaTVHomeModel {
  sections: Array<{
    id: string
    title: string
    items: MediaItem[]
  }>
  devices: TVDevice[]
}

export const demoTVHomeModel: JhadinaTVHomeModel = {
  sections: [
    { id: 'continue-watching', title: 'Continue Watching', items: [] },
    { id: 'live-now', title: 'Live Now', items: [] },
    { id: 'recommended', title: 'Jhadina Recommends', items: [] },
  ],
  devices: [],
}
