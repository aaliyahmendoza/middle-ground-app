import { useState, useEffect, useRef } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');`;

const MOCK_SPOTS = [
  { id: 1, name: "Verve Coffee Roasters", category: "Coffee", emoji: "☕", rating: 4.8, price: "$$", vibe: "Chill", eta_you: 11, eta_friend: 14, address: "816 Lincoln Ave", distance_mid: 0.3 },
  { id: 2, name: "Orchard Supply Hardware", category: "Shopping", emoji: "🛍️", rating: 4.2, price: "$", vibe: "Errand", eta_you: 9, eta_friend: 18, address: "520 E. Brokaw Rd", distance_mid: 1.1 },
  { id: 3, name: "Agave Restaurant", category: "Food", emoji: "🌮", rating: 4.6, price: "$$", vibe: "Casual Dining", eta_you: 13, eta_friend: 12, address: "1840 Saratoga Ave", distance_mid: 0.5 },
  { id: 4, name: "TopGolf San Jose", category: "Activity", emoji: "⛳", rating: 4.5, price: "$$$", vibe: "High Energy", eta_you: 18, eta_friend: 16, address: "1500 S 10th St", distance_mid: 0.9 },
  { id: 5, name: "Philz Coffee", category: "Coffee", emoji: "☕", rating: 4.7, price: "$$", vibe: "Chill", eta_you: 7, eta_friend: 21, address: "368 S. Murphy Ave", distance_mid: 2.1 },
  { id: 6, name: "Cinemark 16", category: "Entertainment", emoji: "🎬", rating: 4.3, price: "$$", vibe: "Chill", eta_you: 15, eta_friend: 13, address: "3161 Olsen Dr", distance_mid: 0.4 },
  { id: 7, name: "Dave & Buster's", category: "Activity", emoji: "🎮", rating: 4.4, price: "$$", vibe: "High Energy", eta_you: 12, eta_friend: 15, address: "940 Great Mall Dr", distance_mid: 0.7 },
  { id: 8, name: "Tartine Bakery", category: "Food", emoji: "🥐", rating: 4.9, price: "$$", vibe: "Quiet", eta_you: 10, eta_friend: 11, address: "200 W. Evelyn Ave", distance_mid: 0.2 },
];

const FRIENDS = [
  { id: 1, name: "Aaliyah", avatar: "A", location: "Sunnyvale, CA", color: "#E07C5A" },
  { id: 2, name: "Marcus", avatar: "M", location: "Santa Clara, CA", color: "#6B8F71" },
  { id: 3, name: "Priya", avatar: "P", location: "Mountain View, CA", color: "#7B5EA7" },
];

const MOCK_INVITES = [
  {
    id: 1,
    friend: FRIENDS[0],
    stops: [MOCK_SPOTS[2], MOCK_SPOTS[0]],
    date: "Sat, Jul 12",
    time: "2:00 PM",
    status: "pending",
    message: "Been craving tacos, then maybe grab coffee after?",
  },
  {
    id: 2,
    friend: FRIENDS[1],
    stops: [MOCK_SPOTS[3]],
    date: "Sun, Jul 13",
    time: "4:00 PM",
    status: "accepted",
    message: "Golf time! You down?",
  },
];

const ADVENTURE_FEED = [
  {
    id: 1,
    friend: FRIENDS[0],
    stops: [MOCK_SPOTS[2], MOCK_SPOTS[0]],
    date: "Jun 28",
    note: "Birria tacos were absolutely unreal 🤌 and the cortado after was perfect",
    photos: ["📸", "📸"],
    badge: "Met in the Middle",
  },
  {
    id: 2,
    friend: FRIENDS[1],
    stops: [MOCK_SPOTS[6], MOCK_SPOTS[5]],
    date: "Jun 20",
    note: "Lost 400 tickets at D&B but the nachos made up for it 😂",
    photos: ["📸"],
    badge: "Adventure Unlocked",
  },
];

const VIBES = ["All", "Chill", "High Energy", "Quiet", "Casual Dining", "Errand"];
const CATEGORIES = ["All", "Coffee", "Food", "Activity", "Shopping", "Entertainment"];

export default function App() {
  const [tab, setTab] = useState("plan");
  const [yourLocation, setYourLocation] = useState("San Jose, CA");
  const [friendLocation, setFriendLocation] = useState("Sunnyvale, CA");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState("All");
  const [selectedCat, setSelectedCat] = useState("All");
  const [itinerary, setItinerary] = useState([]);
  const [invites, setInvites] = useState(MOCK_INVITES);
  const [counterOffer, setCounterOffer] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(FRIENDS[0]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [showItinerary, setShowItinerary] = useState(false);
  const [routeOptimized, setRouteOptimized] = useState(false);
  const [pulseSpot, setPulseSpot] = useState(null);

  const filteredSpots = MOCK_SPOTS.filter(s => {
    if (selectedVibe !== "All" && s.vibe !== selectedVibe) return false;
    if (selectedCat !== "All" && s.category !== selectedCat) return false;
    return true;
  });

  function handleSearch() {
    if (!yourLocation || !friendLocation) return;
    setLoading(true);
    setSearched(false);
    setTimeout(() => { setLoading(false); setSearched(true); }, 1600);
  }

  function addToItinerary(spot) {
    if (itinerary.find(s => s.id === spot.id)) return;
    setItinerary(prev => [...prev, spot]);
    setPulseSpot(spot.id);
    setTimeout(() => setPulseSpot(null), 800);
  }

  function removeFromItinerary(id) {
    setItinerary(prev => prev.filter(s => s.id !== id));
  }

  function optimizeRoute() {
    const sorted = [...itinerary].sort((a, b) => a.distance_mid - b.distance_mid);
    setItinerary(sorted);
    setRouteOptimized(true);
    setTimeout(() => setRouteOptimized(false), 2000);
  }

  function sendInvite() {
    setShowInviteModal(false);
    setInviteSent(true);
    setTab("invites");
    setTimeout(() => setInviteSent(false), 3000);
    setInvites(prev => [{
      id: Date.now(),
      friend: selectedFriend,
      stops: itinerary,
      date: "Sat, Jul 19",
      time: "1:00 PM",
      status: "pending",
      message: "Check out this itinerary I planned for us!",
    }, ...prev]);
    setItinerary([]);
  }

  function handleInviteAction(id, action) {
    setInvites(prev => prev.map(inv => inv.id === id ? { ...inv, status: action } : inv));
  }

  const totalEtaYou = itinerary.reduce((sum, s) => sum + s.eta_you, 0);
  const totalEtaFriend = itinerary.reduce((sum, s) => sum + s.eta_friend, 0);

  const styles = `
    ${FONTS}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; background: #FAF6F1; color: #2C2416; }

    .app { max-width: 430px; margin: 0 auto; min-height: 100vh; background: #FAF6F1; position: relative; overflow-x: hidden; }

    /* Header */
    .header { padding: 20px 20px 0; }
    .logo { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: #2C2416; letter-spacing: -0.5px; }
    .logo span { color: #D4622A; }
    .tagline { font-size: 12px; color: #9A8A78; font-weight: 400; margin-top: 2px; letter-spacing: 0.5px; text-transform: uppercase; }

    /* Nav tabs */
    .nav { display: flex; gap: 4px; padding: 16px 20px 0; border-bottom: 1px solid #EDE5DA; }
    .nav-btn { flex: 1; padding: 10px 4px; background: none; border: none; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500; color: #9A8A78; cursor: pointer; text-align: center; border-bottom: 2px solid transparent; transition: all 0.2s; letter-spacing: 0.3px; text-transform: uppercase; }
    .nav-btn.active { color: #D4622A; border-bottom-color: #D4622A; }
    .nav-icon { font-size: 16px; display: block; margin-bottom: 2px; }

    /* Content */
    .content { padding: 20px; padding-bottom: 30px; }

    /* Location inputs */
    .location-section { margin-bottom: 16px; }
    .location-card { background: white; border-radius: 16px; padding: 16px; border: 1.5px solid #EDE5DA; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
    .loc-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
    .loc-row:not(:last-child) { border-bottom: 1px dashed #EDE5DA; }
    .loc-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .loc-dot.you { background: #D4622A; }
    .loc-dot.friend { background: #6B8F71; }
    .loc-label { font-size: 11px; color: #9A8A78; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 52px; flex-shrink: 0; }
    .loc-input { flex: 1; border: none; background: transparent; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; color: #2C2416; outline: none; }
    .loc-input::placeholder { color: #C4B8AC; }

    .friend-selector { display: flex; gap: 8px; margin-bottom: 12px; }
    .friend-chip { display: flex; align-items: center; gap: 6px; padding: 6px 12px 6px 8px; border-radius: 100px; border: 1.5px solid #EDE5DA; background: white; cursor: pointer; transition: all 0.2s; font-size: 13px; font-weight: 500; color: #2C2416; }
    .friend-chip.active { border-color: #D4622A; background: #FFF4EF; }
    .friend-avatar { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; flex-shrink: 0; }

    .search-btn { width: 100%; padding: 14px; background: #D4622A; color: white; border: none; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 12px; letter-spacing: 0.2px; }
    .search-btn:hover { background: #C0541F; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(212,98,42,0.3); }
    .search-btn:active { transform: translateY(0); }
    .search-btn:disabled { background: #D4B8A8; cursor: not-allowed; transform: none; box-shadow: none; }

    /* Loading */
    .loading-bar { height: 3px; background: #EDE5DA; border-radius: 100px; margin-top: 16px; overflow: hidden; }
    .loading-fill { height: 100%; background: linear-gradient(90deg, #D4622A, #E8A87C); border-radius: 100px; animation: loadAnim 1.6s ease-in-out infinite; }
    @keyframes loadAnim { 0% { width: 0%; margin-left: 0; } 50% { width: 60%; margin-left: 20%; } 100% { width: 0%; margin-left: 100%; } }

    /* Filter chips */
    .filters { margin-bottom: 16px; }
    .filter-label { font-size: 11px; font-weight: 600; color: #9A8A78; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip { padding: 5px 12px; border-radius: 100px; border: 1.5px solid #EDE5DA; background: white; font-size: 12px; font-weight: 500; color: #6B5B4E; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
    .chip.active { background: #2C2416; color: white; border-color: #2C2416; }

    /* Map viz */
    .map-viz { background: white; border-radius: 16px; height: 160px; border: 1.5px solid #EDE5DA; margin-bottom: 16px; position: relative; overflow: hidden; }
    .map-bg { width: 100%; height: 100%; position: absolute; inset: 0; }
    .map-label { position: absolute; top: 12px; left: 12px; font-size: 11px; font-weight: 600; color: #9A8A78; text-transform: uppercase; letter-spacing: 0.5px; background: white; padding: 4px 8px; border-radius: 100px; border: 1px solid #EDE5DA; }
    .map-you { position: absolute; bottom: 30px; left: 22%; font-size: 20px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); animation: bounce 2s ease-in-out infinite; }
    .map-friend { position: absolute; bottom: 42px; right: 18%; font-size: 20px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); animation: bounce 2s ease-in-out infinite 0.5s; }
    .map-mid { position: absolute; top: 30px; left: 50%; transform: translateX(-50%); font-size: 22px; filter: drop-shadow(0 2px 4px rgba(212,98,42,0.4)); animation: pulse 1.5s ease-in-out infinite; }
    .map-line { position: absolute; bottom: 48px; left: 22%; width: 56%; height: 1px; background: repeating-linear-gradient(90deg, #D4622A 0, #D4622A 6px, transparent 6px, transparent 12px); }
    @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    @keyframes pulse { 0%, 100% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) scale(1.15); } }

    /* Spot cards */
    .spots-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .spots-count { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; color: #2C2416; }
    .spot-card { background: white; border-radius: 16px; padding: 16px; border: 1.5px solid #EDE5DA; margin-bottom: 12px; transition: all 0.2s; position: relative; }
    .spot-card:hover { border-color: #D4622A; box-shadow: 0 4px 20px rgba(212,98,42,0.1); }
    .spot-card.in-itinerary { border-color: #6B8F71; background: #F6FBF7; }
    .spot-card.pulse { animation: cardPulse 0.6s ease; }
    @keyframes cardPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }

    .spot-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .spot-emoji { font-size: 28px; margin-bottom: 4px; }
    .spot-info { flex: 1; }
    .spot-name { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 600; color: #2C2416; margin-bottom: 3px; }
    .spot-meta { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
    .spot-cat { font-size: 11px; color: #D4622A; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .spot-rating { font-size: 12px; color: #2C2416; font-weight: 500; }
    .spot-price { font-size: 12px; color: #9A8A78; }
    .spot-vibe { font-size: 11px; background: #F3EEE8; color: #6B5B4E; padding: 2px 8px; border-radius: 100px; font-weight: 500; }
    .spot-address { font-size: 12px; color: #9A8A78; margin-bottom: 10px; }

    .eta-row { display: flex; gap: 8px; }
    .eta-pill { flex: 1; background: #F8F3EE; border-radius: 8px; padding: 8px 10px; }
    .eta-who { font-size: 10px; color: #9A8A78; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
    .eta-time { font-size: 15px; font-weight: 600; color: #2C2416; }
    .eta-time span { font-size: 11px; font-weight: 400; color: #9A8A78; }

    .add-btn { width: 100%; padding: 10px; border-radius: 10px; border: 1.5px solid #D4622A; background: transparent; color: #D4622A; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 10px; }
    .add-btn:hover { background: #D4622A; color: white; }
    .add-btn.added { background: #6B8F71; border-color: #6B8F71; color: white; cursor: default; }

    /* Itinerary panel */
    .itin-bar { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 430px; background: white; border-top: 1.5px solid #EDE5DA; padding: 12px 20px 20px; z-index: 100; box-shadow: 0 -8px 32px rgba(0,0,0,0.08); }
    .itin-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .itin-title { font-family: 'Playfair Display', serif; font-size: 15px; font-weight: 600; }
    .itin-toggle { font-size: 12px; color: #D4622A; font-weight: 600; cursor: pointer; }
    .itin-stops { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
    .itin-stop { display: flex; align-items: center; gap: 5px; background: #F8F3EE; border-radius: 8px; padding: 5px 8px; font-size: 12px; font-weight: 500; }
    .itin-remove { background: none; border: none; cursor: pointer; color: #9A8A78; font-size: 14px; padding: 0; line-height: 1; }
    .itin-arrow { color: #C4B8AC; font-size: 14px; align-self: center; }

    .itin-actions { display: flex; gap: 8px; }
    .itin-opt-btn { flex: 1; padding: 10px; border-radius: 10px; border: 1.5px solid #EDE5DA; background: white; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; color: #2C2416; transition: all 0.2s; }
    .itin-opt-btn:hover { border-color: #2C2416; }
    .itin-send-btn { flex: 2; padding: 10px; border-radius: 10px; background: #D4622A; color: white; border: none; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .itin-send-btn:hover { background: #C0541F; }

    /* Invites */
    .section-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #2C2416; margin-bottom: 4px; }
    .section-sub { font-size: 13px; color: #9A8A78; margin-bottom: 20px; }

    .invite-card { background: white; border-radius: 16px; padding: 16px; border: 1.5px solid #EDE5DA; margin-bottom: 14px; }
    .invite-card.accepted { border-color: #6B8F71; background: #F6FBF7; }
    .invite-top { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .invite-avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: white; flex-shrink: 0; }
    .invite-who { flex: 1; }
    .invite-name { font-weight: 600; font-size: 15px; color: #2C2416; }
    .invite-date { font-size: 12px; color: #9A8A78; margin-top: 1px; }
    .invite-status { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 100px; }
    .invite-status.pending { background: #FFF3E0; color: #E07C2A; }
    .invite-status.accepted { background: #E8F5E9; color: #3D8B4B; }
    .invite-status.declined { background: #FBE9E7; color: #C0392B; }

    .invite-message { font-size: 13px; color: #6B5B4E; font-style: italic; margin-bottom: 12px; padding: 10px 12px; background: #F8F3EE; border-radius: 8px; }

    .invite-stops { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; align-items: center; }
    .invite-stop-chip { display: flex; align-items: center; gap: 4px; background: #F3EEE8; border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 500; }
    .invite-eta-row { display: flex; gap: 8px; margin-bottom: 12px; }

    .invite-actions { display: flex; gap: 8px; }
    .accept-btn { flex: 2; padding: 10px; border-radius: 10px; background: #2C2416; color: white; border: none; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .accept-btn:hover { background: #3D3020; }
    .counter-btn { flex: 1; padding: 10px; border-radius: 10px; border: 1.5px solid #EDE5DA; background: white; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; color: #6B5B4E; transition: all 0.2s; }
    .counter-btn:hover { border-color: #6B5B4E; }
    .decline-btn { padding: 10px 14px; border-radius: 10px; border: 1.5px solid #F5C4BA; background: white; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; color: #C0392B; transition: all 0.2s; }
    .decline-btn:hover { background: #FBE9E7; }

    /* Counter offer modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(44,36,22,0.4); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
    .modal { background: white; width: 100%; max-width: 430px; border-radius: 24px 24px 0 0; padding: 24px 20px 36px; animation: slideUp 0.3s ease; }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .modal-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .modal-sub { font-size: 13px; color: #9A8A78; margin-bottom: 20px; }
    .modal-spots { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
    .modal-spot { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; border: 1.5px solid #EDE5DA; cursor: pointer; transition: all 0.15s; }
    .modal-spot.selected { border-color: #D4622A; background: #FFF4EF; }
    .modal-spot-name { flex: 1; font-size: 13px; font-weight: 500; }
    .modal-spot-eta { font-size: 12px; color: #9A8A78; }
    .modal-confirm { width: 100%; padding: 14px; background: #D4622A; color: white; border: none; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; }

    /* Feed */
    .feed-card { background: white; border-radius: 20px; padding: 16px; border: 1.5px solid #EDE5DA; margin-bottom: 16px; overflow: hidden; position: relative; }
    .feed-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .feed-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: white; }
    .feed-with { font-size: 14px; font-weight: 600; color: #2C2416; }
    .feed-date { font-size: 12px; color: #9A8A78; margin-top: 1px; }
    .feed-badge { font-size: 11px; background: #2C2416; color: #F4C87A; padding: 3px 10px; border-radius: 100px; font-weight: 600; margin-left: auto; }

    .feed-route { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
    .feed-stop { font-size: 12px; font-weight: 500; color: #6B5B4E; background: #F3EEE8; padding: 4px 10px; border-radius: 8px; }
    .feed-arrow { color: #C4B8AC; font-size: 12px; }

    .feed-note { font-size: 14px; color: #2C2416; line-height: 1.5; margin-bottom: 12px; }
    .feed-photos { display: flex; gap: 8px; margin-bottom: 12px; }
    .feed-photo { flex: 1; height: 80px; background: linear-gradient(135deg, #F3EEE8, #EDE0D0); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
    .steal-btn { width: 100%; padding: 10px; border-radius: 10px; border: 1.5px solid #EDE5DA; background: white; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; color: #6B5B4E; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; }
    .steal-btn:hover { border-color: #2C2416; color: #2C2416; }

    /* Toast */
    .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #2C2416; color: white; padding: 12px 20px; border-radius: 100px; font-size: 14px; font-weight: 500; z-index: 300; animation: toastIn 0.3s ease; white-space: nowrap; }
    @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

    /* Empty state */
    .empty { text-align: center; padding: 40px 20px; }
    .empty-emoji { font-size: 40px; margin-bottom: 12px; }
    .empty-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; color: #2C2416; margin-bottom: 6px; }
    .empty-sub { font-size: 13px; color: #9A8A78; line-height: 1.5; }

    .optimized-badge { background: #E8F5E9; color: #3D8B4B; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 100px; animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .suggestion-banner { background: linear-gradient(135deg, #FFF4EF, #FFF9F5); border: 1.5px solid #F5C4A4; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; }
    .suggestion-text { font-size: 12px; color: #6B5B4E; line-height: 1.4; }
    .suggestion-text strong { color: #D4622A; }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        {inviteSent && <div className="toast">📬 Invite sent to {selectedFriend.name}!</div>}

        <div className="header">
          <div className="logo">the <span>middle</span> ground</div>
          <div className="tagline">Meet halfway, no compromises</div>
        </div>

        <div className="nav">
          {[
            { id: "plan", icon: "🗺️", label: "Plan" },
            { id: "invites", icon: "💌", label: "Invites" },
            { id: "feed", icon: "✨", label: "Feed" },
          ].map(t => (
            <button key={t.id} className={`nav-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>
              {t.label}
              {t.id === "invites" && invites.filter(i => i.status === "pending").length > 0 && (
                <span style={{ marginLeft: 4, background: "#D4622A", color: "white", borderRadius: "100px", fontSize: "10px", padding: "1px 5px", fontWeight: 700 }}>
                  {invites.filter(i => i.status === "pending").length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="content" style={{ paddingBottom: itinerary.length > 0 ? 160 : 30 }}>

          {/* ── PLAN TAB ── */}
          {tab === "plan" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, color: "#9A8A78", marginBottom: 8, marginTop: 4 }}>Planning with</div>
                <div className="friend-selector">
                  {FRIENDS.map(f => (
                    <button key={f.id} className={`friend-chip ${selectedFriend.id === f.id ? "active" : ""}`} onClick={() => { setSelectedFriend(f); setFriendLocation(f.location); }}>
                      <div className="friend-avatar" style={{ background: f.color }}>{f.avatar}</div>
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="location-section">
                <div className="location-card">
                  <div className="loc-row">
                    <div className="loc-dot you"></div>
                    <span className="loc-label">You</span>
                    <input className="loc-input" value={yourLocation} onChange={e => setYourLocation(e.target.value)} placeholder="Your location…" />
                  </div>
                  <div className="loc-row">
                    <div className="loc-dot friend"></div>
                    <span className="loc-label">{selectedFriend.name}</span>
                    <input className="loc-input" value={friendLocation} onChange={e => setFriendLocation(e.target.value)} placeholder="Friend's location…" />
                  </div>
                </div>
                <button className="search-btn" onClick={handleSearch} disabled={loading || !yourLocation || !friendLocation}>
                  {loading ? "Finding your sweet spot…" : "🎯 Find the Middle Ground"}
                </button>
                {loading && <div className="loading-bar"><div className="loading-fill" /></div>}
              </div>

              {searched && (
                <>
                  {/* Map viz */}
                  <div className="map-viz">
                    <svg className="map-bg" viewBox="0 0 390 160" xmlns="http://www.w3.org/2000/svg">
                      <rect width="390" height="160" fill="#EDF2EC" />
                      {[20, 50, 80, 110, 140].map(y => (
                        <line key={y} x1="0" y1={y} x2="390" y2={y} stroke="#DDE8DB" strokeWidth="1" />
                      ))}
                      {[60, 120, 180, 240, 300, 360].map(x => (
                        <line key={x} x1={x} y1="0" x2={x} y2="160" stroke="#DDE8DB" strokeWidth="1" />
                      ))}
                      <path d="M0,90 C80,80 150,100 195,75 C240,50 310,85 390,70" fill="none" stroke="#C8DBC4" strokeWidth="18" strokeLinecap="round" />
                      <path d="M0,90 C80,80 150,100 195,75 C240,50 310,85 390,70" fill="none" stroke="#B8D0B4" strokeWidth="4" strokeDasharray="8,6" />
                      <circle cx="75" cy="110" r="20" fill="#E8F2E5" stroke="#B8D0B4" strokeWidth="1.5" />
                      <circle cx="310" cy="95" r="15" fill="#E8F2E5" stroke="#B8D0B4" strokeWidth="1.5" />
                    </svg>
                    <div className="map-label">📍 Sweet Spot Zone</div>
                    <div className="map-you">📍</div>
                    <div className="map-friend">📍</div>
                    <div className="map-mid">🎯</div>
                    <div className="map-line" />
                    <div style={{ position: "absolute", bottom: 10, left: "22%", fontSize: 10, fontWeight: 600, color: "#D4622A", fontFamily: "DM Sans, sans-serif" }}>You</div>
                    <div style={{ position: "absolute", bottom: 10, right: "14%", fontSize: 10, fontWeight: 600, color: "#6B8F71", fontFamily: "DM Sans, sans-serif" }}>{selectedFriend.name}</div>
                  </div>

                  {itinerary.length >= 2 && (
                    <div className="suggestion-banner">
                      <span style={{ fontSize: 18 }}>✨</span>
                      <div className="suggestion-text">
                        <strong>On your way suggestion:</strong> {itinerary[itinerary.length - 1].name} is close to {MOCK_SPOTS.find(s => !itinerary.includes(s))?.name} — add it as a bonus stop!
                      </div>
                    </div>
                  )}

                  {/* Filters */}
                  <div className="filters">
                    <div className="filter-label">Category</div>
                    <div className="chips" style={{ marginBottom: 8 }}>
                      {CATEGORIES.map(c => (
                        <button key={c} className={`chip ${selectedCat === c ? "active" : ""}`} onClick={() => setSelectedCat(c)}>{c}</button>
                      ))}
                    </div>
                    <div className="filter-label" style={{ marginTop: 8 }}>Vibe</div>
                    <div className="chips">
                      {VIBES.map(v => (
                        <button key={v} className={`chip ${selectedVibe === v ? "active" : ""}`} onClick={() => setSelectedVibe(v)}>{v}</button>
                      ))}
                    </div>
                  </div>

                  <div className="spots-header">
                    <div className="spots-count">{filteredSpots.length} spots near the middle</div>
                  </div>

                  {filteredSpots.map(spot => (
                    <div key={spot.id} className={`spot-card ${itinerary.find(s => s.id === spot.id) ? "in-itinerary" : ""} ${pulseSpot === spot.id ? "pulse" : ""}`}>
                      <div className="spot-top">
                        <div>
                          <div className="spot-emoji">{spot.emoji}</div>
                        </div>
                        <div className="spot-info">
                          <div className="spot-name">{spot.name}</div>
                          <div className="spot-meta">
                            <span className="spot-cat">{spot.category}</span>
                            <span className="spot-rating">⭐ {spot.rating}</span>
                            <span className="spot-price">{spot.price}</span>
                            <span className="spot-vibe">{spot.vibe}</span>
                          </div>
                          <div className="spot-address">📍 {spot.address}</div>
                        </div>
                      </div>

                      <div className="eta-row">
                        <div className="eta-pill">
                          <div className="eta-who">⚪ You</div>
                          <div className="eta-time">{spot.eta_you} <span>min</span></div>
                        </div>
                        <div className="eta-pill">
                          <div className="eta-who">🟢 {selectedFriend.name}</div>
                          <div className="eta-time">{spot.eta_friend} <span>min</span></div>
                        </div>
                        <div className="eta-pill">
                          <div className="eta-who">⚖️ Fair?</div>
                          <div className="eta-time" style={{ color: Math.abs(spot.eta_you - spot.eta_friend) <= 5 ? "#3D8B4B" : "#D4622A" }}>
                            {Math.abs(spot.eta_you - spot.eta_friend) <= 5 ? "Yes ✓" : `~${Math.abs(spot.eta_you - spot.eta_friend)}m off`}
                          </div>
                        </div>
                      </div>

                      <button
                        className={`add-btn ${itinerary.find(s => s.id === spot.id) ? "added" : ""}`}
                        onClick={() => !itinerary.find(s => s.id === spot.id) && addToItinerary(spot)}
                      >
                        {itinerary.find(s => s.id === spot.id) ? "✓ Added to Itinerary" : "+ Add to Itinerary"}
                      </button>
                    </div>
                  ))}
                </>
              )}

              {!searched && !loading && (
                <div className="empty">
                  <div className="empty-emoji">🤝</div>
                  <div className="empty-title">No more "Is that too far?"</div>
                  <div className="empty-sub">Enter yours and {selectedFriend.name}'s location to find spots that are fair for both of you — with live ETAs for each.</div>
                </div>
              )}
            </>
          )}

          {/* ── INVITES TAB ── */}
          {tab === "invites" && (
            <>
              <div className="section-title">Your Invites</div>
              <div className="section-sub">{invites.filter(i => i.status === "pending").length} pending · {invites.filter(i => i.status === "accepted").length} accepted</div>

              {invites.map(inv => (
                <div key={inv.id} className={`invite-card ${inv.status === "accepted" ? "accepted" : ""}`}>
                  <div className="invite-top">
                    <div className="invite-avatar" style={{ background: inv.friend.color }}>{inv.friend.avatar}</div>
                    <div className="invite-who">
                      <div className="invite-name">{inv.friend.name} invited you</div>
                      <div className="invite-date">🗓 {inv.date} at {inv.time}</div>
                    </div>
                    <span className={`invite-status ${inv.status}`}>{inv.status === "pending" ? "Pending" : inv.status === "accepted" ? "Going ✓" : "Declined"}</span>
                  </div>

                  <div className="invite-message">"{inv.message}"</div>

                  <div className="invite-stops">
                    {inv.stops.map((stop, i) => (
                      <>
                        <div key={stop.id} className="invite-stop-chip">{stop.emoji} {stop.name}</div>
                        {i < inv.stops.length - 1 && <span className="feed-arrow">→</span>}
                      </>
                    ))}
                  </div>

                  <div className="invite-eta-row">
                    {inv.stops.slice(0, 1).map(stop => (
                      <>
                        <div key="you" className="eta-pill">
                          <div className="eta-who">⚪ You</div>
                          <div className="eta-time">{stop.eta_you} <span>min total</span></div>
                        </div>
                        <div key="friend" className="eta-pill">
                          <div className="eta-who" style={{ color: inv.friend.color }}>● {inv.friend.name}</div>
                          <div className="eta-time">{stop.eta_friend} <span>min total</span></div>
                        </div>
                      </>
                    ))}
                  </div>

                  {inv.status === "pending" && (
                    <div className="invite-actions">
                      <button className="accept-btn" onClick={() => handleInviteAction(inv.id, "accepted")}>✓ Accept</button>
                      <button className="counter-btn" onClick={() => setCounterOffer(inv.id)}>🔄 Counter</button>
                      <button className="decline-btn" onClick={() => handleInviteAction(inv.id, "declined")}>✕</button>
                    </div>
                  )}
                  {inv.status === "accepted" && (
                    <div style={{ fontSize: 13, color: "#3D8B4B", fontWeight: 600, textAlign: "center", padding: "8px 0 0" }}>🎉 You're going! See you there.</div>
                  )}
                </div>
              ))}

              {invites.length === 0 && (
                <div className="empty">
                  <div className="empty-emoji">💌</div>
                  <div className="empty-title">No invites yet</div>
                  <div className="empty-sub">Build an itinerary in the Plan tab and send it to a friend!</div>
                </div>
              )}
            </>
          )}

          {/* ── FEED TAB ── */}
          {tab === "feed" && (
            <>
              <div className="section-title">Adventure Feed</div>
              <div className="section-sub">Past hangouts from your crew</div>

              {ADVENTURE_FEED.map(item => (
                <div key={item.id} className="feed-card">
                  <div className="feed-header">
                    <div className="feed-avatar" style={{ background: item.friend.color }}>{item.friend.avatar}</div>
                    <div>
                      <div className="feed-with">You & {item.friend.name}</div>
                      <div className="feed-date">{item.date}</div>
                    </div>
                    <span className="feed-badge">⭐ {item.badge}</span>
                  </div>

                  <div className="feed-route">
                    {item.stops.map((stop, i) => (
                      <>
                        <div key={stop.id} className="feed-stop">{stop.emoji} {stop.name}</div>
                        {i < item.stops.length - 1 && <span className="feed-arrow">→</span>}
                      </>
                    ))}
                  </div>

                  <div className="feed-photos">
                    {item.photos.map((p, i) => (
                      <div key={i} className="feed-photo">{p}</div>
                    ))}
                    <div className="feed-photo" style={{ background: "linear-gradient(135deg, #E8F2E5, #D4E8D0)" }}>
                      <span style={{ fontSize: 20 }}>+</span>
                    </div>
                  </div>

                  <div className="feed-note">"{item.note}"</div>

                  <button className="steal-btn" onClick={() => { setItinerary(item.stops); setTab("plan"); setSearched(true); }}>
                    📌 Steal This Itinerary
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── ITINERARY BAR ── */}
        {itinerary.length > 0 && (
          <div className="itin-bar">
            <div className="itin-header">
              <div className="itin-title">
                Your Plan · {itinerary.length} stop{itinerary.length > 1 ? "s" : ""}
                {routeOptimized && <span className="optimized-badge" style={{ marginLeft: 8 }}>✓ Optimized</span>}
              </div>
              <span className="itin-toggle" onClick={() => setItinerary([])}>Clear</span>
            </div>
            <div className="itin-stops">
              {itinerary.map((stop, i) => (
                <>
                  <div key={stop.id} className="itin-stop">
                    <span>{stop.emoji}</span>
                    <span style={{ fontSize: 12 }}>{stop.name.split(" ").slice(0, 2).join(" ")}</span>
                    <button className="itin-remove" onClick={() => removeFromItinerary(stop.id)}>×</button>
                  </div>
                  {i < itinerary.length - 1 && <span key={`arr-${i}`} className="itin-arrow">→</span>}
                </>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#9A8A78", marginBottom: 10 }}>
              <span>⚪ You: ~{totalEtaYou} min</span>
              <span>🟢 {selectedFriend.name}: ~{totalEtaFriend} min</span>
            </div>
            <div className="itin-actions">
              {itinerary.length > 1 && (
                <button className="itin-opt-btn" onClick={optimizeRoute}>⚡ Optimize Route</button>
              )}
              <button className="itin-send-btn" onClick={() => setShowInviteModal(true)}>
                📬 Send to {selectedFriend.name}
              </button>
            </div>
          </div>
        )}

        {/* ── SEND INVITE MODAL ── */}
        {showInviteModal && (
          <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Send to {selectedFriend.name}</div>
              <div className="modal-sub">Your itinerary · {itinerary.length} stops</div>
              <div className="modal-spots">
                {itinerary.map((stop, i) => (
                  <div key={stop.id} className="modal-spot selected">
                    <span style={{ fontSize: 22 }}>{stop.emoji}</span>
                    <span className="modal-spot-name">{stop.name}</span>
                    <span className="modal-spot-eta">You: {stop.eta_you}m · {selectedFriend.name}: {stop.eta_friend}m</span>
                  </div>
                ))}
              </div>
              <button className="modal-confirm" onClick={sendInvite}>📬 Send Invite →</button>
            </div>
          </div>
        )}

        {/* ── COUNTER OFFER MODAL ── */}
        {counterOffer && (
          <div className="modal-overlay" onClick={() => setCounterOffer(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Suggest a Swap</div>
              <div className="modal-sub">Pick an alternative spot nearby</div>
              <div className="modal-spots">
                {MOCK_SPOTS.slice(0, 4).map(spot => (
                  <div key={spot.id} className="modal-spot" onClick={() => { handleInviteAction(counterOffer, "counter"); setCounterOffer(null); }}>
                    <span style={{ fontSize: 22 }}>{spot.emoji}</span>
                    <span className="modal-spot-name">{spot.name}</span>
                    <span className="modal-spot-eta">{spot.eta_you}m · {spot.eta_friend}m</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
