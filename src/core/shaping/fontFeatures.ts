import { logger } from '../../utils/Logger';

// Convert feature objects to HarfBuzz comma-separated format
export function convertFontFeaturesToString(
  features?: { [tag: string]: boolean | number }
): string | undefined {
  if (!features || Object.keys(features).length === 0) {
    return undefined;
  }

  const featureStrings: string[] = [];

  for (const [tag, value] of Object.entries(features)) {
    if (!/^[a-zA-Z0-9]{4}$/.test(tag)) {
      logger.warn(`Invalid OpenType feature tag: "${tag}". Tags must be exactly 4 alphanumeric characters.`);
      continue;
    }

    if (value === false || value === 0) {
      featureStrings.push(`${tag}=0`);
    } else if (value === true || value === 1) {
      featureStrings.push(tag);
    } else if (typeof value === 'number' && value > 1) {
      featureStrings.push(`${tag}=${Math.floor(value)}`);
    } else {
      logger.warn(`Invalid value for feature "${tag}": ${value}. Expected boolean or positive number.`);
    }
  }

  return featureStrings.length > 0 ? featureStrings.join(',') : undefined;
}

