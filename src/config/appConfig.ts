const DEFAULT_INDUSTRIES = ['Veneza', 'Idealpan', 'Maricota', 'VidaVeg'];

const parseList = (value?: string) =>
  value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

const env = import.meta.env;
const parsedIndustries = parseList(env.VITE_DEFAULT_INDUSTRIES);

export const appConfig = {
  title: env.VITE_APP_TITLE?.trim() || 'Criativa Field Ops',
  apiBaseUrl: env.VITE_API_BASE_URL?.trim() || '/api',
  defaultIndustries: parsedIndustries.length > 0 ? parsedIndustries : DEFAULT_INDUSTRIES,
};
