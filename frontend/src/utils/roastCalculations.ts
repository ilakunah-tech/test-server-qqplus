/**
 * Roast calculation utilities for charts and phase analysis.
 */

/**
 * Calculate Rate of Rise (RoR) - temperature change rate.
 * @param temps - array of temperatures
 * @param timex - array of times (in seconds)
 * @returns array of RoR values (°/min)
 */
export function calculateRoR(temps: number[], timex: number[]): number[] {
  if (!temps || !timex || temps.length < 2 || timex.length < 2) {
    return [];
  }
  
  const ror: number[] = [0]; // First value is 0 (no previous point)
  
  for (let i = 1; i < temps.length; i++) {
    const dt = (timex[i] - timex[i - 1]) / 60; // Convert seconds to minutes
    const dTemp = temps[i] - temps[i - 1];
    
    // Avoid division by zero
    if (dt > 0) {
      ror.push(dTemp / dt);
    } else {
      ror.push(0);
    }
  }
  
  return ror;
}

/**
 * Calculate Rate of Rise (RoR) with configurable time period (delta).
 * This calculates temperature change over a specified period (e.g., 30s or 60s)
 * which produces a smoother, more meaningful RoR curve like Artisan.
 * 
 * @param temps - array of temperatures
 * @param timex - array of times (in seconds)
 * @param deltaPeriod - time period in seconds (30 or 60)
 * @returns array of RoR values (°/min)
 */
export function calculateRoRWithPeriod(
  temps: number[],
  timex: number[],
  deltaPeriod: number = 30
): number[] {
  if (!temps || !timex || temps.length < 2 || timex.length < 2) {
    return [];
  }
  
  const ror: number[] = [];
  
  for (let i = 0; i < temps.length; i++) {
    const currentTime = timex[i];
    const targetTime = currentTime - deltaPeriod;
    
    // Find the index closest to targetTime
    let prevIdx = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (timex[j] <= targetTime) {
        prevIdx = j;
        break;
      }
      prevIdx = j;
    }
    
    // If we're at the beginning, use the first available point
    if (i === 0 || timex[i] === timex[prevIdx]) {
      ror.push(0);
      continue;
    }
    
    const dt = (timex[i] - timex[prevIdx]) / 60; // Convert to minutes
    const dTemp = temps[i] - temps[prevIdx];
    
    if (dt > 0) {
      ror.push(dTemp / dt);
    } else {
      ror.push(0);
    }
  }
  
  return ror;
}

/**
 * Downsample an array by taking every Nth element.
 * Preserves first and last elements.
 * 
 * @param arr - input array
 * @param step - take every Nth element (default 10)
 * @returns downsampled array
 */
export function downsample<T>(arr: T[], step: number = 10): T[] {
  if (!arr || arr.length <= step) return arr;
  
  const result: T[] = [];
  for (let i = 0; i < arr.length; i += step) {
    result.push(arr[i]);
  }
  
  // Always include the last element if not already included
  if ((arr.length - 1) % step !== 0) {
    result.push(arr[arr.length - 1]);
  }
  
  return result;
}

/**
 * Smooth RoR values using moving average.
 * @param ror - raw RoR values
 * @param windowSize - number of points to average (default 5)
 * @returns smoothed RoR values
 */
export function smoothRoR(ror: number[], windowSize: number = 5): number[] {
  if (!ror || ror.length < windowSize) {
    return ror;
  }
  
  const smoothed: number[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < ror.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(ror.length, i + halfWindow + 1);
    const slice = ror.slice(start, end);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    smoothed.push(avg);
  }
  
  return smoothed;
}

/**
 * Format seconds as MM:SS string.
 * @param seconds - time in seconds
 * @returns formatted time string
 */
export function formatTimeMMSS(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate phase percentages.
 * @param dryTime - dry phase end time (seconds)
 * @param fcTime - first crack time (seconds)
 * @param dropTime - drop time (seconds)
 * @returns phase percentages
 */
export function calculatePhases(
  dryTime: number | null | undefined,
  fcTime: number | null | undefined,
  dropTime: number | null | undefined
): {
  dryPercent: number | null;
  mailardPercent: number | null;
  devPercent: number | null;
  mailardTime: number | null;
} {
  if (!dropTime || dropTime <= 0) {
    return { dryPercent: null, mailardPercent: null, devPercent: null, mailardTime: null };
  }
  
  const dryPercent = dryTime != null ? (dryTime / dropTime) * 100 : null;
  
  let mailardTime: number | null = null;
  let mailardPercent: number | null = null;
  
  if (dryTime != null && fcTime != null && fcTime > dryTime) {
    mailardTime = fcTime - dryTime;
    mailardPercent = (mailardTime / dropTime) * 100;
  }
  
  let devPercent: number | null = null;
  if (fcTime != null && dropTime > fcTime) {
    devPercent = ((dropTime - fcTime) / dropTime) * 100;
  }
  
  return { dryPercent, mailardPercent, devPercent, mailardTime };
}

/**
 * Calculate weight loss percentage.
 * @param greenWeight - initial weight (kg)
 * @param roastedWeight - final weight (kg)
 * @returns weight loss percentage
 */
export function calculateWeightLoss(
  greenWeight: number | null | undefined,
  roastedWeight: number | null | undefined
): number | null {
  if (!greenWeight || greenWeight <= 0 || !roastedWeight || roastedWeight <= 0) {
    return null;
  }
  return ((greenWeight - roastedWeight) / greenWeight) * 100;
}

/**
 * Find nearest data point index for a given time.
 * @param timex - array of times
 * @param targetTime - target time to find
 * @returns index of nearest point
 */
export function findNearestTimeIndex(timex: number[], targetTime: number): number {
  if (!timex || timex.length === 0) return 0;
  
  let nearestIdx = 0;
  let nearestDiff = Math.abs(timex[0] - targetTime);
  
  for (let i = 1; i < timex.length; i++) {
    const diff = Math.abs(timex[i] - targetTime);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestIdx = i;
    }
  }
  
  return nearestIdx;
}
