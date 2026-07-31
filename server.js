const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const dotenv = require("dotenv");
dotenv.config();

// Ensure critical environment security variables are present
if (!process.env.JWT_SECRET) {
  console.error("❌ CRITICAL SETUP ERROR: JWT_SECRET environment variable is missing!");
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 32) {
  console.error("❌ CRITICAL SETUP ERROR: ENCRYPTION_KEY must be defined in env and must be exactly 32 characters long!");
  process.exit(1);
}


const http = require("http");
const socketio = require("socket.io");
const app = require("./src/app");
const connectDB = require("./src/config/db.js");

const PORT = process.env.PORT || 8086;

const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Make Socket.IO available to Express request handlers
app.set("io", io);

io.on("connection", (socket) => {
  console.log(`🔌 Client connected to Socket.IO: ${socket.id}`);
  
  socket.on("join", (room) => {
    socket.join(room);
    console.log(`🚪 Client ${socket.id} joined room: ${room}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected from Socket.IO: ${socket.id}`);
  });
});

// Connect to Database and start server
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 AI Hospital Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to connect to DB, starting server without DB connection for debugging:", err.message);
  server.listen(PORT, () => {
    console.log(`🚀 AI Hospital Server running on http://localhost:${PORT}`);
  });
});