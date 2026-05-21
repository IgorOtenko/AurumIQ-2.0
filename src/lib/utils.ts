import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for composing Tailwind CSS classes without conflicts.
// clsx handles conditional class names; twMerge resolves Tailwind
// specificity conflicts (e.g., "px-2 px-4" -> "px-4").
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
