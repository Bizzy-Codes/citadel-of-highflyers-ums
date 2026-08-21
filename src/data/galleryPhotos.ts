// Single source of truth for gallery photos, shared by the homepage
// preview strip and the full /gallery page so they never drift.
// Drop the matching file into public/gallery/ (see GALLERY.md) to
// replace a placeholder -- no code change needed for existing slots.
// To add a new photo slot, add an entry here with a new filename.

export type GalleryCategory =
  | 'Academics'
  | 'Sports'
  | 'Excursions & Nature'
  | 'School Activities'
  | 'Playground & Recreation'
  | 'International School Involvement';

export interface GalleryPhoto {
  file: string;
  label: string;
  category: GalleryCategory;
}

export const GALLERY_CATEGORIES: GalleryCategory[] = [
  'Academics',
  'Sports',
  'Excursions & Nature',
  'School Activities',
  'Playground & Recreation',
  'International School Involvement',
];

export const GALLERY_PHOTOS: GalleryPhoto[] = [
  { file: 'gallery-1.jpg', label: 'Class photographs', category: 'Academics' },
  { file: 'gallery-2.jpg', label: 'Playground Fun', category: 'Playground & Recreation' },
  { file: 'gallery-3.jpg', label: 'Outdoor Play', category: 'Playground & Recreation' },
  { file: 'gallery-4.jpg', label: 'Pupil Spotlight', category: 'School Activities' },
  { file: 'gallery-5.jpg', label: 'Career-Day', category: 'School Activities' },
  { file: 'gallery-6.jpg', label: 'Special Guests Visit', category: 'International School Involvement' },
  { file: 'gallery-7.jpg', label: 'Inter-House Sports Day', category: 'Sports' },
  { file: 'gallery-8.jpg', label: 'Playground Time', category: 'Playground & Recreation' },
  { file: 'gallery-9.jpg', label: 'Nature & Gardening', category: 'Excursions & Nature' },
];
