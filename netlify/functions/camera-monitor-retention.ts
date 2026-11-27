import type { Config } from '@netlify/functions';
import { withFreshNetlifyStore } from './_shared/storage';
import { isoDay, DAY } from './_shared/camera-signals';

export default async () => {
  const cutoff = isoDay(Date.now() - 7 * DAY);
  await withFreshNetlifyStore('criativa-camera-signals-v1', async store => {
    const { directories } = await store.list({directories:true});
    let removed = 0;
    for (const dir of directories.sort()) {
      const day = dir.replace(/\/$/,'');
      if (!/^\d{4}-\d\d-\d\d$/.test(day) || day >= cutoff) continue;
      for await (const { blobs } of store.list({prefix:day+'/',paginate:true})) {
        for (let i=0;i<blobs.length;i+=8) {
          await Promise.all(blobs.slice(i,i+8).map(b => store.delete(b.key)));
          removed += Math.min(8,blobs.length-i);
          if (removed >= 256) return;
        }
      }
    }
  });
};
export const config: Config = { schedule:'*/30 * * * *' };
