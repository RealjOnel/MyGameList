// routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.js';

const router = express.Router();

// REGISTER
router.post('/register', async (req, res) => {

   console.log("Register Request Body:", req.body);

  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: 'Please fill all fields' });

  const existingUser = await User.findOne({ username });
  if (existingUser)
    return res.status(400).json({ message: 'Username already exists' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = new User({ username, email, passwordHash });
  await user.save();

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// LOGIN
router.post('/login', async (req, res) => {

  console.log("Login Request Body:", req.body);
  
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user)
    return res.status(400).json({ message: 'Invalid username or password' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid)
    return res.status(400).json({ message: 'Invalid username or password' });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// ✅ WICHTIG: export default router für server.js
export default router;
