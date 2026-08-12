export interface PictureInPictureDocument {
  pictureInPictureEnabled?: boolean;
  pictureInPictureElement?: HTMLVideoElement | null;
  exitPictureInPicture?: () => Promise<void>;
}

export interface PictureInPictureVideo extends HTMLVideoElement {
  requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
}

export interface PictureInPictureController {
  isSupported(): boolean;
  isActive(): boolean;
  enter(): Promise<void>;
  exit(): Promise<void>;
  toggle(): Promise<void>;
}

export function createPictureInPictureController(
  video: PictureInPictureVideo,
  documentRef: PictureInPictureDocument = document,
): PictureInPictureController {
  const isSupported = () =>
    typeof video.requestPictureInPicture === 'function' &&
    documentRef.pictureInPictureEnabled !== false;

  const isActive = () => documentRef.pictureInPictureElement === video;

  const enter = async () => {
    if (!isSupported()) throw new Error('Picture-in-Picture is not available in this browser.');
    if (!isActive()) await video.requestPictureInPicture!();
  };

  const exit = async () => {
    if (isActive() && documentRef.exitPictureInPicture) await documentRef.exitPictureInPicture();
  };

  return {
    isSupported,
    isActive,
    enter,
    exit,
    async toggle() {
      if (isActive()) await exit();
      else await enter();
    },
  };
}
