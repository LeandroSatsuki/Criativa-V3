type NetlifyRuntime = {
  env: {
    get(name: string): string | undefined;
  };
};

const getRuntime = () => (globalThis as typeof globalThis & { Netlify?: NetlifyRuntime }).Netlify;

export const getEnv = (name: string) => getRuntime()?.env.get(name);
