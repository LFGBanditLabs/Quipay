import axios from "axios";

export interface Stream {
  id: string;
  recipient: string;
  amount: number;
  startTime: number;
  endTime: number;
  status: "active" | "completed" | "cancelled";
}

export const fetchStreamById = async (id: string): Promise<Stream> => {
  const { data } = await axios.get<Stream>(`/api/streams/${id}`);
  return data;
};

export interface StreamsResponse {
  data: Stream[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const fetchStreams = async (
  cursor?: string,
): Promise<StreamsResponse> => {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.append("cursor", cursor);

  const { data } = await axios.get<StreamsResponse>(`/api/streams?${params}`);
  return data;
};
