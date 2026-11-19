// Seeds the hotel_features collection: one document per hotel, keyed by the
// MariaDB hotel_id. Run with:  mongosh "mongodb://127.0.0.1:27017/hotel_crs" --file mongo/hotel_features_seed.js
//
// The documents are deliberately NOT identical: each hotel describes itself
// with different amenities, policies and room features. That freedom is the
// reason this data lives in MongoDB instead of fixed SQL columns.

db.hotel_features.createIndex({ hotel_id: 1 }, { unique: true });

const hotels = [
  {
    hotel_id: 1, // Koramangala
    amenities: {
      general: ["free wifi", "parking", "coworking lounge", "24h reception"],
      wellness: ["gym"],
      policies: { pet_friendly: false, check_in_time: "14:00", check_out_time: "11:00", breakfast_included: true },
    },
    room_type_features: {
      Standard: { bed: "queen", work_desk: true, wifi_speed_mbps: 200 },
      Deluxe: { bed: "king", work_desk: true, city_view: true },
      Suite: { bed: "king", living_room: true, bathtub: true, lounge_access: true },
    },
  },
  {
    hotel_id: 2, // Andheri
    amenities: {
      general: ["free wifi", "airport shuttle", "restaurant", "24h reception"],
      wellness: ["gym"],
      policies: { pet_friendly: false, check_in_time: "15:00", check_out_time: "12:00", free_cancellation_hours: 48 },
    },
    room_type_features: {
      Standard: { bed: "double", soundproofing: true },
      Deluxe: { bed: "queen", minibar: true, soundproofing: true },
      Suite: { bed: "king", living_room: true, airport_view: true },
    },
  },
  {
    hotel_id: 3, // BKC
    amenities: {
      general: ["free wifi", "valet parking", "concierge", "business center", "restaurant"],
      wellness: ["spa", "pool", "gym"],
      policies: { pet_friendly: true, check_in_time: "14:00", check_out_time: "12:00", late_checkout_available: true },
    },
    room_type_features: {
      Standard: { bed: "queen", minibar: true },
      Deluxe: { bed: "king", skyline_view: true, minibar: true },
      Suite: { bed: "king", private_lounge: true, butler_service: true, bathtub: true },
    },
  },
];

hotels.forEach((doc) => db.hotel_features.replaceOne({ hotel_id: doc.hotel_id }, doc, { upsert: true }));
print(`hotel_features: ${db.hotel_features.countDocuments()} documents`);
