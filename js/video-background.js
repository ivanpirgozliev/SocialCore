/**
 * SocialCore - Video Background Controller
 * 
 * Handles lifecycle management for the homepage video background:
 * - Pauses video when tab is not visible (performance)
 * - Resumes video when tab becomes visible
 * - Ensures smooth autoplay behavior
 */

/**
 * Initialize video background controls
 * @param {HTMLVideoElement} video - The video element to control
 */
export function initVideoBackground(video) {
  if (!video) {
    console.warn('[VideoBackground] No video element provided');
    return;
  }

  // Handle visibility change (pause when tab hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      video.pause();
    } else {
      // Resume playback when tab is visible
      video.play().catch(() => {
        // Autoplay may be blocked, that's okay
      });
    }
  });

  // Ensure video plays (some browsers block autoplay)
  video.play().catch(() => {
    // Autoplay blocked - video will remain paused
    // User interaction may be needed
  });

  // Optional: Add slow zoom effect
  let scale = 1;
  let direction = 1;
  const ZOOM_SPEED = 0.00003;
  const MAX_SCALE = 1.08;
  const MIN_SCALE = 1;

  function animateZoom() {
    scale += ZOOM_SPEED * direction;
    
    if (scale >= MAX_SCALE) {
      direction = -1;
    } else if (scale <= MIN_SCALE) {
      direction = 1;
    }
    
    video.style.transform = `scale(${scale})`;
    requestAnimationFrame(animateZoom);
  }

  // Start subtle zoom animation
  animateZoom();

  console.log('[VideoBackground] Initialized');
}

/**
 * Cleanup video background (call when navigating away)
 */
export function disposeVideoBackground() {
  // Nothing specific to clean up for now
  // The video element will be removed with the page
  console.log('[VideoBackground] Disposed');
}
