import { rename, rm } from 'node:fs/promises';

/** The caller owns its same-filesystem staging/backup and holds the publication lock. */
export async function activateDirectory(
  stage: string,
  directory: string,
  previous: string,
) {
  await rm(previous, { recursive: true });
  await rename(directory, previous);
  try {
    await rename(stage, directory);
  } catch (error) {
    await rename(previous, directory);
    throw error;
  }
  await rm(previous, { recursive: true });
}
