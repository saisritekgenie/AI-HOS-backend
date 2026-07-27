const dotenv = require("dotenv");
dotenv.config();

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