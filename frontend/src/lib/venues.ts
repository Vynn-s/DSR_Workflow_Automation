import api from "./api";

export interface LiveVenue {
  id: string;
  name: string;
  description?: string | null;
  capacity: number;
  authorizedMinistries?: Array<{
    id: string;
    venueId: string;
    ministryId: string;
    ministry: {
      id: string;
      name: string;
    } | null;
  }>;
}

export async function fetchVenues() {
  const response = await api.get<{ venues: LiveVenue[] }>("/venues");
  return response.venues ?? [];
}