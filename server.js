const express = require('express');
const app = express();
app.use(express.json());

// База данных в памяти
let users = [];
let computers = [
  { id: 1, name: 'PC #1', free: true },
  { id: 2, name: 'PC #2', free: true },
  { id: 3, name: 'PC #3', free: true }
];
let bookings = [];
let nextUserId = 1;
let nextBookingId = 1;

// ========== БАГ №1: Регистрация не проверяет уникальность email ==========
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  // ❌ НЕТ проверки на существующий email — можно зарегистрировать дважды
  const newUser = { id: nextUserId++, username, email, password };
  users.push(newUser);
  res.status(201).json({ message: 'User registered', userId: newUser.id });
});

// ========== БАГ №2: При логине не проверяется пароль ==========
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // ❌ Ищет только по username, пароль игнорирует
  const user = users.find(u => u.username === username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = `fake-token-${user.id}`;
  res.json({ token, role: user.username === 'admin' ? 'admin' : 'user' });
});

// Просмотр свободных компьютеров (работает нормально)
app.get('/api/computers/free', (req, res) => {
  const freeComputers = computers.filter(c => c.free);
  res.json(freeComputers);
});

// ========== НОВЫЙ ЭНДПОИНТ: Просмотр всех пользователей (только для админа) ==========
app.get('/api/users', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = auth.split(' ')[1];
  const userId = parseInt(token.split('-')[2]);
  if (isNaN(userId)) return res.status(403).json({ error: 'Invalid token' });

  const currentUser = users.find(u => u.id === userId);
  if (!currentUser || currentUser.username !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  // Возвращаем всех пользователей (с паролями, для учебного проекта допустимо)
  res.json(users);
});

// ========== БАГ №3: Можно забронировать компьютер в прошлом ==========
app.post('/api/bookings', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = auth.split(' ')[1];
  const userId = parseInt(token.split('-')[2]);
  if (isNaN(userId)) return res.status(403).json({ error: 'Invalid token' });

  const { computer_id, date, time_start, time_end } = req.body;
  if (!computer_id || !date || !time_start || !time_end) {
    return res.status(400).json({ error: 'Missing booking fields' });
  }
  // ❌ НЕТ проверки, что дата не раньше сегодня
  const conflict = bookings.find(b => b.computer_id === computer_id && b.date === date && b.time_start === time_start);
  if (conflict) {
    return res.status(409).json({ error: 'Time already booked' });
  }
  const newBooking = { id: nextBookingId++, computer_id, date, time_start, time_end, user_id: userId };
  bookings.push(newBooking);
  const computer = computers.find(c => c.id === computer_id);
  if (computer) computer.free = false;
  res.status(201).json({ booking_id: newBooking.id });
});

// История бронирований (работает нормально)
app.get('/api/bookings/my', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = auth.split(' ')[1];
  const userId = parseInt(token.split('-')[2]);
  if (isNaN(userId)) return res.status(403).json({ error: 'Invalid token' });
  const myBookings = bookings.filter(b => b.user_id === userId);
  res.json(myBookings);
});

// ========== БАГ №4: Отмена брони работает без токена админа (достаточно любого токена) ==========
app.delete('/api/bookings/:id', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  // ❌ НЕТ проверки на роль admin — любой авторизованный может удалить
  const bookingId = parseInt(req.params.id);
  const index = bookings.findIndex(b => b.id === bookingId);
  if (index === -1) return res.status(404).json({ error: 'Booking not found' });
  bookings.splice(index, 1);
  res.status(204).send();
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Сервер запущен на http://localhost:${PORT}`));