import axios, { AxiosRequestConfig } from "axios";
import { executeWithBreaker, classifyServiceFromUrl } from "./circuitBreaker";

export async function httpPost<T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
  service?: string,
): Promise<T> {
  const svc = service || classifyServiceFromUrl(url);
  return executeWithBreaker<T>(
    `http:${svc}`,
    async () => {
      const res = await axios.post(url, data, config);
      return res.data as T;
    },
    [],
  );
}

export async function httpGet<T = any>(
  url: string,
  config?: AxiosRequestConfig,
  service?: string,
): Promise<T> {
  const svc = service || classifyServiceFromUrl(url);
  return executeWithBreaker<T>(
    `http:${svc}`,
    async () => {
      const res = await axios.get(url, config);
      return res.data as T;
    },
    [],
  );
}
