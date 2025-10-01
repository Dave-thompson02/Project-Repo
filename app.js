const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = 3000;
// BEGINNING OF ADDITION !!!!!!
const client = require('prom-client');

// collect default Node/Process metrics
client.collectDefaultMetrics();

// optional: histogram for request duration
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'request duration in seconds',
  labelNames: ['method','route','status_code'],
  buckets: [0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2,5]
});

// simple middleware to observe each request
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const secs = Number(process.hrtime.bigint() - start) / 1e9;
    const route = req.route?.path || req.path || 'unknown_route';
    httpRequestDuration.labels(req.method, route, String(res.statusCode)).observe(secs);
  });
  next();
});

// /metrics endpoint for Prometheus
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
// END OF ADDITION !!!!!!!!!!!!!!

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // sert index.html

// --- Données en mémoire ---
let users = [
  { id: 1, name: "Admin" },
  { id: 2, name: "Nour" }
];

let rooms = [
  { id: 1, name: "Salle A", capacity: 10 },
  { id: 2, name: "Salle B", capacity: 20 }
];

let reservations = []; // {id, roomId, userId, date}

// --- API ---
// Lister les salles
app.get("/rooms", (req, res) => {
  res.json(rooms);
});

// Ajouter une salle
app.post("/rooms", (req, res) => {
  const { name, capacity } = req.body;
  if (!name || !capacity) {
    return res.status(400).json({ error: "name et capacity requis" });
  }

  const newRoom = {
    id: rooms.length + 1,
    name,
    capacity: Number(capacity)
  };
  rooms.push(newRoom);

  res.status(201).json(newRoom);
});

// Lister les utilisateurs
app.get("/users", (req, res) => {
  res.json(users);
});

// Créer une réservation
app.post("/reservations", (req, res) => {
  const { roomId, userId, date } = req.body;
  if (!roomId || !userId || !date) {
    return res.status(400).json({ error: "roomId, userId, date requis" });
  }

  // Vérifier existence
  const room = rooms.find((r) => r.id === Number(roomId));
  if (!room) return res.status(404).json({ error: "Salle introuvable" });

  const user = users.find((u) => u.id === Number(userId));
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

  // Conflit même salle + même date
  const conflict = reservations.find(
    (r) => r.roomId === Number(roomId) && r.date === String(date)
  );
  if (conflict) {
    return res.status(400).json({ error: "Salle déjà réservée à cette date" });
  }

  const newReservation = {
    id: reservations.length + 1,
    roomId: Number(roomId),
    userId: Number(userId),
    date: String(date)
  };
  reservations.push(newReservation);

  res.status(201).json(newReservation);
});

// Lister toutes les réservations
app.get("/reservations", (req, res) => {
  res.json(reservations);
});

// Supprimer une réservation
app.delete("/reservations/:id", (req, res) => {
  const id = Number(req.params.id);
  const before = reservations.length;

  reservations = reservations.filter((r) => r.id !== id);
  const removed = before !== reservations.length;

  res.json({
    message: removed ? "Réservation supprimée" : "Aucune réservation trouvée"
  });
});

// Démarrage
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
