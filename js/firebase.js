// ============================================================
// Firebase — leaderboard persistence
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyDVlzbjeFGZnib_jBbw2GXwzrj1vAeHfps",
  authDomain: "rock-mystery-fest.firebaseapp.com",
  projectId: "rock-mystery-fest",
  storageBucket: "rock-mystery-fest.firebasestorage.app",
  messagingSenderId: "435575855375",
  appId: "1:435575855375:web:a93d5a3f44e324e6931f7a",
  measurementId: "G-8BV69F88K5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const analytics = firebase.analytics();

// --- Analytics helpers ---
function trackGameStart(playerName) {
  const gamesPlayed = parseInt(localStorage.getItem('games_played') || '0') + 1;
  localStorage.setItem('games_played', gamesPlayed);

  analytics.setUserProperties({ games_played: gamesPlayed });
  analytics.logEvent('game_start', {
    player_name: playerName,
    games_played: gamesPlayed
  });
}

function trackGameEnd(playerName, win, hp, turns, seconds) {
  const gamesPlayed = parseInt(localStorage.getItem('games_played') || '1');
  const gamesCompleted = parseInt(localStorage.getItem('games_completed') || '0') + 1;
  localStorage.setItem('games_completed', gamesCompleted);

  analytics.logEvent('game_end', {
    player_name: playerName,
    result: win ? 'win' : 'lose',
    hp_remaining: hp,
    turns: turns,
    time_seconds: seconds,
    score: win ? calculateScore(hp, turns, seconds) : 0,
    games_played: gamesPlayed,
    games_completed: gamesCompleted
  });
}

// --- Score formula ---
// HP score:   remaining HP × 10          (max 1000)
// Turn bonus: fewer turns = higher bonus  (max 300 at 4 turns, 0 at 10+)
// Time bonus: fewer seconds = higher bonus (max 360 at 0s, 0 at 180s+)
function calculateScore(hp, turns, seconds) {
  const hpScore = hp * 10;
  const turnBonus = Math.max(0, (10 - turns)) * 50;
  const timeBonus = Math.max(0, (180 - seconds)) * 2;
  return hpScore + turnBonus + timeBonus;
}

// Format seconds as m:ss
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + ':' + String(s).padStart(2, '0');
}

// Save a winning score to Firestore
async function saveScore(name, hp, turns, seconds) {
  const score = calculateScore(hp, turns, seconds);
  try {
    await db.collection('leaderboard').add({
      name: name,
      score: score,
      hp: hp,
      turns: turns,
      time: seconds,
      date: firebase.firestore.FieldValue.serverTimestamp()
    });
    return score;
  } catch (err) {
    console.error('Error saving score:', err);
    return score;
  }
}

// Fetch top scores from Firestore
async function getLeaderboard(limit = 10) {
  try {
    const snapshot = await db.collection('leaderboard')
      .orderBy('score', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((doc, i) => ({
      rank: i + 1,
      ...doc.data()
    }));
  } catch (err) {
    console.error('Error loading leaderboard:', err);
    return [];
  }
}
