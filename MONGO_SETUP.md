# MongoDB Phase 1 setup

Run this against the `hotel_crs` database after the MariaDB seed creates the
hotels:

```javascript
db.hotel_features.createIndex({ hotel_id: 1 }, { unique: true })
db.hotel_features.insertMany([
  { hotel_id: 1, amenities: { general: ["free wifi", "parking"], wellness: ["pool", "gym"], policies: { pet_friendly: true } }, room_type_features: {} },
  { hotel_id: 2, amenities: { general: ["free wifi", "parking"], wellness: ["gym"], policies: { pet_friendly: false } }, room_type_features: {} }
])
```
