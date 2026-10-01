'use client';

import { AnimatePresence, motion } from 'framer-motion';

export default function PortraitEasel({
  open,
  imageUrl,
  petName,
}: {
  open: boolean;
  imageUrl: string | null;
  petName: string;
}) {
  return (
    <AnimatePresence>
      {open && imageUrl && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/55 px-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-live="polite"
        >
          <motion.div
            className="w-full max-w-sm"
            initial={{ y: 34, scale: 0.94 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 24, scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
          >
            <div className="mx-auto w-[78%] rounded-sm border-[10px] border-[#8d5f36] bg-[#f5ead8] p-2 shadow-2xl">
              <div className="relative aspect-square overflow-hidden bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <motion.img
                  src={imageUrl}
                  alt={`Generated portrait of ${petName}`}
                  className="h-full w-full object-contain"
                  initial={{ clipPath: 'inset(100% 0 0 0)', filter: 'saturate(.7)' }}
                  animate={{ clipPath: 'inset(0% 0 0 0)', filter: 'saturate(1)' }}
                  transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
                />
                <motion.div
                  className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/55 to-transparent"
                  initial={{ x: '-120%' }}
                  animate={{ x: '900%' }}
                  transition={{ duration: 1.2, ease: 'easeInOut' }}
                />
              </div>
            </div>
            <div className="mx-auto h-24 w-2 bg-[#7a4d2a]" />
            <div className="mx-auto -mt-1 h-2 w-36 rounded-full bg-[#7a4d2a]" />
            <p className="mt-4 text-center font-display text-lg text-cream">
              {petName}&apos;s portrait is coming to life
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
