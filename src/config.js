/**
 * Grafted3D site configuration.
 *
 * The inquiry form posts to VITE_INQUIRY_ENDPOINT when it is set at build time.
 * See README.md ("Connecting the inquiry form") for the expected request and
 * response, and for the file-upload constraints.
 *
 * While no endpoint is configured the form still validates input, but it will
 * never show a fake success state — it points visitors to MakerWorld instead.
 */
const env = import.meta.env || {};

export const INQUIRY_ENDPOINT = String(env.VITE_INQUIRY_ENDPOINT || '').trim();

/** Attachments are optional; 10 MB keeps requests within most form providers' limits. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_FILE_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'pdf',
  'stl',
  'obj',
  '3mf',
  'step',
  'stp',
  'zip',
];
