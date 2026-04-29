import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// Database Setup
const mongoURI = 'mongodb+srv://pavansagaradas_db_user:IngvLqm08TAsNP91@mlproject.lep03fs.mongodb.net/?appName=mlproject';
mongoose.connect(mongoURI).then(() => {
  console.log('Connected to MongoDB Compass');
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});

// Models
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

const PredictionSchema = new mongoose.Schema({
  user_id: { type: String },
  age: Number,
  gender: String,
  cp: Number,
  trestbps: Number,
  chol: Number,
  fbs: Number,
  restecg: Number,
  thalach: Number,
  exang: Number,
  oldpeak: Number,
  slope: Number,
  ca: Number,
  thal: Number,
  prediction: Boolean,
  assessment: String,
  timestamp: { type: Date, default: Date.now }
});
const Prediction = mongoose.model('Prediction', PredictionSchema);

// Mock Random Forest Prediction Logic
function mockPredict(data) {
  let score = 0;
  if (data.age > 50) score += 1;
  if (data.gender === 'Male' || data.gender === 1) score += 1;
  if (data.cp > 0) score += 2; // Chest pain type
  if (data.trestbps > 130) score += 1; // High resting BP
  if (data.chol > 240) score += 1; // High cholesterol
  if (data.fbs === 1) score += 1; // Fasting blood sugar > 120
  if (data.restecg > 0) score += 1; // Abnormal ECG
  if (data.thalach < 150) score += 1; // Low max heart rate
  if (data.exang === 1) score += 2; // Exercise induced angina
  if (data.oldpeak > 1.0) score += 2; // ST depression
  if (data.slope === 1 || data.slope === 2) score += 1; // Abnormal slope
  if (data.ca > 0) score += 2; // Number of major vessels colored
  if (data.thal === 2 || data.thal === 3) score += 2; // Thalassemia defect
  
  let assessment = 'Safe';
  let prediction = false;
  
  if (score >= 4 && score < 7) {
    assessment = 'Danger Zone';
    prediction = true;
  } else if (score >= 7) {
    assessment = 'Critical';
    prediction = true;
  }
  
  return { score, assessment, prediction };
}

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const newUser = new User({ username, password });
    await newUser.save();
    
    // Using _id but mapping it to id for frontend compatibility
    res.json({ message: 'User registered successfully', user_id: newUser._id.toString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const user = await User.findOne({ username, password });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ message: 'Login successful', user: { id: user._id.toString(), username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/predict', async (req, res) => {
  const data = req.body;
  const { score, assessment, prediction } = mockPredict(data);

  try {
    const newPrediction = new Prediction({
      user_id: data.user_id || null,
      age: data.age,
      gender: data.gender,
      cp: data.cp,
      trestbps: data.trestbps,
      chol: data.chol,
      fbs: data.fbs,
      restecg: data.restecg,
      thalach: data.thalach,
      exang: data.exang,
      oldpeak: data.oldpeak,
      slope: data.slope,
      ca: data.ca,
      thal: data.thal,
      prediction,
      assessment
    });
    
    await newPrediction.save();

    res.json({
      prediction,
      assessment,
      score,
      message: `Assessment: ${assessment}`,
      record_id: newPrediction._id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save to database' });
  }
});

app.get('/stats', async (req, res) => {
  const userId = req.query.user_id;
  
  try {
    const filter = userId ? { user_id: userId } : {};
    
    const totalPredictions = await Prediction.countDocuments(filter);
    const riskDetected = await Prediction.countDocuments({ ...filter, prediction: true });
    
    res.json({
      total_predictions: totalPredictions,
      risk_detected: riskDetected,
      no_risk: totalPredictions - riskDetected
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Catch-all route to serve the React index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
