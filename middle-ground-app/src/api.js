const API = '/api';

async function req(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const j = (body) => JSON.stringify(body);

export const api = {
  // Auth
  register: (b) => req('/auth/register', { method: 'POST', body: j(b) }),
  verifyPhone: (code) => req('/auth/verify-phone', { method: 'POST', body: j({ code }) }),
  resendCode: () => req('/auth/resend-code', { method: 'POST' }),
  login: (b) => req('/auth/login', { method: 'POST', body: j(b) }),
  logout: () => req('/auth/logout', { method: 'POST' }),
  me: () => req('/auth/me'),
  updateUser: (b) => req('/auth/me', { method: 'PATCH', body: j(b) }),

  // Spots & Maps
  searchMidpoint: (locations) =>
    req('/spots/search-midpoint', { method: 'POST', body: j({ locations }) }),
  nearbySpots: (params) => req(`/spots/nearby?${new URLSearchParams(params)}`),
  getDirections: (b) => req('/spots/directions', { method: 'POST', body: j(b) }),
  saveSpot: (b) => req('/spots/save', { method: 'POST', body: j(b) }),

  // Friends
  listFriends: () => req('/friends'),
  addFriend: (b) => req('/friends', { method: 'POST', body: j(b) }),
  updateFriend: (id, b) => req(`/friends/${id}`, { method: 'PATCH', body: j(b) }),
  removeFriend: (id) => req(`/friends/${id}`, { method: 'DELETE' }),

  // Itineraries
  createItinerary: (b) => req('/itineraries', { method: 'POST', body: j(b) }),
  listItineraries: () => req('/itineraries'),
  getItinerary: (id) => req(`/itineraries/${id}`),
  updateStop: (iId, sId, b) => req(`/itineraries/${iId}/stops/${sId}`, { method: 'PATCH', body: j(b) }),
  deleteItinerary: (id) => req(`/itineraries/${id}`, { method: 'DELETE' }),

  // Invites
  createInvite: (b) => req('/invites', { method: 'POST', body: j(b) }),
  listInvites: () => req('/invites'),
  updateInvite: (id, b) => req(`/invites/${id}`, { method: 'PATCH', body: j(b) }),

  // SMS
  sendItinerarySMS: (phone, itinerary_id) =>
    req('/sms/send-itinerary', { method: 'POST', body: j({ phone, itinerary_id }) }),
};
