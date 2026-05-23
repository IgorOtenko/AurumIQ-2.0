import type {
  AdapterResult,
  DataType,
  PriceData,
  EarningsData,
  AnalystData,
  OptionsData,
  ProfileData,
  NewsData,
} from './types';

type DataTypeMap = {
  price: PriceData;
  earnings: EarningsData;
  analyst: AnalystData;
  options: OptionsData;
  profile: ProfileData;
  news: NewsData;
};

async function parseError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return (body && typeof body.error === 'string' && body.error) || fallback;
}

export async function fetchFinanceData<T extends DataType>(
  ticker: string,
  type: T,
): Promise<AdapterResult<DataTypeMap[T]>> {
  const res = await fetch(`/api/finance/${ticker}?type=${type}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, `Failed to load ${type}`));
  const json = await res.json();
  return json.data as AdapterResult<DataTypeMap[T]>;
}
